import { AlertTriangle, Activity, Ban, Camera, Leaf, MapPin, Store } from 'lucide-react';
import { motion } from 'motion/react';
import type { Identification } from '../services/ai';

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
  onBackToScanner?: () => void;
};

type ActionProps = {
  icon: typeof Leaf;
  title: string;
  detail: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
};

function ActionCard({ icon: Icon, title, detail, onClick, primary, disabled }: ActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-[var(--radius-dynamic)] transition-all active:scale-[0.98] flex items-center gap-4 disabled:opacity-50 ${
        primary
          ? 'bg-[var(--color-accent)] text-bg-main shadow-lg'
          : 'bg-bg-card text-text-main dynamic-border hover:brightness-95'
      }`}
    >
      <Icon size={22} className="shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm leading-tight">{title}</span>
        <span className={`block text-xs mt-0.5 ${primary ? 'opacity-80' : 'text-text-muted'}`}>
          {detail}
        </span>
      </span>
    </button>
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
}: Props) {
  // Non-plant rejection screen: only botanic specimens are accepted.
  if (result.isPlant === false) {
    const detectedName = result.detectedObject || result.name || 'Non-plant object';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="px-6 pb-6 pt-2 space-y-5"
      >
        <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 text-center flex flex-col items-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Ban size={32} />
          </div>

          <div className="relative w-32 h-32 rounded-2xl overflow-hidden dynamic-border shadow-md">
            <img src={image} alt="Scanned item" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20" />
          </div>

          <div>
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest bg-amber-500/15 text-amber-500 px-3 py-1 rounded-full mb-2">
              Not a Plant / Botanical Specimen
            </span>
            <h2 className="text-xl font-bold text-text-main leading-snug">
              {detectedName}
            </h2>
            <p className="text-xs text-text-muted mt-2 leading-relaxed max-w-xs mx-auto">
              {result.rejectionReason ||
                'Flora AI is specialized strictly for identifying, caring for, and finding plants, trees, and flowers. Non-botanical items cannot be added to your garden or searched in nurseries.'}
            </p>
          </div>

          <button
            onClick={onBackToScanner}
            className="w-full bg-[var(--color-accent)] text-bg-main py-3.5 rounded-[var(--radius-dynamic)] font-bold text-sm shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
          >
            <Camera size={18} />
            Scan a Plant Instead
          </button>
        </div>
      </motion.div>
    );
  }

  // The toxicity warning must be acknowledged before anything else is offered.
  if (showToxicAlert) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-6 pb-6 pt-2"
      >
        <div className="bg-red-500 rounded-[var(--radius-dynamic)] shadow-lg p-6 border border-black/10">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={32} className="text-white shrink-0 animate-pulse" />
            <h2 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">
              Toxicity Alert
            </h2>
          </div>
          <div className="text-red-100 mb-6 bg-black/20 p-4 rounded-xl border border-white/10">
            <p className="text-xs uppercase tracking-widest font-bold text-red-200 mb-1 opacity-80">
              Assessment Details
            </p>
            <p className="font-medium text-sm leading-relaxed">
              {result.toxicityDetails || 'This plant contains toxic properties.'}
            </p>
          </div>
          <button
            onClick={onDismissToxicAlert}
            className="w-full bg-white text-red-600 py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg"
          >
            I Understand
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="px-6 pb-6 pt-2 space-y-5"
    >
      <div className="flex gap-4 items-start">
        <img
          src={image}
          alt={result.name}
          className="w-24 h-24 rounded-[var(--radius-dynamic)] object-cover dynamic-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-text-main leading-tight">{result.name}</h2>
          <p className="text-xs text-text-muted italic mt-0.5 truncate">{result.scientificName}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {typeof result.confidence === 'number' && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-1 rounded-md">
                {Math.round(result.confidence * 100)}% confident
              </span>
            )}
            {result.isToxic && (
              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-red-500/20">
                <AlertTriangle size={11} /> Toxic
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-4">
        <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest mb-1">
          Health assessment
        </p>
        <p className="text-sm text-text-muted leading-relaxed">{result.healthStatus}</p>
      </div>

      <div className="space-y-2.5">
        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
          What would you like to do?
        </p>

        <ActionCard
          icon={Leaf}
          title={isSaved ? 'Saved to your garden' : 'Add to Garden'}
          detail={isSaved ? 'Already tracking this plant' : 'Track it and check in over time'}
          onClick={onAddToGarden}
          primary={!isSaved}
          disabled={isSaved}
        />
        <ActionCard
          icon={Activity}
          title="Plant Status"
          detail="Hydration, leaves, light, and what to do next"
          onClick={onPlantStatus}
        />
        <ActionCard
          icon={Store}
          title="Where to Buy"
          detail="Nearby nurseries, estimated price, and directions"
          onClick={onWhereToBuy}
        />
        <ActionCard
          icon={MapPin}
          title="Find in the Wild"
          detail="Real recorded sightings and native range"
          onClick={onFindInWild}
        />
      </div>

      <div className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-4">
        <p className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-widest mb-1">
          Care
        </p>
        <p className="text-sm text-text-muted leading-relaxed">{result.careInstructions}</p>
      </div>
    </motion.div>
  );
}

