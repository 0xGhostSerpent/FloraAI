import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import type { PlantData } from '../store';
import ErrorCard from '../components/ErrorCard';

type Props = {
  selectedImage: string | null;
  isScanning: boolean;
  scanResult: Partial<PlantData> | null;
  scanMode: 'new_plant' | 'check_in';
  showToxicAlert: boolean;
  hasApiKey: boolean;
  activePlantName?: string;
  scanError: string | null;
  onAnalyze: () => void;
  onSave: () => void;
  onDismissToxicAlert: () => void;
  onBack: () => void;
};

export default function ScannerScreen({
  selectedImage,
  isScanning,
  scanResult,
  scanMode,
  showToxicAlert,
  hasApiKey,
  activePlantName,
  scanError,
  onAnalyze,
  onSave,
  onDismissToxicAlert,
  onBack,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 flex flex-col items-center flex-1 h-full min-h-[70vh]"
    >
      {selectedImage && (
        <div className="w-full flex-1 flex flex-col gap-6 pt-4">
          <div className="w-full relative rounded-[var(--radius-dynamic)] overflow-hidden bg-black aspect-[3/4] max-h-[60vh] shadow-lg dynamic-border">
            <img
              src={selectedImage}
              alt="Preview"
              className={`w-full h-full object-cover ${isScanning ? 'opacity-50 blur-sm' : 'opacity-100'} transition-all`}
            />
            {isScanning && (
              <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden mix-blend-screen">
                <motion.div
                  className="w-full h-2 bg-[var(--color-accent)] shadow-[0_0_30px_5px_var(--color-accent)]"
                  animate={{ y: ['-10%', '600px', '-10%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            )}
            {!isScanning && !scanResult && (
              <button
                onClick={onBack}
                className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-black/50 text-white rounded-full backdrop-blur border border-white/20 hover:bg-black/70"
              >
                <ChevronLeft size={20} />
              </button>
            )}
          </div>

          {scanError && <ErrorCard message={scanError} onRetry={onAnalyze} />}

          {!scanResult ? (
            <button
              onClick={onAnalyze}
              disabled={isScanning || !hasApiKey}
              className="w-full bg-[var(--color-accent)] disabled:opacity-50 disabled:grayscale text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg transition-all flex justify-center items-center gap-2 text-lg active:scale-95"
            >
              {isScanning ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-bg-main/30 border-t-bg-main rounded-full animate-spin" />
                  Analyzing Profile...
                </div>
              ) : !hasApiKey ? (
                'API Key Missing (Settings)'
              ) : (
                'Analyze Plant'
              )}
            </button>
          ) : showToxicAlert ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-red-500 rounded-[var(--radius-dynamic)] shadow-lg p-6 dynamic-border relative border border-black/10"
            >
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
                  {scanResult.toxicityDetails || 'This plant contains toxic properties.'}
                </p>
              </div>
              <button
                onClick={onDismissToxicAlert}
                className="w-full bg-white text-red-600 py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg flex justify-center items-center gap-2"
              >
                I Understand
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-bg-card rounded-[var(--radius-dynamic)] shadow-lg p-6 dynamic-border relative"
            >
              <div className="mb-4 pr-10">
                <h2 className="text-2xl font-bold text-text-main leading-tight">
                  {scanResult.name || activePlantName}
                </h2>
                {scanResult.isToxic && (
                  <div className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mt-2 border border-red-500/20">
                    <AlertTriangle size={12} /> Toxic Plant
                  </div>
                )}
                <p className="text-[var(--color-accent)] text-xs font-bold uppercase mt-2">Health Assessment</p>
                <p className="text-sm font-medium text-text-muted mt-1">{scanResult.healthStatus}</p>
              </div>
              {scanMode === 'new_plant' && (
                <div className="p-4 bg-bg-main rounded-[var(--radius-dynamic)] mb-6 border border-black/5">
                  <p className="text-sm text-text-muted leading-relaxed italic border-l-2 border-[var(--color-accent)] pl-3">
                    &quot;{scanResult.personality}&quot;
                  </p>
                </div>
              )}
              <button
                onClick={onSave}
                className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg"
              >
                {scanMode === 'new_plant' ? 'Save to Garden' : 'Confirm Check-in'}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
