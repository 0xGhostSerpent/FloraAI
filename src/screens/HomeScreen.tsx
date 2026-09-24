import { AlertTriangle, Check, KeyRound, ScanLine, Sprout } from 'lucide-react';
import type { PlantData } from '../store';
import { formatDateId, getTodayDateId, parseDateId } from '../lib/dates';
import { Badge, Button, EmptyState, Notice, Page, PageHeader } from '../components/ui';

type Props = {
  plants: PlantData[];
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onOpenPlant: (plant: PlantData) => void;
  onIdentify: () => void;
};

/** The most recent check-in id, or null for a plant that has none. */
function lastCheckIn(plant: PlantData): string | null {
  let latest: { id: string; time: number } | null = null;
  for (const checkIn of plant.checkIns ?? []) {
    const time = parseDateId(checkIn.dateId)?.getTime() ?? 0;
    if (!latest || time > latest.time) latest = { id: checkIn.dateId, time };
  }
  return latest?.id ?? null;
}

function PlantCard({ plant, onOpen }: { plant: PlantData; onOpen: () => void }) {
  const today = getTodayDateId();
  const last = lastCheckIn(plant);
  const checkedIn = last === today;
  const photos = plant.checkIns?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-card transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-sunken">
        <img
          src={plant.imageUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {plant.isToxic && (
          <Badge tone="danger" icon={AlertTriangle} className="absolute left-3 top-3 bg-surface/95 shadow-card">
            Toxic
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <h3 className="truncate font-display text-[17px] font-semibold leading-snug text-ink">{plant.name}</h3>
        <p className="truncate text-[13px] italic text-muted">{plant.scientificName || ' '}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          {checkedIn ? (
            <span className="inline-flex items-center gap-1 font-medium text-accent">
              <Check size={13} strokeWidth={2.6} /> Checked in today
            </span>
          ) : (
            <span className="truncate text-faint">{last ? `Last check-in ${formatDateId(last).replace(/^Yesterday$/, 'yesterday')}` : 'No check-ins yet'}</span>
          )}
          <span className="shrink-0 text-faint tabular-nums">
            {photos} photo{photos === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function HomeScreen({ plants, hasApiKey, onOpenSettings, onOpenPlant, onIdentify }: Props) {
  const today = getTodayDateId();
  const doneToday = plants.filter((p) => p.checkIns?.some((c) => c.dateId === today)).length;

  const subtitle =
    plants.length === 0
      ? 'Plants you identify and save will appear here.'
      : `${plants.length} plant${plants.length === 1 ? '' : 's'} · ${doneToday} checked in today`;

  return (
    <Page wide className="space-y-7">
      <PageHeader
        title="Your garden"
        subtitle={subtitle}
        actions={
          plants.length > 0 && (
            <Button variant="primary" icon={ScanLine} onClick={onIdentify}>
              Identify a plant
            </Button>
          )
        }
      />

      {!hasApiKey && (
        <Notice
          tone="warn"
          icon={KeyRound}
          title="Add an AI key to get started"
          action={
            <Button size="sm" onClick={onOpenSettings}>
              Open settings
            </Button>
          }
        >
          Identification, health checks and chat all run on an AI model you choose. Gemini has a free tier.
        </Notice>
      )}

      {plants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong">
          <EmptyState
            icon={Sprout}
            title="Nothing growing yet"
            action={
              <Button variant="primary" icon={ScanLine} onClick={onIdentify}>
                Identify your first plant
              </Button>
            }
          >
            Photograph a houseplant, flower or tree. Flora names it, checks its health, and keeps a photo
            diary as you check in on it.
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-5">
          {plants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} onOpen={() => onOpenPlant(plant)} />
          ))}
        </div>
      )}
    </Page>
  );
}
