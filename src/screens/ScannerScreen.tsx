import { useEffect, type ChangeEvent } from 'react';
import { Camera, ChevronLeft, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import ErrorCard from '../components/ErrorCard';
import { useCamera } from '../hooks/useCamera';

type Props = {
  selectedImage: string | null;
  isScanning: boolean;
  hasApiKey: boolean;
  scanError: string | null;
  onCaptured: (dataUrl: string) => void;
  onPickFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: () => void;
  onBack: () => void;
};

export default function ScannerScreen({
  selectedImage,
  isScanning,
  hasApiKey,
  scanError,
  onCaptured,
  onPickFile,
  onAnalyze,
  onBack,
}: Props) {
  const { videoRef, state, start, stop, capture } = useCamera();

  // Release the camera as soon as there is an image to review.
  useEffect(() => {
    if (selectedImage) stop();
  }, [selectedImage, stop]);

  const takePhoto = () => {
    const shot = capture();
    if (shot) {
      stop();
      onCaptured(shot);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="p-6 flex flex-col items-center flex-1 h-full min-h-[70vh] gap-6"
    >
      <div className="w-full relative rounded-[var(--radius-dynamic)] overflow-hidden bg-black aspect-[3/4] max-h-[55vh] shadow-lg dynamic-border">
        {selectedImage ? (
          <img
            src={selectedImage}
            alt="Preview"
            className={`w-full h-full object-cover ${isScanning ? 'opacity-50 blur-sm' : 'opacity-100'} transition-all`}
          />
        ) : (
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        )}

        {isScanning && (
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden mix-blend-screen">
            <motion.div
              className="w-full h-2 bg-[var(--color-accent)] shadow-[0_0_30px_5px_var(--color-accent)]"
              animate={{ y: ['-10%', '600px', '-10%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {!selectedImage && state !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4 text-white/70">
            <Camera size={40} />
            <p className="text-sm font-medium">
              {state === 'starting'
                ? 'Starting camera…'
                : state === 'denied'
                  ? 'Camera permission was refused.'
                  : state === 'unavailable'
                    ? 'No camera found on this computer.'
                    : 'Use your camera, or upload a photo.'}
            </p>
          </div>
        )}

        {!isScanning && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-black/50 text-white rounded-full backdrop-blur border border-white/20 hover:bg-black/70"
          >
            <ChevronLeft size={20} />
          </button>
        )}
      </div>

      {scanError && <ErrorCard message={scanError} onRetry={onAnalyze} />}

      {selectedImage ? (
        <button
          onClick={onAnalyze}
          disabled={isScanning || !hasApiKey}
          className="w-full bg-[var(--color-accent)] disabled:opacity-50 disabled:grayscale text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg transition-all flex justify-center items-center gap-2 text-lg active:scale-95"
        >
          {isScanning ? (
            <span className="flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-bg-main/30 border-t-bg-main rounded-full animate-spin" />
              Analyzing…
            </span>
          ) : !hasApiKey ? (
            'API Key Missing (Settings)'
          ) : (
            'Analyze Plant'
          )}
        </button>
      ) : (
        <div className="w-full flex flex-col gap-3">
          {state === 'live' ? (
            <button
              onClick={takePhoto}
              className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg flex justify-center items-center gap-2"
            >
              <Camera size={20} /> Take photo
            </button>
          ) : (
            <button
              onClick={start}
              disabled={state === 'starting'}
              className="w-full bg-[var(--color-accent)] disabled:opacity-50 text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform text-lg flex justify-center items-center gap-2"
            >
              <Camera size={20} /> Use camera
            </button>
          )}

          {/* Always available: many desktops have no webcam at all. */}
          <label className="w-full cursor-pointer bg-bg-card text-text-main dynamic-border py-4 rounded-[var(--radius-dynamic)] font-bold text-sm hover:brightness-95 transition-all flex justify-center items-center gap-2">
            <Upload size={18} /> Upload an image
            <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </label>
        </div>
      )}
    </motion.div>
  );
}
