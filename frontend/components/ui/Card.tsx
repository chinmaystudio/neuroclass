import React from 'react';
import { cn } from '../../lib/utils';
import { Avatar } from './Avatar';
import { Badge, StatusBadge, type BadgeTone } from './Badge';
import { IconAlert, IconCalendar, IconCheckCircle, IconClock, IconInfo, IconUsers } from './icons';

/* -------------------------------------------------------------------------- */
/* Base card                                                                  */
/* -------------------------------------------------------------------------- */

export type CardVariant = 'standard' | 'interactive' | 'flat';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  /** Inner padding; use 'none' when the card hosts a table or banner edge-to-edge. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: 'div' | 'section' | 'article' | 'li';
};

const PAD = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export const cardClasses = (variant: CardVariant = 'standard', padding: CardProps['padding'] = 'md', extra?: string) =>
  cn(
    'min-w-0 rounded-card border border-line bg-surface text-ink',
    variant === 'standard' && 'shadow-card',
    variant === 'interactive' && 'shadow-card transition-shadow duration-[var(--duration-base)] hover:shadow-raised focus-within:shadow-raised',
    PAD[padding ?? 'md'],
    extra,
  );

export const Card: React.FC<CardProps> = ({ variant = 'standard', padding = 'md', as: Tag = 'div', className, ...rest }) =>
  React.createElement(Tag, { 'data-ui': 'card', className: cardClasses(variant, padding, className), ...rest });

export const CardHeader: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string; level?: 2 | 3 }> = ({ title, subtitle, actions, className, level = 3 }) => {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <H className={cn('truncate text-ink', level === 2 ? 'text-section' : 'text-card')}>{title}</H>
        {subtitle && <p className="mt-0.5 text-support text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('mt-4 flex flex-wrap items-center gap-2 border-t border-line-2 pt-4', className)}>{children}</div>
);

/** Meta row with an optional icon: "Due Nov 6, 8:30 AM", "32 students"… */
export const Meta: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ icon, children, className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-support text-ink-2', className)}>
    {icon && <span className="text-ink-3">{icon}</span>}
    {children}
  </span>
);

/* -------------------------------------------------------------------------- */
/* Statistic                                                                  */
/* -------------------------------------------------------------------------- */

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: BadgeTone; trend?: { label: string; tone: BadgeTone }; className?: string }> = ({ label, value, hint, tone = 'primary', trend, className }) => (
  <Card className={cn('relative overflow-hidden', className)}>
    <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', {
      primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-line',
    }[tone])} />
    <p className="text-support font-medium text-ink-2">{label}</p>
    <p className="mt-1 text-[1.75rem] font-semibold leading-9 text-ink tabular-nums">{value}</p>
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {trend && <Badge tone={trend.tone}>{trend.label}</Badge>}
      {hint && <span className="text-meta text-ink-2">{hint}</span>}
    </div>
  </Card>
);

/* -------------------------------------------------------------------------- */
/* Classroom                                                                  */
/* -------------------------------------------------------------------------- */

/** Brand banner with quiet geometric accents, used for classroom covers. */
export const ClassroomBanner: React.FC<{ children?: React.ReactNode; className?: string; compact?: boolean }> = ({ children, className, compact }) => (
  <div className={cn('relative isolate overflow-hidden bg-brand-gradient text-white', compact ? 'px-4 py-4' : 'px-6 py-6', className)}>
    <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 120">
      <path d="M260 0h140v120H200z" fill="white" fillOpacity="0.07" />
      <path d="M320 0h80v120h-140z" fill="white" fillOpacity="0.06" />
      <circle cx="372" cy="22" r="34" fill="white" fillOpacity="0.06" />
    </svg>
    {/* Keeps small text legible over the lighter end of the gradient. */}
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/20 to-transparent" />
    {children}
  </div>
);

export type ClassroomCardProps = {
  name: string;
  subject?: string | null;
  code?: string | null;
  teacher?: string | null;
  studentCount?: number;
  upcoming?: React.ReactNode;
  actions?: React.ReactNode;
  onOpen?: () => void;
  href?: string;
  className?: string;
};

