import { CheckCircle2, Cpu, Gamepad2, LogIn, Lock, LogOut, Sun, UserCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { User } from 'firebase/auth';
import ErrorCard from '../components/ErrorCard';

const THEMES = [
  { id: 'theme-minimalist', name: 'Botanical Minimalist', icon: Sun },
  { id: 'theme-gamified', name: 'Tamagotchi Garden', icon: Gamepad2 },
  { id: 'theme-cyber', name: 'Cyber-Botanical', icon: Cpu },
];

type Props = {
  apiKey: string;
  appTheme: string;
  keyStoreError: string | null;
  currentUser: User | null;
  authConfigured: boolean;
  authError: string | null;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onChangeApiKey: (value: string) => void;
  onChangeTheme: (theme: string) => void;
  onReset: () => void;
};

export default function SettingsScreen({
  apiKey,
  appTheme,
  keyStoreError,
  currentUser,
  authConfigured,
  authError,
  isSigningIn,
  onSignIn,
  onSignOut,
  onChangeApiKey,
  onChangeTheme,
  onReset,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-6 pb-6 space-y-6 pt-2"
    >
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">
          <UserCircle2 size={14} /> Account
        </h3>
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-4 shadow-sm">
          {currentUser ? (
            <>
              <div className="flex items-center gap-3">
                {currentUser.photoURL && (
                  <img src={currentUser.photoURL} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-main truncate">{currentUser.displayName}</p>
                  <p className="text-xs text-text-muted truncate">{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="w-full bg-bg-main text-text-muted border border-text-muted/20 py-3 rounded-xl font-bold text-sm hover:text-text-main transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Optional. Signing in opens your web browser. Flora AI works fully without it — your
                plants are stored on this computer either way.
              </p>
              <button
                onClick={onSignIn}
                disabled={isSigningIn || !authConfigured}
                className="w-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-3 rounded-xl font-bold text-sm hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <LogIn size={16} />
                {!authConfigured
                  ? 'Google sign-in not configured'
                  : isSigningIn
                    ? 'Waiting for your browser…'
                    : 'Sign in with Google'}
              </button>
            </>
          )}
          {authError && <ErrorCard message={authError} onRetry={onSignIn} />}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">
          <Lock size={14} /> Gemini API Access
        </h3>
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 space-y-3 shadow-sm">
          <p className="text-xs text-text-muted leading-relaxed font-medium">
            Enter your personal Gemini API Key from Google AI Studio. It is encrypted by your operating
            system and never leaves this computer.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full bg-bg-main border border-text-muted/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)] font-mono text-text-main"
          />
          {apiKey && !keyStoreError && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] font-bold">
              <CheckCircle2 size={12} /> Key saved
            </div>
          )}
          {keyStoreError && <ErrorCard message={keyStoreError} />}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2">
          UI Theme Engine
        </h3>
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 shadow-sm grid grid-cols-1 gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onChangeTheme(theme.id)}
              className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                appTheme === theme.id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-transparent hover:bg-bg-main'
              }`}
            >
              <div className="flex items-center gap-3">
                <theme.icon
                  size={18}
                  className={appTheme === theme.id ? 'text-[var(--color-accent)]' : 'text-text-muted'}
                />
                <span
                  className={`text-sm font-bold ${
                    appTheme === theme.id ? 'text-[var(--color-accent)]' : 'text-text-main'
                  }`}
                >
                  {theme.name}
                </span>
              </div>
              {appTheme === theme.id && <CheckCircle2 size={16} className="text-[var(--color-accent)]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <button
          onClick={onReset}
          className="w-full bg-red-500/10 text-red-500 border border-red-500/30 py-4 rounded-xl font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Reset Local Data
        </button>
      </div>
    </motion.div>
  );
}
