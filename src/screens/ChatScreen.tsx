import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Activity, AlertTriangle, Camera, History, Lock, MapPin, Send, Store, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  onDeleteMessage?: (messageId: string) => void;
  onClearHistory?: () => void;
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
  onDeleteMessage,
  onClearHistory,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatLoading]);

  const checkedInToday = plant.checkIns?.find((c) => c.dateId === getTodayDateId());

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col px-4 z-10 h-full max-h-[calc(100vh-80px)] overflow-hidden"
    >
      {/* Top Header Card */}
      <div className="shrink-0 flex items-center justify-between mb-2.5 bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-3 dynamic-shadow">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 dynamic-border shadow-inner">
            <img src={plant.imageUrl} alt={plant.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="font-bold text-text-main text-sm leading-tight truncate">{plant.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
              <p className="text-[10px] text-[var(--color-accent)] font-semibold truncate">
                Botanical Companion • Active
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {messages.length > 0 && onClearHistory && (
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Clear all chat messages"
              className="w-8 h-8 bg-bg-main rounded-full flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-500/10 dynamic-border transition-colors shadow-sm"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={onOpenHistory}
            title="View photo check-in history"
            className="w-8 h-8 bg-bg-main rounded-full flex items-center justify-center text-[var(--color-accent)] hover:brightness-110 dynamic-border transition-colors shadow-sm"
          >
            <History size={14} />
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-5 max-w-xs w-full shadow-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-bold text-text-main text-base">Clear Chat History?</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  This will delete messages with {plant.name}. Your garden specimen and photo check-in records will be preserved.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl dynamic-border bg-bg-main text-text-main text-xs font-bold hover:brightness-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClearHistory?.();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold shadow-md hover:bg-red-600 active:scale-95 transition-all"
                >
                  Clear Messages
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Shortcut Pills */}
      <div className="shrink-0 flex gap-2 mb-2.5">
        {[
          { label: 'Health Status', icon: Activity, onClick: onPlantStatus },
          { label: 'Where to Buy', icon: Store, onClick: onWhereToBuy },
          { label: 'Wild Habitat', icon: MapPin, onClick: onFindInWild },
        ].map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex-1 bg-bg-card dynamic-border rounded-xl py-2 flex items-center justify-center gap-1.5 text-text-muted hover:text-[var(--color-accent)] hover:brightness-105 active:scale-[0.98] transition-all shadow-sm"
          >
            <Icon size={13} className="text-[var(--color-accent)]" />
            <span className="text-[10px] font-bold tracking-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 min-h-0 bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] overflow-hidden p-3.5 flex flex-col dynamic-shadow">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {/* Welcome greeting */}
          <div className="flex justify-start">
            <div className="bg-bg-main p-3.5 rounded-2xl rounded-tl-sm max-w-[85%] text-xs leading-relaxed shadow-sm font-medium border border-text-muted/10 text-text-main">
              *rustles leaves* Greetings! I&apos;m your {plant.name}. {plant.personality} Complete a daily photo check-in anytime to keep our connection active!
            </div>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 max-w-[88%]">
                {msg.role === 'user' && onDeleteMessage && (
                  <button
                    onClick={() => onDeleteMessage(msg.id)}
                    title="Delete message"
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-opacity rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                )}

                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm break-words ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-accent)] text-bg-main rounded-tr-sm font-semibold'
                      : 'bg-bg-main rounded-tl-sm text-text-main border border-text-muted/10 font-medium'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.role === 'model' && onDeleteMessage && (
                  <button
                    onClick={() => onDeleteMessage(msg.id)}
                    title="Delete message"
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-opacity rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {msg.timestamp && (
                <span className="text-[9px] text-text-muted/70 px-1 mt-0.5 font-medium">
                  {formatTime(msg.timestamp)}
                </span>
              )}
            </div>
          ))}

          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-bg-main p-3 rounded-2xl rounded-tl-sm text-xs border border-text-muted/10 shadow-sm">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="flex gap-1.5 items-center justify-center p-1"
                >
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </motion.div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Chat Input Bar */}
      <div className="shrink-0 bg-bg-card dynamic-border rounded-[var(--radius-dynamic)] p-3 mt-2.5 dynamic-shadow">
        {checkedInToday ? (
          <div>
            <div className="flex gap-2 items-center">
              <input
                value={chatMessage}
                onChange={(e) => onChangeMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSend()}
                placeholder={`Message ${plant.name}...`}
                disabled={!hasApiKey || isChatLoading}
                className="flex-1 bg-bg-main border border-text-muted/30 rounded-full px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-text-muted disabled:opacity-50 text-text-main font-medium"
              />
              <button
                onClick={onSend}
                disabled={isChatLoading || !chatMessage.trim() || !hasApiKey}
                className="w-10 h-10 shrink-0 bg-[var(--color-accent)] disabled:opacity-50 rounded-full flex items-center justify-center text-bg-main hover:brightness-110 shadow-md transition-all active:scale-95"
              >
                <Send size={15} className="ml-0.5 shrink-0" />
              </button>
            </div>
            <p className="text-[9px] text-text-muted/70 text-center mt-1.5 leading-tight font-medium">
              Flora AI botanical companion. Ask questions about watering, sunlight, soil, and care.
            </p>
          </div>
        ) : (
          <div className="p-2 flex flex-col items-center text-center space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
              <Lock size={14} className="text-[var(--color-accent)]" />
              <span>Chat Locked for Today</span>
            </div>
            <p className="text-[11px] text-text-muted leading-tight font-medium max-w-xs">
              Complete your daily photo check-in to unlock and chat with this plant.
            </p>

            <label className="w-full max-w-xs cursor-pointer bg-[var(--color-accent)] text-bg-main py-2.5 rounded-xl font-bold text-xs hover:brightness-110 shadow-md transition-all flex justify-center items-center gap-2 active:scale-95">
              <Camera size={14} /> Take Daily Plant Photo
              <input type="file" accept="image/*" className="hidden" onChange={onCheckInPhoto} />
            </label>
          </div>
        )}
      </div>
    </motion.div>
  );
}
