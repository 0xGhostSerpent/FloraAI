import { useEffect, useRef, type ChangeEvent } from 'react';
import { Activity, Camera, History, Lock, MapPin, Send, Store } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatMessage, PlantData } from '../store';
import { getTodayDateId } from '../lib/dates';

type Props = {
  plant: PlantData;
  messages: ChatMessage[];
  chatMessage: string;
  isChatLoading: boolean;
  hasApiKey: boolean;
  onChangeMessage: (value: string) => void;
  onSend: () => void;
  onOpenHistory: () => void;
  onCheckInPhoto: (e: ChangeEvent<HTMLInputElement>) => void;
  onPlantStatus: () => void;
  onWhereToBuy: () => void;
  onFindInWild: () => void;
};

export default function ChatScreen({
  plant,
  messages,
  chatMessage,
  isChatLoading,
  hasApiKey,
  onChangeMessage,
  onSend,
  onOpenHistory,
  onCheckInPhoto,
  onPlantStatus,
  onWhereToBuy,
  onFindInWild,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatLoading]);

  const checkedInToday = plant.checkIns?.find((c) => c.dateId === getTodayDateId());

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col px-4 z-10 h-full min-h-[90vh]"
    >
      <div className="flex items-center justify-between mb-4 mt-2">
        <div className="flex flex-col">
          <h2 className="font-bold text-text-main text-lg leading-tight">{plant.name}</h2>
          <p className="text-xs text-[var(--color-accent)] font-medium">Plant Avatar</p>
        </div>
        <button
          onClick={onOpenHistory}
          className="w-10 h-10 bg-bg-card rounded-full flex items-center justify-center text-[var(--color-accent)] shadow-sm border border-text-muted/10 hover:brightness-110"
        >
          <History size={18} />
        </button>
      </div>

      {/* The same actions offered at capture time, for a plant already saved. */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'Status', icon: Activity, onClick: onPlantStatus },
          { label: 'Buy', icon: Store, onClick: onWhereToBuy },
          { label: 'In the wild', icon: MapPin, onClick: onFindInWild },
        ].map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex-1 bg-bg-card dynamic-border rounded-xl py-2 flex flex-col items-center gap-1 text-text-muted hover:text-[var(--color-accent)] transition-colors"
          >
            <Icon size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 bg-bg-card dynamic-border rounded-t-[var(--radius-dynamic)] overflow-hidden border-b-0 p-4 flex flex-col shadow-sm">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-4">
          <div className="flex justify-start">
            <div className="bg-bg-main p-4 rounded-2xl rounded-tl-sm max-w-[85%] text-sm text-text-main leading-relaxed shadow-sm font-medium border border-text-muted/10">
              *rustles* It&apos;s me, your {plant.name}. {plant.personality} Check in with me to unlock our chat!
            </div>
          </div>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`p-3.5 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[var(--color-accent)] text-bg-main rounded-tr-sm font-semibold'
                    : 'bg-bg-main rounded-tl-sm text-text-main border border-text-muted/10'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-bg-main p-3.5 rounded-2xl rounded-tl-sm text-sm border border-text-muted/10">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex gap-1.5 items-center justify-center p-1"
                >
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></div>
                </motion.div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 bg-transparent">
          {checkedInToday ? (
            <div>
              <div className="flex gap-2">
                <input
                  value={chatMessage}
                  onChange={(e) => onChangeMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSend()}
                  placeholder="Message..."
                  disabled={!hasApiKey}
                  className="flex-1 bg-bg-main border border-text-muted/30 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-text-muted disabled:opacity-50 text-text-main"
                />
                <button
                  onClick={onSend}
                  disabled={isChatLoading || !chatMessage.trim() || !hasApiKey}
                  className="w-12 h-12 shrink-0 bg-[var(--color-accent)] disabled:opacity-50 rounded-full flex items-center justify-center text-bg-main hover:brightness-110 shadow-lg transition-all"
                >
                  <Send size={18} className="ml-1 shrink-0" />
                </button>
              </div>
              <p className="text-[10px] text-text-muted opacity-80 text-center mt-3 mb-1 px-4 leading-tight shrink-0 font-medium">
                AI toxicity identification is informational only and assumes no liability. Do not ingest
                plants without professional verification.
              </p>
            </div>
          ) : (
            <div className="bg-bg-main border border-[var(--color-accent)]/30 rounded-[var(--radius-dynamic)] p-4 flex flex-col items-center text-center shadow-inner">
              <Lock size={20} className="text-[var(--color-accent)] mb-2" />
              <h4 className="text-sm font-bold text-text-main mb-1">Chat Locked</h4>
              <p className="text-xs text-text-muted mb-3 font-medium">
                Complete your daily check-in to chat.
              </p>

              <label className="w-full cursor-pointer bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30 py-3 rounded-[var(--radius-dynamic)] font-bold text-sm hover:bg-[var(--color-accent)]/20 transition-colors flex justify-center items-center gap-2">
                <Camera size={16} /> Daily Photo
                <input type="file" accept="image/*" className="hidden" onChange={onCheckInPhoto} />
              </label>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
