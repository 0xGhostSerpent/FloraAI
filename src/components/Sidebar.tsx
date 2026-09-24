import {
  AlertCircle,
  Cloud,
  Leaf,
  ScanLine,
  Settings,
  Sprout,
  Store,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { cx, Spinner } from './ui';
import { formatRelative } from '../lib/dates';

export type Section = 'garden' | 'identify' | 'nurseries' | 'settings';

type Props = {
  section: Section;
  plantCount: number;
  streak: number;
  checkedInToday: boolean;
  isOnline: boolean;
  isSignedIn: boolean;
  syncing: boolean;
  lastSync: number | null;
  syncError: string | null;
  onNavigate: (section: Section) => void;
};

function NavItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.3 : 2} className={active ? 'text-accent' : undefined} />
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && <span className="text-xs tabular-nums text-faint">{count}</span>}
    </button>
  );
}

export default function Sidebar({
  section,
  plantCount,
  streak,
  checkedInToday,
  isOnline,
  isSignedIn,
  syncing,
  lastSync,
  syncError,
  onNavigate,
}: Props) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-bg px-3 py-5 xl:w-60">
      <div className="mb-7 flex items-center gap-2.5 px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
          <Leaf size={17} strokeWidth={2.4} />
        </div>
        <span className="font-display text-[22px] font-semibold tracking-[-0.01em] text-ink">Flora</span>
      </div>

      <nav className="space-y-0.5" aria-label="Main">
        <NavItem
          icon={Sprout}
          label="Garden"
          count={plantCount}
          active={section === 'garden'}
          onClick={() => onNavigate('garden')}
        />
        <NavItem
          icon={ScanLine}
          label="Identify"
          active={section === 'identify'}
          onClick={() => onNavigate('identify')}
        />
        <NavItem
          icon={Store}
          label="Nurseries"
          active={section === 'nurseries'}
          onClick={() => onNavigate('nurseries')}
        />
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
          <p className="font-display text-2xl font-semibold leading-none text-ink lining-nums tabular-nums">
            {streak}
            <span className="ml-1.5 font-sans text-[13px] font-medium text-muted">
              day{streak === 1 ? '' : 's'} streak
            </span>
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {checkedInToday ? 'Checked in today.' : 'Check in on a plant today to keep it going.'}
          </p>
        </div>

        {(!isOnline || isSignedIn) && (
          <div className="space-y-1.5 px-3 text-xs">
            {!isOnline && (
              <p className="flex items-center gap-2 font-medium text-warn">
                <WifiOff size={14} /> Offline
              </p>
            )}
            {isSignedIn && (
              <p
                className={cx('flex items-center gap-2', syncError ? 'text-danger' : 'text-muted')}
                title={syncError ?? undefined}
              >
                {syncing ? (
                  <>
                    <Spinner size={12} /> Backing up…
                  </>
                ) : syncError ? (
                  <>
                    <AlertCircle size={14} /> Backup failed
                  </>
                ) : (
                  <>
                    <Cloud size={14} /> {lastSync ? `Backed up ${formatRelative(lastSync)}` : 'Not backed up yet'}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <NavItem
          icon={Settings}
          label="Settings"
          active={section === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </div>
    </aside>
  );
}
