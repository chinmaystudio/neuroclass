import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  primary: 'bg-primary-light text-primary-dark',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
  danger: 'bg-danger-bg text-danger-ink',
  info: 'bg-info-bg text-info-ink',
};

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-ink-3',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export type BadgeProps = { tone?: BadgeTone; dot?: boolean; children: React.ReactNode; className?: string };

/** Compact status label. Sentence case, never uppercase; colour is never the only signal. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', dot, children, className }) => (
  <span data-ui="badge" className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-control px-2 text-meta font-medium', TONES[tone], className)}>
    {dot && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
    {children}
  </span>
);

/** Shared vocabulary for workflow states, so the same word always gets the same colour. */
export const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  live: { label: 'Live', tone: 'success' },
  published: { label: 'Published', tone: 'success' },
  open: { label: 'Open', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  ended: { label: 'Ended', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
  not_started: { label: 'Not started', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'info' },
  pending: { label: 'Pending', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'primary' },
  late: { label: 'Late', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
  missed: { label: 'Missed', tone: 'danger' },
  evaluated: { label: 'Graded', tone: 'success' },
  graded: { label: 'Graded', tone: 'success' },
  returned: { label: 'Returned', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  present: { label: 'Present', tone: 'success' },
  absent: { label: 'Absent', tone: 'danger' },
  excused: { label: 'Excused', tone: 'info' },
  verified: { label: 'Verified', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

export const StatusBadge: React.FC<{ status: string; label?: string; className?: string }> = ({ status, label, className }) => {
  const key = status.toLowerCase().replace(/[\s-]+/g, '_');
  const def = STATUS[key] ?? { label: status, tone: 'neutral' as BadgeTone };
  return <Badge tone={def.tone} dot className={className}>{label ?? def.label}</Badge>;
};
