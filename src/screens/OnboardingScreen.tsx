import { Leaf, Shield } from 'lucide-react';
import { motion } from 'motion/react';

type Props = {
  onAccept: () => void;
};

export default function OnboardingScreen({ onAccept }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col p-8 items-center justify-center text-center z-10 relative"
    >
      <div className="w-24 h-24 bg-[var(--color-accent)]/10 rounded-full flex items-center justify-center mb-8 border border-[var(--color-accent)]/20 shadow-lg">
        <Leaf size={48} className="text-[var(--color-accent)]" />
      </div>
      <h1 className="text-4xl font-bold mb-4 tracking-tight">Flora AI</h1>
      <p className="text-text-muted mb-8 text-lg">Your intelligent botanical companion.</p>

      <div className="bg-bg-card border border-[var(--color-accent)]/20 rounded-2xl p-6 text-left mb-8 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold mb-3">
          <Shield size={18} className="text-[var(--color-accent)]" /> AI Liability Disclaimer
        </h3>
        <p className="text-sm text-text-muted leading-relaxed mb-4">
          Flora AI provides plant identification and care suggestions through artificial intelligence.
          Information provided is for educational purposes only.
        </p>
        <p className="text-sm text-text-muted leading-relaxed font-bold">
          Do not ingest or handle any unidentified plants. The developer assumes no liability for AI
          hallucinations or inaccuracies.
        </p>
      </div>

      <button
        onClick={onAccept}
        className="w-full bg-[var(--color-accent)] text-bg-main py-4 rounded-[var(--radius-dynamic)] font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
      >
        Accept &amp; Continue
      </button>
    </motion.div>
  );
}
