import {
  Activity,
  AlertTriangle,
  Ban,
  Check,
  MapPin,
  Plus,
  ScanLine,
  Store,
  type LucideIcon,
} from 'lucide-react';
import type { Identification } from '../services/ai';
import { Badge, Button, Card, Dialog, Eyebrow, Notice, Page, PageHeader } from '../components/ui';

type Props = {
  image: string;
  result: Identification;
  showToxicAlert: boolean;
  isSaved: boolean;
  onDismissToxicAlert: () => void;
  onAddToGarden: () => void;
  onPlantStatus: () => void;
  onWhereToBuy: () => void;
  onFindInWild: () => void;
  onBackToScanner: () => void;
  onBack: () => void;
};

function ActionTile({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-line-strong hover:bg-sunken"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{detail}</span>
      </span>
    </button>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const label = percent >= 85 ? 'High confidence' : percent >= 60 ? 'Fair confidence' : 'Low confidence';
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function ScanResultScreen({
  image,
  result,
  showToxicAlert,
  isSaved,
  onDismissToxicAlert,
  onAddToGarden,
  onPlantStatus,
  onWhereToBuy,
  onFindInWild,
  onBackToScanner,
  onBack,
}: Props) {
  // Only plants can be saved or searched for, so anything else ends here.
  if (result.isPlant === false) {
    const detected = result.detectedObject || result.name || 'something else';
    return (
      <Page className="space-y-7">
        <PageHeader title="Not a plant" onBack={onBack} />
        <Card className="flex flex-col items-center gap-6 px-8 py-10 text-center sm:flex-row sm:text-left">
          <img src={image} alt="" className="h-36 w-36 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 space-y-2">
            <Badge tone="warn" icon={Ban}>
              Detected: {detected}
            </Badge>
            <p className="text-sm leading-relaxed text-muted">
              {result.rejectionReason ||
                'Flora only identifies plants, trees and flowers. Try a photo where the plant fills most of the frame.'}
            </p>
            <div className="pt-2">
              <Button variant="primary" icon={ScanLine} onClick={onBackToScanner}>
                Try another photo
              </Button>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  const confidence = typeof result.confidence === 'number' ? result.confidence : null;

  return (
    <Page wide className="space-y-7">
      <PageHeader title="Identification" onBack={onBack} backLabel="Identify another" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-4">
          <img src={image} alt={result.name} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card" />
          {confidence !== null && <ConfidenceMeter value={confidence} />}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.015em] text-ink">
              {result.name}
            </h2>
            {result.scientificName && <p className="mt-0.5 text-[15px] italic text-muted">{result.scientificName}</p>}
          </div>

          {result.isToxic && (
            <Notice tone="danger" title="Toxic">
              {result.toxicityDetails || 'Keep away from children and pets.'}
            </Notice>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant={isSaved ? 'soft' : 'primary'}
              size="lg"
              icon={isSaved ? Check : Plus}
              disabled={isSaved}
              onClick={onAddToGarden}
            >
              {isSaved ? 'In your garden' : 'Add to garden'}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ActionTile icon={Activity} title="Health check" detail="Water, leaves and light" onClick={onPlantStatus} />
            <ActionTile icon={Store} title="Where to buy" detail="Nearby nurseries and prices" onClick={onWhereToBuy} />
            <ActionTile icon={MapPin} title="In the wild" detail="Sightings and native range" onClick={onFindInWild} />
          </div>

          <div className="space-y-5 border-t border-line pt-6">
            {result.healthStatus && (
              <div>
                <Eyebrow className="mb-1.5">First look</Eyebrow>
                <p className="text-sm leading-relaxed text-ink">{result.healthStatus}</p>
              </div>
            )}
            {result.careInstructions && (
              <div>
                <Eyebrow className="mb-1.5">Care</Eyebrow>
                <p className="text-sm leading-relaxed text-ink">{result.careInstructions}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* A toxic plant must be acknowledged before anything else is offered. */}
      <Dialog
        open={showToxicAlert}
        onClose={onDismissToxicAlert}
        dismissible={false}
        tone="danger"
        icon={AlertTriangle}
        title={`${result.name} is toxic`}
        footer={
          <Button variant="danger" onClick={onDismissToxicAlert}>
            I understand
          </Button>
        }
      >
        {result.toxicityDetails || 'This plant is harmful if eaten or handled carelessly.'} Keep it out of reach of
        children and pets.
      </Dialog>
    </Page>
  );
}
