import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/*
 * Small shared primitives that follow the existing NeuroClass look: rounded
 * 2xl/3xl surfaces, bold uppercase micro-labels, blue (teacher) / purple
 * (student) accents and full dark-mode support.
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'student'; loading?: boolean; icon?: React.ReactNode; size?: 'sm' | 'md' };

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', loading, icon, size = 'md', className, children, disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'px-3 py-2 text-[10px]' : 'px-4 py-2.5 text-[11px]',
      variant === 'primary' && 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700',
      variant === 'student' && 'bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:bg-purple-500',
      variant === 'secondary' && 'border border-black/10 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10',
      variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
      variant === 'ghost' && 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white',
      className,
    )}
  >
    {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : icon}
    {children}
  </button>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div {...rest} className={cn('rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6', className)} />
);

const BADGE_TONES = {
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  red: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
} as const;

export const Badge: React.FC<{ tone?: keyof typeof BADGE_TONES; children: React.ReactNode; className?: string }> = ({ tone = 'slate', children, className }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', BADGE_TONES[tone], className)}>{children}</span>
);

export const AVAILABILITY_BADGE: Record<string, { label: string; tone: keyof typeof BADGE_TONES }> = {
  draft: { label: 'Draft', tone: 'slate' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  active: { label: 'Live', tone: 'green' },
  ended: { label: 'Ended', tone: 'amber' },
  archived: { label: 'Archived', tone: 'slate' },
  published: { label: 'Published', tone: 'green' },
  closed: { label: 'Closed', tone: 'amber' },
};

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div role="status" className="flex items-center justify-center gap-3 p-10 text-sm font-semibold text-slate-500">
    <Loader2 size={18} className="animate-spin" aria-hidden /> {label}
  </div>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }> = ({ icon, title, body, action }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-black/10 p-10 text-center dark:border-white/10">
    <div className="text-slate-400 opacity-70">{icon}</div>
    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
    {body && <p className="max-w-md text-xs leading-5 text-slate-500">{body}</p>}
    {action}
  </div>
);

export const ErrorNote: React.FC<{ message?: string | null; onRetry?: () => void }> = ({ message, onRetry }) => (message ? (
  <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-semibold text-rose-600 dark:text-rose-300">
    <span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="shrink-0 underline">Retry</button>}
  </div>
) : null);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={cn('block', className)}>
    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-black/30 dark:text-white';

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }> = ({ checked, onChange, label, description, disabled }) => (
  <label className={cn('flex items-start justify-between gap-4 rounded-2xl border border-black/5 p-4 dark:border-white/10', disabled && 'opacity-50')}>
    <span>
      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
      {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
    </span>
    <input type="checkbox" role="switch" className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-blue-600 checked:before:translate-x-[18px] dark:bg-white/20" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cn('w-full rounded-3xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111]', wide ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

export function useAsync<T>(loader: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader().then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((error: Error) => { if (!cancelled) setState({ data: null, error: error.message, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1), setData: (data: T) => setState({ data, error: null, loading: false }) };
}
