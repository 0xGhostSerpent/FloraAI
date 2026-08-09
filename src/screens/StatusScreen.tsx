import { Droplets, Leaf, Sun, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import type { PlantStatus } from '../store';
import ErrorCard from '../components/ErrorCard';

type Props = {
  plantName: string;
  status: PlantStatus | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

const OVERALL_LABEL: Record<PlantStatus['overall'], string> = {
  healthy: 'Healthy',
  stressed: 'Stressed',
  declining: 'Declining',
  unknown: 'Unclear',
};

const ROWS = [
  { key: 'hydration', label: 'Hydration', icon: Droplets },
  { key: 'leafCondition', label: 'Leaf condition', icon: Leaf },
  { key: 'lightAdequacy', label: 'Light', icon: Sun },
] as const;

export default function StatusScreen({ plantName, status, isLoading, error, onRetry }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="px-6 pb-6 pt-2 space-y-5"
    >
      <div>
        <h2 className="text-xl font-bold text-text-main leading-tight">{plantName}</h2>
        <p className="text-xs text-text-muted mt-0.5">AI health assessment</p>
      </div>

      {error && <ErrorCard message={error} onRetry={onRetry} />}

      {isLoading && (
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-8 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          <p className="text-sm text-text-muted font-medium">Assessing the photo…</p>
        </div>
      )}

      {status && !isLoading && (
        <>
          <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest mb-1">
                Overall
              </p>
              <p className="text-lg font-bold text-text-main">{OVERALL_LABEL[status.overall]}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
              <Leaf size={22} />
            </div>
          </div>

          <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] divide-y divide-text-muted/10">
            {ROWS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="p-4 flex gap-3 items-start">
                <Icon size={18} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-main">{label}</p>
                  <p className="text-sm text-text-muted leading-relaxed mt-0.5">{status[key]}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-[var(--radius-dynamic)] p-5 flex gap-3 items-start">
            <Wrench size={20} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest mb-1">
                Do this next
              </p>
              <p className="text-sm text-text-main leading-relaxed font-medium">
                {status.recommendedAction}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-text-muted opacity-80 leading-relaxed text-center px-2">
            AI assessment from a single photo. Informational only — it cannot replace inspecting the
            plant yourself.
          </p>
        </>
      )}
    </motion.div>
  );
}
