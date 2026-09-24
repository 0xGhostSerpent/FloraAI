import { useRef, useState, type ReactNode } from 'react';
import {
  Check,
  CloudUpload,
  Download,
  ExternalLink,
  LogOut,
  Monitor,
  PlugZap,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { FloraUser } from '../firebase';
import {
  AI_PROVIDERS,
  supportsVision,
  providerInfo,
  type AiProvider,
  type ConnectionResult,
} from '../services/ai';
import type { StorageBackend } from '../types/flora';
import { formatRelative } from '../lib/dates';
import {
  Button,
  ConfirmDialog,
  cx,
  Field,
  Input,
  Notice,
  Page,
  PageHeader,
  Segmented,
  Select,
} from '../components/ui';

/** Ids are what configs already store; names are what people see. */
export const THEMES: { id: string; name: string; colors: [string, string, string] | null }[] = [
  { id: 'theme-system', name: 'Match system', colors: null },
  { id: 'theme-minimalist', name: 'Fern', colors: ['#f4f5f0', '#ffffff', '#2f6b3f'] },
  { id: 'theme-gamified', name: 'Clay', colors: ['#f6f1e9', '#fffdf9', '#a94f28'] },
  { id: 'theme-cyber', name: 'Night', colors: ['#0e1310', '#151b17', '#74c088'] },
];

type Props = {
  apiKey: string;
  aiModel: string;
  aiProvider: AiProvider;
  aiBaseUrl: string;
  availableModels: string[];
  isLoadingModels: boolean;
  modelError: string | null;
  appTheme: string;
  keyStoreError: string | null;
  keyIsSaved: boolean;
  savedProviders: AiProvider[];
  storageBackend: StorageBackend;
  connectionResult: ConnectionResult | null;
  isTestingConnection: boolean;
  isOnline: boolean;
  currentUser: FloraUser | null;
  authConfigured: boolean;
  authError: string | null;
  isSigningIn: boolean;
  driveSyncing: boolean;
  lastDriveSync: number | null;
  driveSyncError: string | null;
  onSyncDrive: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onEmailSignIn: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  onInstantSignIn: () => Promise<void>;
  onSaveGoogleClientId: (clientId: string) => Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onChangeApiKey: (value: string) => void;
  onSaveApiKey: () => void;
  onChangeAiModel: (value: string) => void;
  onChangeAiProvider: (value: AiProvider) => void;
  onChangeAiBaseUrl: (value: string) => void;
  onRefreshModels: () => void;
  onTestConnection: () => void;
  onChangeTheme: (theme: string) => void;
  onReset: () => void;
};

function SettingsGroup({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line py-8 first:border-t-0 first:pt-2 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function SettingsScreen(props: Props) {
  const {
    apiKey,
    aiModel,
    aiProvider,
    aiBaseUrl,
    availableModels,
    isLoadingModels,
    modelError,
    appTheme,
    keyStoreError,
    keyIsSaved,
    savedProviders,
    storageBackend,
    connectionResult,
    isTestingConnection,
    isOnline,
    onChangeApiKey,
    onSaveApiKey,
    onChangeAiModel,
    onChangeAiProvider,
    onChangeAiBaseUrl,
    onRefreshModels,
    onTestConnection,
    onChangeTheme,
    onExportBackup,
    onImportBackup,
    onReset,
  } = props;

  const provider = providerInfo(aiProvider);
  const modelLacksVision = Boolean(aiModel) && !supportsVision(aiModel, aiProvider);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Page className="space-y-6">
      <PageHeader title="Settings" />

      <div>
        <SettingsGroup
          title="AI model"
          description="Flora sends your photos and messages to the provider you pick here. Keys never leave this computer otherwise."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AI_PROVIDERS.map((candidate) => {
              const active = candidate.id === aiProvider;
              const saved = savedProviders.includes(candidate.id);
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => onChangeAiProvider(candidate.id)}
                  aria-pressed={active}
                  className={cx(
                    'rounded-xl border px-3.5 py-3 text-left transition-colors',
                    active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className="block text-sm font-semibold text-ink">{candidate.name}</span>
                  <span className={cx('mt-0.5 flex items-center gap-1 text-xs', saved ? 'text-accent' : 'text-faint')}>
                    {saved ? (
                      <>
                        <Check size={12} strokeWidth={2.6} /> Key saved
                      </>
                    ) : (
                      'No key'
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <Field
            label={`${provider.name} API key`}
            htmlFor="api-key"
            aside={
              provider.keyUrl && (
                <button
                  type="button"
                  onClick={() => void window.flora.openExternal(provider.keyUrl!)}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
                >
                  Get a key <ExternalLink size={12} />
                </button>
              )
            }
            hint={
              keyStoreError ? (
                <span className="text-danger">{keyStoreError}</span>
              ) : keyIsSaved ? (
                <span className="inline-flex items-center gap-1 text-accent">
                  <Check size={13} strokeWidth={2.6} />
                  {storageBackend === 'os'
                    ? 'Saved, encrypted by your system keychain.'
                    : 'Saved. No system keyring was found, so it is only obfuscated on disk.'}
                </span>
              ) : (
                'Paste a key and it saves on its own. Flora recognises Gemini, OpenAI, OpenRouter and Groq keys and switches provider for you.'
              )
            }
          >
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => onChangeApiKey(e.target.value)}
                placeholder="Paste your key"
                className="font-mono"
              />
              <Button onClick={onSaveApiKey} disabled={!apiKey.trim() || keyIsSaved}>
                Save
              </Button>
            </div>
          </Field>

          {aiProvider === 'custom' && (
            <Field label="Endpoint" htmlFor="base-url" hint="Any OpenAI-compatible API, ending in /v1.">
              <Input
                id="base-url"
                value={aiBaseUrl}
                onChange={(e) => onChangeAiBaseUrl(e.target.value)}
                placeholder="https://example.com/v1"
                className="font-mono"
              />
            </Field>
          )}

          <Field
            label="Model"
            htmlFor="model"
            aside={
              <Button
                size="sm"
                variant="ghost"
                icon={RefreshCw}
                loading={isLoadingModels}
                disabled={!apiKey.trim()}
                onClick={onRefreshModels}
              >
                Refresh list
              </Button>
            }
            hint={
              modelError ? (
                <span className="text-danger">{modelError}</span>
              ) : modelLacksVision ? (
                <span className="text-warn">This model may not accept photos. If identification fails, pick another.</span>
              ) : (
                'Needs to accept images. Flora picks a suitable one when it loads the list.'
              )
            }
          >
            {availableModels.length > 0 ? (
              <Select id="model" value={aiModel} onChange={(e) => onChangeAiModel(e.target.value)}>
                {!availableModels.includes(aiModel) && aiModel && <option value={aiModel}>{aiModel}</option>}
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="model"
                value={aiModel}
                onChange={(e) => onChangeAiModel(e.target.value)}
                placeholder={provider.preferredModels[0] || 'model-id'}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon={PlugZap}
              loading={isTestingConnection}
              disabled={!apiKey.trim() || !isOnline}
              onClick={onTestConnection}
            >
              Test connection
            </Button>
            {connectionResult &&
              (connectionResult.ok ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-accent">
                  <Check size={14} strokeWidth={2.6} /> Connected · {connectionResult.models} models ·{' '}
                  {connectionResult.elapsedMs} ms
                </span>
              ) : (
                <span className="text-[13px] text-danger">{connectionResult.message || 'Connection failed.'}</span>
              ))}
            {!isOnline && <span className="text-[13px] text-muted">You're offline.</span>}
          </div>
        </SettingsGroup>

        <SettingsGroup title="Appearance">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEMES.map((theme) => {
              const active = appTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onChangeTheme(theme.id)}
                  aria-pressed={active}
                  className={cx(
                    'overflow-hidden rounded-xl border text-left transition-colors',
                    active ? 'border-accent ring-2 ring-accent/25' : 'border-line hover:border-line-strong',
                  )}
                >
                  {theme.colors ? (
                    <div className="flex h-16 items-end gap-1.5 p-2.5" style={{ background: theme.colors[0] }}>
                      <span className="h-8 flex-1 rounded-md" style={{ background: theme.colors[1] }} />
                      <span className="h-5 w-5 rounded-md" style={{ background: theme.colors[2] }} />
                    </div>
                  ) : (
                    <div className="flex h-16">
                      <div className="flex flex-1 items-center justify-center bg-[#f4f5f0] text-[#58635b]">
                        <Monitor size={18} />
                      </div>
                      <div className="flex-1 bg-[#0e1310]" />
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-line bg-surface px-3 py-2">
                    <span className="text-[13px] font-medium text-ink">{theme.name}</span>
                    {active && <Check size={14} strokeWidth={2.6} className="text-accent" />}
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Account & backup"
          description="Optional. Your garden always lives on this computer; an account adds an online copy."
        >
          <AccountPanel {...props} />
        </SettingsGroup>

        <SettingsGroup title="Your data">
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={onExportBackup}>
              Export garden…
            </Button>
            <Button icon={Upload} onClick={() => fileInputRef.current?.click()}>
              Import from file…
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportBackup(file);
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-[13px] text-muted">
            Exports are a single JSON file with every plant, photo and conversation.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-danger/30 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-ink">Erase everything on this computer</p>
              <p className="text-[13px] text-muted">Plants, conversations, settings and saved keys.</p>
            </div>
            <Button variant="ghost" icon={Trash2} className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmReset(true)}>
              Erase…
            </Button>
          </div>
        </SettingsGroup>
      </div>

      <ConfirmDialog
        open={confirmReset}
        icon={Trash2}
        title="Erase all Flora data?"
        confirmLabel="Erase everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          onReset();
        }}
      >
        Every plant, photo, conversation and API key on this computer is deleted and Flora restarts. An online backup,
        if you have one, is not touched. Export first if you might want it back.
      </ConfirmDialog>
    </Page>
  );
}

function AccountPanel({
  currentUser,
  authConfigured,
  authError,
  isSigningIn,
  driveSyncing,
  lastDriveSync,
  driveSyncError,
  onSyncDrive,
  onSignIn,
  onSignOut,
  onEmailSignIn,
  onEmailSignUp,
  onInstantSignIn,
  onSaveGoogleClientId,
}: Props) {
  const [mode, setMode] = useState<'email' | 'google' | 'anonymous'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [savingClientId, setSavingClientId] = useState(false);

  if (currentUser) {
    const name = currentUser.isAnonymous
      ? 'Backup without email'
      : currentUser.displayName || currentUser.email || 'Signed in';
    const initial = currentUser.isAnonymous ? '·' : (currentUser.email?.[0] ?? name[0] ?? '?').toUpperCase();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3.5">
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="" className="h-10 w-10 rounded-full" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-[13px] text-muted">
              {currentUser.isAnonymous ? 'Tied to this installation' : currentUser.email}
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={LogOut} onClick={onSignOut}>
            Sign out
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-3">
          <p className="text-[13px] text-muted">
            {driveSyncing
              ? 'Backing up…'
              : lastDriveSync
                ? `Last backed up ${formatRelative(lastDriveSync)}.`
                : 'Not backed up yet.'}{' '}
            Changes back up automatically.
          </p>
          <Button size="sm" icon={CloudUpload} loading={driveSyncing} onClick={onSyncDrive}>
            Back up now
          </Button>
        </div>

        {driveSyncError && <Notice tone="danger">{driveSyncError}</Notice>}
        {authError && <Notice tone="danger">{authError}</Notice>}
      </div>
    );
  }

  const canSubmit = !isSigningIn && email.trim().length > 0 && password.length > 0;

  return (
    <div className="space-y-5">
      <Segmented<typeof mode>
        label="Sign-in method"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'email', label: 'Email' },
          {
            value: 'google',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <GoogleMark size={13} /> Google
              </span>
            ),
          },
          { value: 'anonymous', label: 'No email' },
        ]}
      />

      {mode === 'email' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void onEmailSignIn(email.trim(), password);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="settings-email">
              <Input id="settings-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="settings-password">
              <Input
                id="settings-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!canSubmit} loading={isSigningIn}>
              Sign in
            </Button>
            <Button disabled={!canSubmit} onClick={() => void onEmailSignUp(email.trim(), password)}>
              Create account
            </Button>
          </div>
        </form>
      )}

      {mode === 'google' &&
        (authConfigured ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-muted">
              Google's sign-in page opens in your web browser. Your garden is also copied to a file in your Google Drive.
            </p>
            <Button loading={isSigningIn} onClick={onSignIn}>
              {!isSigningIn && <GoogleMark />} Continue with Google
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSavingClientId(true);
              await onSaveGoogleClientId(clientId.trim());
              setClientId('');
              setSavingClientId(false);
            }}
          >
            <Field
              label="OAuth client ID"
              htmlFor="client-id"
              hint={
                <>
                  Google sign-in needs a <strong className="font-semibold text-ink">Desktop app</strong> client ID from{' '}
                  <button
                    type="button"
                    onClick={() => void window.flora.openExternal('https://console.cloud.google.com/apis/credentials')}
                    className="font-medium text-accent hover:underline"
                  >
                    Google Cloud Console
                  </button>
                  .
                </>
              }
            >
              <Input
                id="client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1234567890-abc.apps.googleusercontent.com"
                className="font-mono"
              />
            </Field>
            <Button
              type="submit"
              loading={savingClientId}
              disabled={!clientId.trim().endsWith('.apps.googleusercontent.com')}
            >
              Save client ID
            </Button>
          </form>
        ))}

      {mode === 'anonymous' && (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">
            Backs up without an email or password. The backup is tied to this installation, so it can't be restored on
            another computer or after erasing Flora.
          </p>
          <Button icon={CloudUpload} loading={isSigningIn} onClick={() => void onInstantSignIn()}>
            Start backing up
          </Button>
        </div>
      )}

      {authError && <Notice tone="danger">{authError}</Notice>}
    </div>
  );
}
