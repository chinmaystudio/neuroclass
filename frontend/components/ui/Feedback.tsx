import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { IconAlert, IconSpinner } from './icons';

/** Placeholder block shown while content loads (> 300 ms). */
export const Skeleton: React.FC<{ className?: string; rounded?: 'control' | 'card' | 'full' }> = ({ className, rounded = 'control' }) => (
  <span
    data-ui="skeleton"
    aria-hidden
    className={cn('block animate-pulse bg-surface-2', rounded === 'full' ? 'rounded-full' : rounded === 'card' ? 'rounded-card' : 'rounded-control', className)}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => (
  <span className={cn('flex flex-col gap-2', className)} aria-hidden>
    {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />)}
  </span>
);

export const SkeletonCard: React.FC<{ className?: string; banner?: boolean }> = ({ className, banner }) => (
  <div data-ui="skeleton-card" role="status" aria-label="Loading" className={cn('overflow-hidden rounded-card border border-line bg-surface', className)}>
    {banner && <Skeleton rounded="control" className="h-24 w-full rounded-none" />}
    <div className="flex flex-col gap-3 p-5">
      <Skeleton className="h-5 w-1/2" />
      <SkeletonText lines={2} />
    </div>
  </div>
);

/** Inline or block loading indicator with a visible label. */
export const Spinner: React.FC<{ label?: string; className?: string; inline?: boolean }> = ({ label = 'Loading…', className, inline }) => (
  <div data-ui="spinner" role="status" className={cn('flex items-center gap-2 text-support text-ink-2', inline ? 'inline-flex' : 'justify-center p-8', className)}>
    <IconSpinner size={18} className="text-primary" />
    <span>{label}</span>
  </div>
);

export const ProgressBar: React.FC<{ value: number; max?: number; label: string; showValue?: boolean; tone?: 'primary' | 'success' | 'warning' | 'danger'; className?: string }> = ({ value, max = 100, label, showValue = true, tone = 'primary', className }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div data-ui="progress" className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between text-support">
        <span className="text-ink-2">{label}</span>
        {showValue && <span className="font-medium tabular-nums text-ink">{Math.round(pct)}%</span>}
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full transition-[width] duration-[var(--duration-base)]', { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/** Full error state for a section that failed to load. */
export const ErrorState: React.FC<{ title?: string; message?: React.ReactNode; onRetry?: () => void; className?: string }> = ({ title = 'Something went wrong', message, onRetry, className }) => (
  <div data-ui="error-state" role="alert" className={cn('flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-10 text-center', className)}>
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg text-danger"><IconAlert size={20} /></span>
    <p className="text-card text-ink">{title}</p>
    {message && <p className="max-w-md text-support text-ink-2">{message}</p>}
    {onRetry && <Button variant="outline" onClick={onRetry} className="mt-2">Try again</Button>}
  </div>
);
