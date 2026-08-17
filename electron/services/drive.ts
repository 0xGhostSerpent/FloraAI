import { err, ok, Result } from './result';
import { getJson, patchJson, postJson } from './http';
import { getAccessToken, refreshAccessToken } from './oauth';
import { readSecret, writeSecret } from './secrets';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = 'Flora AI Backups';
const FILE_NAME = 'flora_backup.json';

type DriveFileList = {
  files?: Array<{ id: string; name: string; modifiedTime?: string }>;
};

type DriveFile = {
  id: string;
  name: string;
};

export type DriveSyncResult = {
  success: boolean;
  syncedAt: number;
  fileId?: string;
};

async function driveRequest<T>(
  action: (token: string) => Promise<Result<T>>,
): Promise<Result<T>> {
  let tokenResult = await getAccessToken();
  if (!tokenResult.ok) return tokenResult;

  let result = await action(tokenResult.data);
  if (!result.ok && result.error.code === 'HTTP_401') {
    // Attempt token refresh once
    tokenResult = await refreshAccessToken();
    if (!tokenResult.ok) return tokenResult;
    result = await action(tokenResult.data);
  }

  return result;
}

async function getOrCreateBackupFolder(token: string): Promise<Result<string>> {
  const query = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const searchUrl = `${DRIVE_API_URL}?q=${query}&fields=files(id,name)`;

  const searchRes = await getJson<DriveFileList>(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) return searchRes;

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return ok(searchRes.data.files[0].id);
  }

  // Create folder if not found
  const createRes = await postJson<DriveFile>(
    DRIVE_API_URL,
    {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!createRes.ok) return createRes;
  return ok(createRes.data.id);
}

async function getOrCreateBackupFile(token: string, folderId: string): Promise<Result<string>> {
  const query = encodeURIComponent(`'${folderId}' in parents and name='${FILE_NAME}' and trashed=false`);
  const searchUrl = `${DRIVE_API_URL}?q=${query}&fields=files(id,name)`;

  const searchRes = await getJson<DriveFileList>(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) return searchRes;

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return ok(searchRes.data.files[0].id);
  }

  // Create empty file in folder
  const createRes = await postJson<DriveFile>(
    DRIVE_API_URL,
    {
      name: FILE_NAME,
      parents: [folderId],
      mimeType: 'application/json',
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!createRes.ok) return createRes;
  return ok(createRes.data.id);
}

export async function syncToGoogleDrive(payload: unknown): Promise<Result<DriveSyncResult>> {
  return driveRequest<DriveSyncResult>(async (token) => {
    const folderRes = await getOrCreateBackupFolder(token);
    if (!folderRes.ok) return folderRes;

    const fileRes = await getOrCreateBackupFile(token, folderRes.data);
    if (!fileRes.ok) return fileRes;

    const fileId = fileRes.data;
    const backupContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

    const uploadUrl = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
    const patchRes = await patchJson<unknown>(uploadUrl, backupContent, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!patchRes.ok) return patchRes;

    const syncedAt = Date.now();
    try {
      writeSecret('flora_last_drive_sync', syncedAt.toString());
    } catch {
      // Ignore
    }

    return ok({
      success: true,
      syncedAt,
      fileId,
    });
  });
}

export function getLastDriveSync(): { syncedAt: number | null } {
  const stored = readSecret('flora_last_drive_sync');
  if (!stored) return { syncedAt: null };
  const num = parseInt(stored, 10);
  return { syncedAt: isNaN(num) ? null : num };
}
