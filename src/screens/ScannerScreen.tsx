import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Camera, ImagePlus, RefreshCw, ScanLine, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useCamera } from '../hooks/useCamera';
import { Button, Card, cx, Eyebrow, Notice, Page, PageHeader } from '../components/ui';

type Props = {
  mode: 'new_plant' | 'check_in';
  /** The plant being checked in on, when mode is check_in. */
  plantName?: string;
  selectedImage: string | null;
  isScanning: boolean;
  hasApiKey: boolean;
  scanError: string | null;
  onImage: (dataUrl: string) => void;
  onClear: () => void;
  onAnalyze: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
};

const TIPS = [
  'Fill the frame with leaves, and flowers if it has them.',
  'Daylight beats a lamp; avoid strong shadows.',
  'One plant per photo.',
];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ScannerScreen({
  mode,
  plantName,
  selectedImage,
  isScanning,
  hasApiKey,
  scanError,
  onImage,
  onClear,
  onAnalyze,
  onOpenSettings,
  onBack,
}: Props) {
  const { videoRef, state, start, stop, capture } = useCamera();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Release the camera as soon as there is an image to review.
  useEffect(() => {
    if (selectedImage) stop();
  }, [selectedImage, stop]);

  const acceptFile = async (file: File | undefined | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    onImage(await readAsDataUrl(file));
  };

  // A screenshot or copied image can be pasted straight in.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (item) void acceptFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void acceptFile(e.dataTransfer.files?.[0]);
  };

  const takePhoto = () => {
    const shot = capture();
    if (shot) {
      stop();
      onImage(shot);
    }
  };

  const isCheckIn = mode === 'check_in';
  const cameraMessage =
    state === 'starting'
      ? 'Starting camera…'
      : state === 'denied'
        ? 'Camera access was refused. You can still choose a photo.'
        : state === 'unavailable'
          ? 'No camera found. You can still choose a photo.'
          : null;

  return (
    <Page wide className="space-y-7">
      <PageHeader
        title={isCheckIn ? `Check in on ${plantName ?? 'your plant'}` : 'Identify a plant'}
        subtitle={
          isCheckIn
            ? "Take today's photo. Flora compares it with how the plant looked before."
            : 'Photograph it with your webcam, or bring in a photo you already have.'
        }
        onBack={onBack}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            'relative aspect-[4/3] w-full overflow-hidden rounded-2xl',
            selectedImage || state === 'live'
              ? 'bg-black shadow-card'
              : 'border-2 border-dashed transition-colors',
            !selectedImage && state !== 'live' && (dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-sunken'),
          )}
        >
          {selectedImage ? (
            <img
              src={selectedImage}
              alt="Selected plant"
              className={cx('h-full w-full object-contain transition-[filter,opacity]', isScanning && 'opacity-60 blur-[2px]')}
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className={cx('h-full w-full object-cover', state !== 'live' && 'hidden')}
            />
          )}

          {!selectedImage && state !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-accent shadow-card">
                <ImagePlus size={22} />
              </div>
              <p className="text-sm font-medium text-ink">{dragging ? 'Drop to use this photo' : 'Drop a photo here'}</p>
              <p className="max-w-xs text-[13px] text-muted">{cameraMessage ?? 'or paste one with Ctrl+V'}</p>
            </div>
          )}

          {isScanning && (
            <div className="pointer-events-none absolute inset-0">
              <motion.div
                className="h-0.5 w-full bg-white/90 shadow-[0_0_24px_6px_rgba(255,255,255,0.45)]"
                animate={{ top: ['8%', '92%', '8%'] }}
                style={{ position: 'absolute' }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {!hasApiKey && (
            <Notice
              tone="warn"
              title="No AI key yet"
              action={
                <Button size="sm" onClick={onOpenSettings}>
                  Settings
                </Button>
              }
            >
              Add one in Settings to analyse photos.
            </Notice>
          )}

          {scanError && (
            <Notice
              tone="danger"
              title="That didn't work"
              action={
                <Button size="sm" icon={RefreshCw} onClick={onAnalyze} disabled={isScanning}>
                  Retry
                </Button>
              }
            >
              {scanError}
            </Notice>
          )}

          {selectedImage ? (
            <div className="space-y-2.5">
              <Button
                variant="primary"
                size="lg"
                block
                icon={isCheckIn ? Sparkles : ScanLine}
                loading={isScanning}
                disabled={!hasApiKey}
                onClick={onAnalyze}
              >
                {isScanning ? 'Looking closely…' : isCheckIn ? 'Save check-in' : 'Identify plant'}
              </Button>
              <Button variant="ghost" block disabled={isScanning} onClick={onClear}>
                Use a different photo
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {state === 'live' ? (
                <Button variant="primary" size="lg" block icon={Camera} onClick={takePhoto}>
                  Take photo
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  block
                  icon={Camera}
                  loading={state === 'starting'}
                  onClick={() => void start()}
                >
                  Use webcam
                </Button>
              )}
              <Button size="lg" block icon={ImagePlus} onClick={() => fileInput.current?.click()}>
                Choose a photo…
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void acceptFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          <Card className="bg-sunken shadow-none">
            <Eyebrow className="mb-2.5">For the best result</Eyebrow>
            <ul className="space-y-2 text-[13px] leading-relaxed text-muted">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2.5">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
}