export const ClassroomCard: React.FC<ClassroomCardProps> = ({ name, subject, code, teacher, studentCount, upcoming, actions, onOpen, href, className }) => {
  const titleId = React.useId();
  const Title = href ? 'a' : onOpen ? 'button' : 'span';
  return (
    <Card as="article" variant="interactive" padding="none" aria-labelledby={titleId} className={cn('flex flex-col overflow-hidden', className)}>
      <ClassroomBanner compact className="min-h-[96px]">
        {React.createElement(
          Title,
          {
            id: titleId,
            ...(href ? { href } : {}),
            ...(onOpen ? { onClick: onOpen, type: 'button' } : {}),
            className: cn('focus-ring block w-full truncate text-left text-[1.125rem] font-semibold leading-7 text-white', (href || onOpen) && 'hover:underline after:absolute after:inset-0 after:content-[""]'),
          },
          name,
        )}
        {subject && <p className="mt-0.5 truncate text-support text-white/95">{subject}</p>}
        {teacher && <p className="mt-2 truncate text-meta text-white/95">{teacher}</p>}
      </ClassroomBanner>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {upcoming ? <div className="text-support text-ink-2">{upcoming}</div> : <p className="text-support text-ink-3">No upcoming work</p>}
      </div>
      <div className="relative z-10 flex items-center justify-between gap-2 border-t border-line-2 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {typeof studentCount === 'number' && <Meta icon={<IconUsers size={16} />}>{studentCount} {studentCount === 1 ? 'student' : 'students'}</Meta>}
          {code && <Meta>Code <span className="font-mono font-medium text-ink">{code}</span></Meta>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/* Work items: assignment and test                                            */
/* -------------------------------------------------------------------------- */

export type WorkCardProps = {
  kind: 'assignment' | 'test';
  title: string;
  classroom?: string | null;
  status: string;
  statusLabel?: string;
  due?: string | null;
  duration?: string | null;
  marks?: number | null;
  extraBadges?: React.ReactNode;
  stats?: Array<{ label: string; value: React.ReactNode }>;
  actions?: React.ReactNode;
  className?: string;
};

const WorkCard: React.FC<WorkCardProps> = ({ kind, title, classroom, status, statusLabel, due, duration, marks, extraBadges, stats, actions, className }) => (
  <Card as="article" variant="interactive" className={cn('flex flex-col', className)}>
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} label={statusLabel} />
      <Badge tone="neutral">{kind === 'test' ? 'Test' : 'Assignment'}</Badge>
      {extraBadges}
    </div>
    <h3 className="mt-3 text-card text-ink">{title}</h3>
    {classroom && <p className="text-support text-ink-2">{classroom}</p>}
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {due && <Meta icon={<IconCalendar size={16} />}>{due}</Meta>}
      {duration && <Meta icon={<IconClock size={16} />}>{duration}</Meta>}
      {typeof marks === 'number' && <Meta>{marks} marks</Meta>}
    </div>
    {stats && stats.length > 0 && (
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line-2 bg-line-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface px-3 py-2">
            <dt className="text-meta text-ink-2">{s.label}</dt>
            <dd className="text-body font-semibold tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    )}
    {actions && <CardFooter>{actions}</CardFooter>}
  </Card>
);

export const AssignmentCard: React.FC<Omit<WorkCardProps, 'kind'>> = (props) => <WorkCard kind="assignment" {...props} />;
export const TestCard: React.FC<Omit<WorkCardProps, 'kind'>> = (props) => <WorkCard kind="test" {...props} />;

/* -------------------------------------------------------------------------- */
/* People and activity                                                        */
/* -------------------------------------------------------------------------- */

export const StudentCard: React.FC<{ name: string; email?: string | null; detail?: React.ReactNode; status?: React.ReactNode; actions?: React.ReactNode; className?: string }> = ({ name, email, detail, status, actions, className }) => (
  <Card padding="sm" className={cn('flex items-center gap-3 self-start', className)}>
    <Avatar name={name} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-body font-medium text-ink">{name}</p>
      {(email || detail) && <p className="truncate text-support text-ink-2">{[email, detail].filter(Boolean).map((v, i) => <React.Fragment key={i}>{i > 0 && ' · '}{v}</React.Fragment>)}</p>}
    </div>
    {status}
    {actions}
  </Card>
);

export type ActivityItem = { id: string; actor?: string; title: React.ReactNode; detail?: React.ReactNode; time: string; tone?: BadgeTone };

/** One-column activity feed. */
export const ActivityList: React.FC<{ items: ActivityItem[]; className?: string; empty?: React.ReactNode }> = ({ items, className, empty }) =>
  items.length === 0 ? <>{empty ?? <p className="text-support text-ink-2">No recent activity.</p>}</> : (
    <ol data-ui="activity" className={cn('divide-y divide-line-2', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          {item.actor ? <Avatar name={item.actor} size="sm" /> : <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', {
            primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', neutral: 'bg-ink-3',
          }[item.tone ?? 'primary'])} />}
          <div className="min-w-0 flex-1">
            <p className="text-body text-ink">{item.title}</p>
            {item.detail && <p className="text-support text-ink-2">{item.detail}</p>}
          </div>
          <time className="shrink-0 text-meta text-ink-2">{item.time}</time>
        </li>
      ))}
    </ol>
  );

