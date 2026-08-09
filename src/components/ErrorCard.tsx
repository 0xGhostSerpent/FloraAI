import { AlertTriangle, RotateCw } from 'lucide-react';

type Props = {
  message: string;
  onRetry?: () => void;
};

export default function ErrorCard({ message, onRetry }: Props) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-[var(--radius-dynamic)] p-5 flex gap-4 items-start">
      <AlertTriangle size={22} className="text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-text-main leading-relaxed font-medium">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-red-500 hover:brightness-125"
          >
            <RotateCw size={14} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
