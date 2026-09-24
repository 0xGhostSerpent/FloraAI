import { Droplets, Leaf, RefreshCw, Sun, type LucideIcon } from 'lucide-react';
import type { PlantStatus } from '../store';
import { Button, Card, cx, Disclaimer, Eyebrow, LoadingState, Notice, Page, PageHeader } from '../components/ui';

type Props = {
  plantName: string;
  image: string | null;
  status: PlantStatus | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
};

const OVERALL: Record<PlantStatus['overall'], { label: string; summary: string; dot: string; text: string }> = {
  healthy: { label: 'Healthy', summary: 'Nothing needs fixing right now.', dot: 'bg-accent', text: 'text-accent' },
  stressed: { label: 'Stressed', summary: 'Something is off, but it should recover.', dot: 'bg-warn', text: 'text-warn' },
  declining: { label: 'Declining', summary: 'It needs attention soon.', dot: 'bg-danger', text: 'text-danger' },
  unknown: { label: 'Unclear', summary: "The photo didn't show enough to judge.", dot: 'bg-faint', text: 'text-muted' },
};

const ROWS: { key: 'hydration' | 'leafCondition' | 'lightAdequacy'; label: string; icon: LucideIcon }[] = [
  { key: 'hydration', label: 'Water', icon: Droplets },
  { key: 'leafCondition', label: 'Leaves', icon: Leaf },
  { key: 'lightAdequacy', label: 'Light', icon: Sun },
];

export default function StatusScreen({ plantName, image, status, isLoading, error, onRetry, onBack }: Props) {
  const overall = status ? OVERALL[status.overall] : null;

  return (
    <Page className="space-y-7">
      <PageHeader title="Health check" subtitle={plantName} onBack={onBack} />

      {error && (
        <Notice
          tone="danger"
          title="Couldn't assess this photo"
          action={
            <Button size="sm" icon={RefreshCw} onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Notice>
      )}

      {isLoading && (
        <Card>
          <LoadingState label="Looking at the leaves, soil and light…" />
        </Card>
      )}

      {status && overall && !isLoading && (
        <>
          <Card className="flex items-center gap-5">
            {image && <img src={image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className={cx('flex items-center gap-2 font-display text-2xl font-semibold', overall.text)}>
                <span className={cx('h-2.5 w-2.5 rounded-full', overall.dot)} />
                {overall.label}
              </p>
              <p className="mt-0.5 text-sm text-muted">{overall.summary}</p>
            </div>
          </Card>

          <div className="rounded-2xl border border-accent/25 bg-accent-soft px-5 py-4">
            <Eyebrow className="mb-1 text-accent">Do this next</Eyebrow>
            <p className="text-[15px] font-medium leading-relaxed text-ink">{status.recommendedAction}</p>
          </div>

          <Card padded={false} className="divide-y divide-line">
            {ROWS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex gap-4 px-5 py-4">
                <Icon size={18} className="mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{status[key]}</p>
                </div>
              </div>
            ))}
          </Card>

          <Disclaimer>
            Judged by AI from a single photo. Check the soil and the undersides of the leaves yourself before
            acting on it.
          </Disclaimer>
        </>
      )}
    </Page>
  );
}
