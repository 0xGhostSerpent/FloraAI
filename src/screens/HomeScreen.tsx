import {
  Camera,
  CheckCircle2,
  Info,
  Leaf,
  Lock,
  Settings as SettingsIcon,
  Sun,
  Unlock,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { PlantData } from '../store';
import { getTodayDateId } from '../lib/dates';

type Props = {
  plants: PlantData[];
  streak: number;
  appTheme: string;
  lastCheckInDate: string | null;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onOpenPlant: (plant: PlantData) => void;
};

function StreakIcon({ appTheme, streak }: { appTheme: string; streak: number }) {
  if (appTheme === 'theme-gamified') {
    return (
      <span className="font-black text-xs px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-lg">
        Lvl {streak}
      </span>
    );
  }
  if (appTheme === 'theme-cyber') {
    return (
      <span className="font-bold text-xs uppercase tracking-widest text-[#39FF14]">
        Link: {streak * 10}%
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 opacity-80">
      <Sun size={18} className={streak > 0 ? 'text-yellow-600' : 'text-neutral-400'} />
      <span className={`text-sm font-semibold ${streak > 0 ? 'text-yellow-700' : 'text-neutral-500'}`}>
        {streak}
      </span>
    </div>
  );
}

export default function HomeScreen({
  plants,
  streak,
  appTheme,
  lastCheckInDate,
  hasApiKey,
  onOpenSettings,
  onOpenPlant,
}: Props) {
  const checkedInToday = lastCheckInDate === getTodayDateId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="px-6 py-6 space-y-6"
    >
      <header className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
          <Leaf className="w-6 h-6 text-[var(--color-accent)]" /> Flora{' '}
          <span className="text-[var(--color-accent)] font-medium -ml-1">AI</span>
        </h1>
        <div className="flex items-center gap-3">
          <StreakIcon appTheme={appTheme} streak={streak} />
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity"
          >
            <SettingsIcon size={20} className="text-text-main" />
          </button>
        </div>
      </header>

      <div className="bg-bg-card dynamic-shadow dynamic-border p-5 flex justify-between items-center rounded-[var(--radius-dynamic)]">
        <div>
          <p className="text-xs text-[var(--color-accent)] font-bold tracking-wider uppercase mb-1">
            Today&apos;s Check-in
          </p>
          <p className="font-semibold text-sm">
            {checkedInToday ? 'Completed!' : 'Take a photo of a plant'}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            checkedInToday
              ? 'bg-[var(--color-accent)] text-bg-main shadow-lg'
              : 'bg-transparent border border-text-muted/30 text-text-muted'
          }`}
        >
          {checkedInToday ? <CheckCircle2 size={20} /> : <Camera size={18} />}
        </div>
      </div>

      {!hasApiKey && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-[var(--radius-dynamic)] p-5 flex gap-4 items-start cursor-pointer transition-colors"
          onClick={onOpenSettings}
        >
          <Info size={24} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-500 text-sm mb-1">Action Required</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Please configure your Gemini API Key in settings to unlock AI capabilities.
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-bold text-text-main">Your Garden</h2>
          <span className="text-xs text-text-muted font-medium">{plants.length} plants saved</span>
        </div>

        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-6 bg-bg-card dynamic-shadow dynamic-border rounded-[var(--radius-dynamic)]">
            <div className="w-16 h-16 bg-[var(--color-accent)]/10 rounded-full flex items-center justify-center text-[var(--color-accent)]">
              <Leaf size={32} />
            </div>
            <p className="text-sm font-medium text-text-muted">
              No plants tracked yet.
              <br />
              Scan to grow your garden.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {plants.map((plant) => {
              const hasCheckedInToday = plant.checkIns?.some((c) => c.dateId === getTodayDateId());
              return (
                <div
                  key={plant.id}
                  onClick={() => onOpenPlant(plant)}
                  className="bg-bg-card dynamic-shadow overflow-hidden cursor-pointer group hover:brightness-95 transition-all flex flex-col h-full relative dynamic-border rounded-[var(--radius-dynamic)]"
                >
                  <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-bg-main/80 backdrop-blur flex items-center justify-center border border-black/10">
                    {hasCheckedInToday ? (
                      <Unlock size={12} className="text-[var(--color-accent)]" />
                    ) : (
                      <Lock size={12} className="text-text-muted" />
                    )}
                  </div>
                  <div className="aspect-square bg-gray-200 relative">
                    <img
                      src={plant.imageUrl}
                      alt={plant.name}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 mt-10"></div>
                  </div>
                  <div className="p-3 bg-bg-card -mt-8 relative z-10">
                    <h3 className="font-bold text-text-main text-sm truncate leading-tight">{plant.name}</h3>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {plant.checkIns?.length || 1} check-ins
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
