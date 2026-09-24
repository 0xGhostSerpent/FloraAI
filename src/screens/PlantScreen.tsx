import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  Eraser,
  MapPin,
  MessageCircle,
  Store,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ChatMessage, PlantData } from '../store';
import { formatDateId, getTodayDateId, parseDateId } from '../lib/dates';
import { Badge, Button, ConfirmDialog, cx, Eyebrow, IconButton, Textarea } from '../components/ui';

type Props = {
  plant: PlantData;
  messages: ChatMessage[];
  chatMessage: string;
  isChatLoading: boolean;
  hasApiKey: boolean;
  onChangeMessage: (value: string) => void;
  onSend: () => void;
  onOpenHistory: () => void;
  onCheckIn: () => void;
  onPlantStatus: () => void;
  onWhereToBuy: () => void;
  onFindInWild: () => void;
  onDeleteMessage: (messageId: string) => void;
  onClearHistory: () => void;
  onRemovePlant: () => void;
  onBack: () => void;
};

function LinkRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-sunken"
    >
      <Icon size={17} className="text-muted" />
      {label}
    </button>
  );
}

const timeOf = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function PlantScreen({
  plant,
  messages,
  chatMessage,
  isChatLoading,
  hasApiKey,
  onChangeMessage,
  onSend,
  onOpenHistory,
  onCheckIn,
  onPlantStatus,
  onWhereToBuy,
  onFindInWild,
  onDeleteMessage,
  onClearHistory,
  onRemovePlant,
  onBack,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [confirm, setConfirm] = useState<'clear' | 'remove' | null>(null);

  const checkedInToday = plant.checkIns?.some((c) => c.dateId === getTodayDateId());
  const recent = [...(plant.checkIns ?? [])]
    .sort((a, b) => (parseDateId(b.dateId)?.getTime() ?? 0) - (parseDateId(a.dateId)?.getTime() ?? 0))
    .slice(0, 4);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isChatLoading]);

  // Grow the composer with its content, up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [chatMessage]);

  const canSend = hasApiKey && !isChatLoading && chatMessage.trim().length > 0;

  return (
    <div className="flex h-full min-h-0">
      {/* Profile column */}
      <aside className="w-[290px] shrink-0 overflow-y-auto border-r border-line px-6 py-7 xl:w-[340px]">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-5 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Garden
        </button>

        <img src={plant.imageUrl} alt={plant.name} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-card" />

        <h1 className="mt-5 font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {plant.name}
        </h1>
        {plant.scientificName && <p className="text-sm italic text-muted">{plant.scientificName}</p>}

        {plant.isToxic && (
          <div className="mt-3">
            <Badge tone="danger" icon={AlertTriangle}>
              Toxic to people and pets
            </Badge>
          </div>
        )}

        <div className="mt-5">
          {checkedInToday ? (
            <Button variant="soft" block icon={Check} onClick={onCheckIn}>
              Checked in today
            </Button>
          ) : (
            <Button variant="primary" block icon={Camera} onClick={onCheckIn}>
              Check in today
            </Button>
          )}
        </div>

        <nav className="-mx-3 mt-4 space-y-0.5">
          <LinkRow icon={Activity} label="Health check" onClick={onPlantStatus} />
          <LinkRow icon={Store} label="Where to buy" onClick={onWhereToBuy} />
          <LinkRow icon={MapPin} label="In the wild" onClick={onFindInWild} />
        </nav>

        {recent.length > 0 && (
          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-2.5 flex items-center justify-between">
              <Eyebrow>Photo diary</Eyebrow>
              <button type="button" onClick={onOpenHistory} className="text-[13px] font-medium text-accent hover:underline">
                See all {plant.checkIns.length}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {recent.map((checkIn) => (
                <button
                  key={checkIn.dateId}
                  type="button"
                  onClick={onOpenHistory}
                  title={formatDateId(checkIn.dateId)}
                  className="aspect-square overflow-hidden rounded-lg bg-sunken"
                >
                  <img src={checkIn.imageUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {(plant.healthStatus || plant.careInstructions) && (
          <div className="mt-6 space-y-5 border-t border-line pt-5">
            {plant.healthStatus && (
              <div>
                <Eyebrow className="mb-1.5">Last assessment</Eyebrow>
                <p className="text-[13px] leading-relaxed text-ink">{plant.healthStatus}</p>
              </div>
            )}
            {plant.careInstructions && (
              <div>
                <Eyebrow className="mb-1.5">Care</Eyebrow>
                <p className="text-[13px] leading-relaxed text-ink">{plant.careInstructions}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <Button variant="ghost" size="sm" icon={Trash2} className="-ml-3 hover:text-danger" onClick={() => setConfirm('remove')}>
            Remove from garden
          </Button>
        </div>
      </aside>

      {/* Conversation column */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MessageCircle size={16} className="text-muted" /> Chat with {plant.name}
          </p>
          {messages.length > 0 && (
            <IconButton icon={Eraser} label="Clear conversation" tone="danger" onClick={() => setConfirm('clear')} />
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-sunken px-4 py-2.5 text-sm leading-relaxed text-ink">
                Hi, I'm your {plant.name}. Ask me about watering, light, soil, or anything that looks off.
              </div>
            </div>

            {messages.map((msg) => {
              const mine = msg.role === 'user';
              return (
                <div key={msg.id} className={cx('group flex items-end gap-1.5', mine ? 'flex-row-reverse' : 'flex-row')}>
                  <div
                    className={cx(
                      'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      mine ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md bg-sunken text-ink',
                    )}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-0.5 pb-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="px-1 text-[11px] tabular-nums text-faint">{timeOf(msg.timestamp)}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteMessage(msg.id)}
                      aria-label="Delete message"
                      className="rounded p-1 text-faint hover:text-danger"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}

            {isChatLoading && (
              <div className="flex">
                <div className="flex gap-1 rounded-2xl rounded-bl-md bg-sunken px-4 py-3.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-6 py-4">
          <div className="mx-auto max-w-2xl">
            {checkedInToday ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSend) onSend();
                }}
              >
                <Textarea
                  ref={inputRef}
                  rows={1}
                  value={chatMessage}
                  onChange={(e) => onChangeMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) onSend();
                    }
                  }}
                  placeholder={hasApiKey ? `Message ${plant.name}…` : 'Add an AI key in Settings to chat'}
                  disabled={!hasApiKey}
                  className="min-h-10 rounded-xl"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-40"
                >
                  <ArrowUp size={18} strokeWidth={2.4} />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-sunken px-4 py-3">
                <p className="text-[13px] text-muted">
                  <span className="font-semibold text-ink">Check in to chat.</span> Today's photo tells {plant.name} how
                  it's doing.
                </p>
                <Button size="sm" variant="primary" icon={Camera} onClick={onCheckIn}>
                  Check in
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirm === 'clear'}
        icon={Eraser}
        title="Clear this conversation?"
        confirmLabel="Clear"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          onClearHistory();
          setConfirm(null);
        }}
      >
        Messages with {plant.name} are deleted. Its photos and check-ins stay.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'remove'}
        icon={Trash2}
        title={`Remove ${plant.name}?`}
        confirmLabel="Remove"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          onRemovePlant();
        }}
      >
        Its photo diary and conversation are deleted from this computer. This can't be undone.
      </ConfirmDialog>
    </div>
  );
}
