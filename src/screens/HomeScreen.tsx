import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Cloud,
  CloudCheck,
  Info,
  Leaf,
  Lock,
  RefreshCw,
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
  driveSyncing?: boolean;
  lastDriveSync?: number | null;
  onOpenSettings: () => void;
  onOpenPlant: (plant: PlantData) => void;
};

function StreakIcon({ appTheme, streak }: { appTheme: string; streak: number }) {
  if (appTheme === 'theme-gamified') {
    return (
      <div className="flex items-center gap-1.5 bg-bg-card px-3 py-1 rounded-full dynamic-border dynamic-shadow">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
        <span className="font-bold text-xs text-[var(--color-accent)]">
          {streak}d Streak
        </span>
      </div>
    );
  }
  if (appTheme === 'theme-cyber') {
    return (
      <div className="flex items-center gap-1.5 bg-bg-card px-3 py-1 rounded-full dynamic-border dynamic-shadow">
        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
        <span className="font-bold text-xs text-[var(--color-accent)] tracking-wide">
          {streak}d Link
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 bg-bg-card px-3 py-1 rounded-full dynamic-border dynamic-shadow">
      <Sun size={14} className={streak > 0 ? 'text-amber-500 fill-amber-500/20' : 'text-neutral-400'} />
      <span className={`text-xs font-bold ${streak > 0 ? 'text-[var(--color-accent)]' : 'text-neutral-500'}`}>
        {streak}d Streak
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
  driveSyncing,
  lastDriveSync,
  onOpenSettings,
  onOpenPlant,
}: Props) {
  const checkedInToday = lastCheckInDate === getTodayDateId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="px-5 py-6 space-y-5"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
            <Leaf className="w-6 h-6 text-[var(--color-accent)]" /> Flora{' '}
            <span className="text-[var(--color-accent)] font-medium -ml-1.5">AI</span>
          </h1>
          {lastDriveSync ? (
            <p className="text-[10px] text-text-muted font-medium flex items-center gap-1 mt-0.5">
              {driveSyncing ? (
                <>
                  <RefreshCw size={10} className="animate-spin text-[var(--color-accent)]" /> Syncing to Google Drive…
                </>
              ) : (
                <>
                  <Cloud size={10} className="text-[var(--color-accent)]" /> Synced to Drive
                </>
              )}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2.5">
          <StreakIcon appTheme={appTheme} streak={streak} />
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center dynamic-border shadow-sm hover:brightness-110 active:scale-95 transition-all"
            aria-label="Settings"
          >
            <SettingsIcon size={18} className="text-text-main" />
          </button>
        </div>
      </header>

      <div className="bg-bg-card dynamic-shadow dynamic-border p-4.5 flex justify-between items-center rounded-[var(--radius-dynamic)]">
        <div>
          <p className="text-[11px] text-[var(--color-accent)] font-bold tracking-wider uppercase mb-0.5">
            Daily Care Check-in
          </p>
          <p className="font-semibold text-sm text-text-main">
            {checkedInToday ? 'Garden check-in completed!' : 'Check in with a plant photo'}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            checkedInToday
              ? 'bg-[var(--color-accent)] text-bg-main shadow-md'
              : 'bg-bg-main border border-text-muted/30 text-text-muted'
          }`}
        >
          {checkedInToday ? <CheckCircle2 size={20} /> : <Camera size={18} />}
        </div>
      </div>

      {!hasApiKey && (
        <div
          className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-dynamic)] p-4 flex gap-3.5 items-start cursor-pointer hover:bg-amber-500/15 transition-colors"
          onClick={onOpenSettings}
        >
          <Info size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-500 text-xs uppercase tracking-wider mb-0.5">Setup AI Key</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Configure your Gemini or AI API Key in settings to enable identification and chatbot.
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-3.5">
          <h2 className="text-lg font-bold text-text-main">Your Garden</h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-bg-card rounded-full dynamic-border text-text-muted">
            {plants.length} {plants.length === 1 ? 'specimen' : 'specimens'}
          </span>
        </div>

        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 bg-bg-card dynamic-shadow dynamic-border rounded-[var(--radius-dynamic)]">
            <div className="w-14 h-14 bg-[var(--color-accent)]/10 rounded-full flex items-center justify-center text-[var(--color-accent)]">
              <Leaf size={28} />
            </div>
            <div>
              <h3 className="font-bold text-text-main text-sm mb-1">Your Garden is Empty</h3>
              <p className="text-xs text-text-muted leading-relaxed max-w-xs">
                Take a photo or scan any houseplant, flower, or tree to start tracking and chatting with your botanical avatars.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {plants.map((plant) => {
              const hasCheckedInToday = plant.checkIns?.some((c) => c.dateId === getTodayDateId());
              return (
                <div
                  key={plant.id}
                  onClick={() => onOpenPlant(plant)}
                  className="bg-bg-card dynamic-shadow overflow-hidden cursor-pointer group hover:brightness-95 active:scale-[0.98] transition-all flex flex-col h-[220px] relative dynamic-border rounded-[var(--radius-dynamic)] justify-between"
                >
                  <div className="absolute top-2.5 right-2.5 z-20 w-6 h-6 rounded-full bg-bg-main/80 backdrop-blur flex items-center justify-center dynamic-border shadow-sm">
                    {hasCheckedInToday ? (
                      <Unlock size={12} className="text-[var(--color-accent)]" />
                    ) : (
                      <Lock size={12} className="text-text-muted" />
                    )}
                  </div>

                  {plant.isToxic && (
                    <div className="absolute top-2.5 left-2.5 z-20 px-1.5 py-0.5 rounded bg-red-500/90 backdrop-blur text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-sm">
                      <AlertTriangle size={9} /> Toxic
                    </div>
                  )}

                  {/* Standardized Aspect Ratio Image Container */}
                  <div className="h-[140px] w-full bg-bg-main relative overflow-hidden shrink-0">
                    <img
                      src={plant.imageUrl}
                      alt={plant.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-50"></div>
                  </div>

                  {/* Standardized Meta Footer */}
                  <div className="p-3 bg-bg-card flex-1 flex flex-col justify-center border-t border-text-muted/10">
                    <h3 className="font-bold text-text-main text-xs truncate leading-tight">
                      {plant.name}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-text-muted mt-1 font-medium">
                      <span className="truncate italic max-w-[80px]">
                        {plant.scientificName || 'Botanic avatar'}
                      </span>
                      <span className="shrink-0 text-[var(--color-accent)] font-semibold">
                        {plant.checkIns?.length || 1} check-in{(plant.checkIns?.length || 1) !== 1 ? 's' : ''}
                      </span>
                    </div>
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

