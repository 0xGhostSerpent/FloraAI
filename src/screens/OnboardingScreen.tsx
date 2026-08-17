import { useState, useEffect } from 'react';
import { Cloud, Leaf, LogIn, Sparkles, UserPlus, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { FloraUser } from '../firebase';

type Props = {
  onAccept: () => void;
  onInstantSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  isSigningIn: boolean;
  authError: string | null;
  currentUser: FloraUser | null;
};

export default function OnboardingScreen({
  onAccept,
  onInstantSignIn,
  onEmailSignIn,
  onEmailSignUp,
  isSigningIn,
  authError,
  currentUser,
}: Props) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // If user is already signed in, let them proceed directly
  useEffect(() => {
    if (currentUser) {
      onAccept();
    }
  }, [currentUser, onAccept]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col p-6 sm:p-8 items-center justify-center text-center z-10 relative max-w-lg mx-auto w-full"
    >
      {/* Brand Icon & Heading */}
      <div className="w-20 h-20 bg-[var(--color-accent)]/10 rounded-3xl flex items-center justify-center mb-5 border border-[var(--color-accent)]/20 shadow-md">
        <Leaf size={40} className="text-[var(--color-accent)]" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-main mb-1.5 flex items-center gap-1.5">
        Flora <span className="text-[var(--color-accent)]">AI</span>
      </h1>
      <p className="text-text-muted text-sm sm:text-base font-medium mb-6">
        Intelligent Botanical Companion &amp; Garden Manager
      </p>

      {/* Cloud & Drive Highlights Box */}
      <div className="w-full bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 text-left mb-6 dynamic-shadow space-y-3">
        <div className="flex items-center gap-2 text-text-main font-bold text-sm">
          <Cloud size={18} className="text-[var(--color-accent)]" />
          <span>Automatic Cloud Garden Backup</span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Sync your plant collection, daily check-in photos, care streaks, and botanical AI chat histories securely to the cloud.
        </p>

        <div className="pt-2 border-t border-text-muted/10 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles size={12} className="text-[var(--color-accent)] shrink-0" />
            <span>Multi-Device Sync</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles size={12} className="text-[var(--color-accent)] shrink-0" />
            <span>AI Chat History Backup</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full space-y-3">
        {/* 1. Primary Action: Instant 1-Click Cloud Account */}
        <button
          onClick={() => void onInstantSignIn()}
          disabled={isSigningIn}
          className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold text-sm shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          <Zap size={18} />
          {isSigningIn ? 'Connecting to Cloud…' : 'Start Instant Cloud Account (1-Click)'}
        </button>

        {/* 2. Secondary Action: Email Sign In / Sign Up */}
        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="w-full bg-bg-card dynamic-border text-text-main py-3 rounded-xl font-bold text-xs hover:bg-bg-card/80 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={14} className="text-[var(--color-accent)]" /> Sign In or Create Account with Email
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="w-full bg-bg-card dynamic-border rounded-2xl p-4 text-left space-y-3 text-xs dynamic-shadow"
          >
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-text-main">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-bg-main border border-text-muted/20 rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-text-main">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 characters)"
                className="w-full bg-bg-main border border-text-muted/20 rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => void onEmailSignIn(email, password)}
                disabled={isSigningIn || !email.trim() || !password.trim()}
                className="py-2.5 rounded-lg bg-[var(--color-accent)] text-bg-main font-bold text-xs hover:brightness-110 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <LogIn size={13} /> Sign In
              </button>
              <button
                type="button"
                onClick={() => void onEmailSignUp(email, password)}
                disabled={isSigningIn || !email.trim() || !password.trim()}
                className="py-2.5 rounded-lg bg-bg-main border border-[var(--color-accent)]/30 text-text-main font-bold text-xs hover:bg-bg-card active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <UserPlus size={13} className="text-[var(--color-accent)]" /> Create Account
              </button>
            </div>
          </motion.div>
        )}

        {authError && (
          <p className="text-xs text-red-500 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 font-medium">
            {authError}
          </p>
        )}

        {/* 3. Offline / Guest */}
        <button
          onClick={onAccept}
          className="w-full bg-transparent text-text-muted hover:text-text-main py-2.5 rounded-xl font-bold text-xs hover:bg-bg-card/50 transition-colors"
        >
          Continue as Guest (Offline Mode)
        </button>
      </div>
    </motion.div>
  );
}
