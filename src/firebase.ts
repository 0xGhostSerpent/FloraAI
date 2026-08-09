import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithCredential,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import type { FloraResult } from './types/flora';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Survives an app restart, so the user consents once rather than every launch.
void setPersistence(auth, browserLocalPersistence);

/**
 * Google blocks OAuth inside embedded user agents, and an Electron window is
 * detected as one — signInWithPopup fails with disallowed_useragent. The main
 * process runs a PKCE loopback through the real browser instead and hands the
 * tokens back here. signInWithCredential opens no window, so it works.
 */
export const signInWithGoogleDesktop = async (): Promise<FloraResult<User>> => {
  const tokens = (await window.flora.auth.signIn()) as FloraResult<{
    idToken: string;
    accessToken: string;
  }>;
  if (!tokens.ok) return tokens;

  try {
    const credential = GoogleAuthProvider.credential(tokens.data.idToken, tokens.data.accessToken);
    const result = await signInWithCredential(auth, credential);
    return { ok: true, data: result.user };
  } catch {
    return {
      ok: false,
      error: { code: 'OAUTH_EXCHANGE_FAILED', message: "Couldn't complete sign-in. Try again." },
    };
  }
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};
