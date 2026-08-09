import { CheckCircle2, Cpu, Gamepad2, Lock, LogOut, Sun } from 'lucide-react';
import { motion } from 'motion/react';
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
  onChangeApiKey: (value: string) => void;
  onChangeTheme: (theme: string) => void;
  onReset: () => void;
};

export default function SettingsScreen({
  apiKey,
  appTheme,
  keyStoreError,
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
