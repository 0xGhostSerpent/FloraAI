/**
 * The small set of building blocks every screen is composed from. Screens
 * should not restyle buttons, cards or form fields inline; if a variant is
 * missing, add it here so the whole app stays consistent.
 */
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

// ---- Buttons ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken shadow-card',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
  danger: 'bg-danger text-on-danger hover:brightness-110 shadow-card',
  soft: 'bg-accent-soft text-accent hover:brightness-95',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading, block, className, children, disabled, ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap select-none transition-[background-color,color,filter,transform] active:translate-y-px disabled:opacity-45 disabled:pointer-events-none',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={iconSize} /> : Icon && <Icon size={iconSize} strokeWidth={2.2} />}
      {children}
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'danger';
};

export function IconButton({ icon: Icon, label, tone = 'default', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors disabled:opacity-40',
        tone === 'danger' ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-sunken hover:text-ink',
        className,
      )}
      {...rest}
    >
      <Icon size={17} strokeWidth={2} />
    </button>
  );
}

// ---- Surfaces --------------------------------------------------------------

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={cx('rounded-2xl border border-line bg-surface shadow-card', padded && 'p-5', className)}>
      {children}
    </div>
  );
}

/** A labelled block of content inside a card or page. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('space-y-3', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx('text-xs font-semibold uppercase tracking-[0.08em] text-faint', className)}>{children}</p>
  );
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  actions,
  serif = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  serif?: boolean;
}) {
  return (
    <header className="space-y-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={cx(
              'text-ink leading-tight',
              serif ? 'font-display text-[28px] font-semibold tracking-[-0.01em]' : 'text-2xl font-semibold',
            )}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ---- Status & feedback -----------------------------------------------------

type Tone = 'neutral' | 'accent' | 'danger' | 'warn';

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  accent: 'bg-accent-soft text-accent',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        BADGE_TONE[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

const NOTICE_TONE: Record<Exclude<Tone, 'neutral'> | 'info', { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: 'bg-sunken border-line', icon: Info, iconClass: 'text-muted' },
  accent: { box: 'bg-accent-soft border-transparent', icon: CheckCircle2, iconClass: 'text-accent' },
  warn: { box: 'bg-warn-soft border-transparent', icon: AlertTriangle, iconClass: 'text-warn' },
  danger: { box: 'bg-danger-soft border-transparent', icon: AlertTriangle, iconClass: 'text-danger' },
};

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  icon,
  className,
}: {
  tone?: keyof typeof NOTICE_TONE;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const style = NOTICE_TONE[tone];
  const Icon = icon ?? style.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-xl border px-4 py-3', style.box, className)}
    >
      <Icon size={18} className={cx('mt-px shrink-0', style.iconClass)} />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cx('inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted">
      <Spinner size={22} className="text-accent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon size={22} />
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Small print that qualifies AI output or third-party data. */
export function Disclaimer({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-xs leading-relaxed text-faint', className)}>{children}</p>;
}

// ---- Forms -----------------------------------------------------------------

export function Field({
  label,
  hint,
  aside,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <div className="text-xs leading-relaxed text-muted">{hint}</div>}
    </div>
  );
}

const CONTROL =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-accent/15 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(CONTROL, 'h-10', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(CONTROL, 'py-2.5 resize-none', className)} {...rest} />;
  },
);

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('inline-flex rounded-lg border border-line bg-sunken p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Dialogs ---------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  tone = 'default',
  icon: Icon,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
  icon?: LucideIcon;
  /** False for warnings that must be acknowledged explicitly. */
  dismissible?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-pop"
          >
            <div className="flex items-start gap-4">
              {Icon && (
                <div
                  className={cx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent',
                  )}
                >
                  <Icon size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-base font-semibold text-ink">
                  {title}
                </h2>
                {children && <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>}
              </div>
            </div>
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  icon,
  destructive = true,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: LucideIcon;
  destructive?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      icon={icon}
      tone={destructive ? 'danger' : 'default'}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

// ---- Page transition -------------------------------------------------------

/** Wraps each screen so navigation fades rather than snaps. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cx('mx-auto w-full px-8 py-8', wide ? 'max-w-6xl' : 'max-w-4xl', className)}
    >
      {children}
    </motion.div>
  );
}

// ---- Toast -----------------------------------------------------------------

export type ToastMessage = { id: number; message: string; tone: 'success' | 'danger' };

/** A brief confirmation in the corner, in place of a blocking alert(). */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-pop"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
