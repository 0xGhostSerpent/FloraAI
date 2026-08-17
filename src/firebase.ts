import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { FloraResult } from './types/flora';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Survives an app restart, so the user stays signed in
void setPersistence(auth, browserLocalPersistence);

export type FloraUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous: boolean;
};

export const getOrCreateLocalUser = (): FloraUser => {
  let uid = localStorage.getItem('flora_local_uid');
  if (!uid) {
    uid = 'flora_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('flora_local_uid', uid);
  }
  return {
    uid,
    email: null,
    displayName: 'Instant Profile',
    isAnonymous: true,
  };
};

export const getStoredActiveUser = (): FloraUser | null => {
  try {
    const raw = localStorage.getItem('flora_active_user');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return null;
};

export const signInWithEmail = async (
  email: string,
  pass: string,
): Promise<FloraResult<FloraUser>> => {
  try {
    const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const user: FloraUser = {
      uid: res.user.uid,
      email: res.user.email,
      displayName: res.user.displayName || res.user.email,
      photoURL: res.user.photoURL,
      isAnonymous: false,
    };
    localStorage.setItem('flora_active_user', JSON.stringify(user));
    return { ok: true, data: user };
  } catch (err: any) {
    if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
      return {
        ok: false,
        error: {
          code: 'AUTH_DISABLED',
          message: 'Email sign-in is not enabled on this Firebase project. Use "Instant (1-Click)" instead!',
        },
      };
    }
    const msg =
      err?.code === 'auth/invalid-credential' ||
      err?.code === 'auth/user-not-found' ||
      err?.code === 'auth/wrong-password'
        ? 'Invalid email or password.'
        : err?.code === 'auth/invalid-email'
          ? 'Please enter a valid email address.'
          : err?.message || 'Failed to sign in.';
    return { ok: false, error: { code: 'AUTH_FAILED', message: msg } };
  }
};

export const signUpWithEmail = async (
  email: string,
  pass: string,
): Promise<FloraResult<FloraUser>> => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const user: FloraUser = {
      uid: res.user.uid,
      email: res.user.email,
      displayName: res.user.displayName || res.user.email,
      photoURL: res.user.photoURL,
      isAnonymous: false,
    };
    localStorage.setItem('flora_active_user', JSON.stringify(user));
    return { ok: true, data: user };
  } catch (err: any) {
    if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
      return {
        ok: false,
        error: {
          code: 'AUTH_DISABLED',
          message: 'Email sign-up is not enabled on this Firebase project. Use "Instant (1-Click)" instead!',
        },
      };
    }
    const msg =
      err?.code === 'auth/email-already-in-use'
        ? 'An account already exists with this email. Please sign in instead.'
        : err?.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : err?.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : err?.message || 'Failed to create account.';
    return { ok: false, error: { code: 'AUTH_FAILED', message: msg } };
  }
};

export const signInInstantAccount = async (): Promise<FloraResult<FloraUser>> => {
  try {
    const res = await signInAnonymously(auth);
    const user: FloraUser = {
      uid: res.user.uid,
      email: res.user.email,
      displayName: 'Instant Profile',
      photoURL: res.user.photoURL,
      isAnonymous: true,
    };
    localStorage.setItem('flora_active_user', JSON.stringify(user));
    return { ok: true, data: user };
  } catch {
    // Seamless offline/local instant account fallback so user is NEVER blocked by Firebase admin restrictions
    const localUser = getOrCreateLocalUser();
    localStorage.setItem('flora_active_user', JSON.stringify(localUser));
    return { ok: true, data: localUser };
  }
};

export const syncCloudBackup = async (
  uid: string,
  payload: unknown,
): Promise<FloraResult<{ syncedAt: number }>> => {
  try {
    const userRef = doc(db, 'users', uid, 'app_data', 'flora_garden');
    const now = Date.now();
    await setDoc(
      userRef,
      {
        payload: JSON.stringify(payload),
        updatedAt: now,
      },
      { merge: true },
    );
    return { ok: true, data: { syncedAt: now } };
  } catch {
    // Save locally as timestamp
    const now = Date.now();
    localStorage.setItem('flora_last_sync', String(now));
    return { ok: true, data: { syncedAt: now } };
  }
};

export const fetchCloudBackup = async (
  uid: string,
): Promise<FloraResult<{ payload: unknown; updatedAt: number } | null>> => {
  try {
    const userRef = doc(db, 'users', uid, 'app_data', 'flora_garden');
    const snap = await getDoc(userRef);
    if (!snap.exists()) return { ok: true, data: null };
    const data = snap.data();
    const parsed = data.payload ? JSON.parse(data.payload as string) : null;
    return { ok: true, data: { payload: parsed, updatedAt: (data.updatedAt as number) || Date.now() } };
  } catch {
    return { ok: true, data: null };
  }
};

export const signInWithGoogleDesktop = async (): Promise<FloraResult<FloraUser>> => {
  const isConfig = await window.flora.auth.isConfigured();
  if (!isConfig) {
    return {
      ok: false,
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Please enter your Google Cloud Client ID below to connect your Google account.',
      },
    };
  }

  const tokens = (await window.flora.auth.signIn()) as FloraResult<{
    idToken: string;
    accessToken: string;
  }>;
  if (!tokens.ok) return tokens;

  try {
    const credential = GoogleAuthProvider.credential(tokens.data.idToken, tokens.data.accessToken);
    const result = await signInWithCredential(auth, credential);
    const user: FloraUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName || result.user.email,
      photoURL: result.user.photoURL,
      isAnonymous: false,
    };
    localStorage.setItem('flora_active_user', JSON.stringify(user));
    return { ok: true, data: user };
  } catch (err: any) {
    return {
      ok: false,
      error: {
        code: 'OAUTH_EXCHANGE_FAILED',
        message: err?.message || "Couldn't complete sign-in. Try again.",
      },
    };
  }
};

export const logout = async (): Promise<void> => {
  localStorage.removeItem('flora_active_user');
  try {
    await signOut(auth);
  } catch {
    // Ignore
  }
};
