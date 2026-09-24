import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CloudUpload, Leaf, Mail, MapPin, ScanLine, Store, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { FloraUser } from '../firebase';
import { Button, Field, Input, Notice } from '../components/ui';

type Props = {
  onAccept: () => void;
  onInstantSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  isSigningIn: boolean;
  authError: string | null;
  currentUser: FloraUser | null;
};

const FEATURES: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: ScanLine, title: 'Identify from a photo', detail: 'Name, care needs, and whether it is toxic to pets.' },
  { icon: Activity, title: 'Check on its health', detail: 'Water, leaves and light, with one thing to do next.' },
  { icon: Store, title: 'Find it nearby', detail: 'Nurseries on a map, with a rough local price.' },
  { icon: MapPin, title: 'See where it grows wild', detail: 'Real recorded sightings and its native range.' },
];

export default function OnboardingScreen({
  onAccept,
  onInstantSignIn,
  onEmailSignIn,
  onEmailSignUp,
  isSigningIn,
  authError,
  currentUser,
}: Props) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Someone already signed in has nothing to choose here.
  useEffect(() => {
    if (currentUser) onAccept();
  }, [currentUser, onAccept]);

  const canSubmit = !isSigningIn && email.trim().length > 0 && password.length > 0;

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="grid w-full max-w-5xl gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center"
      >
        <div>
          <div className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Leaf size={19} strokeWidth={2.4} />
            </div>
            <span className="font-display text-2xl font-semibold text-ink">Flora</span>
          </div>
          <h1 className="font-display text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
            Know every plant
            <br />
            you grow.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Photograph a plant to find out what it is and how it's doing, then keep a diary of it as it grows.
          </p>
          <ul className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-3">
                <Icon size={18} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-pop">
          <h2 className="text-lg font-semibold text-ink">Get started</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Your garden is saved on this computer. An account is optional and only adds an online backup.
          </p>

          <Button variant="primary" size="lg" block className="mt-6" onClick={onAccept}>
            Start using Flora <ArrowRight size={16} />
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" /> or back up online <span className="h-px flex-1 bg-line" />
          </div>

          {showEmail ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) void onEmailSignIn(email.trim(), password);
              }}
            >
              <Field label="Email" htmlFor="onboard-email">
                <Input
                  id="onboard-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Password" htmlFor="onboard-password" hint="At least 6 characters.">
                <Input
                  id="onboard-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" className="flex-1" disabled={!canSubmit} loading={isSigningIn}>
                  Sign in
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canSubmit}
                  onClick={() => void onEmailSignUp(email.trim(), password)}
                >
                  Create account
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="w-full text-center text-[13px] font-medium text-muted hover:text-ink"
              >
                Back
              </button>
            </form>
          ) : (
            <div className="space-y-2.5">
              <Button block icon={Mail} onClick={() => setShowEmail(true)}>
                Sign in with email
              </Button>
              <Button block icon={CloudUpload} loading={isSigningIn} onClick={() => void onInstantSignIn()}>
                Back up without an email
              </Button>
              <p className="pt-1 text-xs leading-relaxed text-faint">
                Without an email, the backup is tied to this installation and can't be recovered on another computer.
              </p>
            </div>
          )}

          {authError && (
            <Notice tone="danger" className="mt-4">
              {authError}
            </Notice>
          )}
        </div>
      </motion.div>
    </div>
  );
}