export const ActivityCard: React.FC<{ title?: string; items: ActivityItem[]; actions?: React.ReactNode; className?: string }> = ({ title = 'Recent activity', items, actions, className }) => (
  <Card className={className}>
    <CardHeader title={title} actions={actions} />
    <ActivityList className="mt-4" items={items} />
  </Card>
);

/* -------------------------------------------------------------------------- */
/* Information / alert                                                        */
/* -------------------------------------------------------------------------- */

const INFO_TONE = {
  info: { box: 'border-info/30 bg-info-bg text-info-ink', icon: <IconInfo size={18} /> },
  success: { box: 'border-success/30 bg-success-bg text-success-ink', icon: <IconCheckCircle size={18} /> },
  warning: { box: 'border-warning/40 bg-warning-bg text-warning-ink', icon: <IconAlert size={18} /> },
  danger: { box: 'border-danger/30 bg-danger-bg text-danger-ink', icon: <IconAlert size={18} /> },
} as const;

export type InfoCardProps = { tone?: keyof typeof INFO_TONE; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string; role?: 'status' | 'alert' };

/** Inline message banner for context, success, warnings and errors. */
export const InfoCard: React.FC<InfoCardProps> = ({ tone = 'info', title, children, action, className, role }) => (
  <div data-ui="info" role={role ?? (tone === 'danger' ? 'alert' : 'status')} className={cn('flex items-start gap-3 rounded-card border px-4 py-3', INFO_TONE[tone].box, className)}>
    <span className="mt-0.5 shrink-0">{INFO_TONE[tone].icon}</span>
    <div className="min-w-0 flex-1 text-support">
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-0.5', 'text-ink-2 dark:text-ink-2')}>{children}</div>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export const EmptyState: React.FC<{ title: string; body?: React.ReactNode; action?: React.ReactNode; illustration?: React.ReactNode; className?: string; compact?: boolean }> = ({ title, body, action, illustration, className, compact }) => (
  <Card variant="flat" className={cn('flex flex-col items-center text-center', compact ? 'gap-2 py-8' : 'gap-3 py-12', 'border-dashed', className)}>
    {illustration ?? (
      <svg aria-hidden width="72" height="48" viewBox="0 0 72 48" className="text-primary">
        <rect x="6" y="10" width="44" height="32" rx="4" fill="currentColor" fillOpacity="0.1" />
        <rect x="22" y="4" width="44" height="32" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
        <path d="M30 16h28M30 22h20M30 28h24" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )}
    <p className="text-card text-ink">{title}</p>
    {body && <p className="max-w-md text-support text-ink-2">{body}</p>}
    {action && <div className="mt-1">{action}</div>}
  </Card>
);
