import { Images } from 'lucide-react';
import type { PlantData } from '../store';
import { formatDateId, parseDateId } from '../lib/dates';
import { EmptyState, Page, PageHeader } from '../components/ui';

type Props = {
  plant: PlantData;
  onBack: () => void;
};

export default function HistoryScreen({ plant, onBack }: Props) {
  const checkIns = [...(plant.checkIns ?? [])].sort(
    (a, b) => (parseDateId(b.dateId)?.getTime() ?? 0) - (parseDateId(a.dateId)?.getTime() ?? 0),
  );

  return (
    <Page wide className="space-y-7">
      <PageHeader
        title="Photo diary"
        subtitle={`${plant.name} · ${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'}`}
        onBack={onBack}
        backLabel={plant.name}
      />

      {checkIns.length === 0 ? (
        <EmptyState icon={Images} title="No photos yet">
          Each daily check-in adds a photo here, so you can see how {plant.name} changes over time.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
          {checkIns.map((checkIn) => (
            <figure key={checkIn.dateId} className="space-y-2">
              <div className="aspect-square overflow-hidden rounded-xl bg-sunken shadow-card">
                <img src={checkIn.imageUrl} alt={`${plant.name}, ${formatDateId(checkIn.dateId)}`} className="h-full w-full object-cover" />
              </div>
              <figcaption className="text-[13px] font-medium text-muted">{formatDateId(checkIn.dateId)}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </Page>
  );
}
