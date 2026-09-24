const idFor = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export const getTodayDateId = (): string => idFor(new Date());

export const getYesterdayDateId = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return idFor(d);
};

/**
 * Date ids are stored unpadded ("2026-9-4"), so they neither sort nor parse
 * reliably as strings. This reads one back as a local date.
 */
export function parseDateId(id: string): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(id);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** "Today", "Yesterday", or a short date: "12 Sep", with the year only when it differs. */
export function formatDateId(id: string, now: Date = new Date()): string {
  const date = parseDateId(id);
  if (!date) return id;
  if (id === idFor(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (id === idFor(yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** A coarse "5 minutes ago" for timestamps the user glances at. */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
