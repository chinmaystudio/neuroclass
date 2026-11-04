import React from 'react';
import { cn } from '../../lib/utils';
import {
  Badge as KitBadge,
  Button as KitButton,
  Card as KitCard,
  EmptyState as KitEmptyState,
  InfoCard,
  Modal as KitModal,
  Spinner as KitSpinner,
  Toggle as KitToggle,
  controlClasses,
  type BadgeTone,
  type ButtonVariant,
} from '../../components/ui';

/*
 * Compatibility layer for the tests / exam / coding / assignment screens.
 * Keeps the props these screens already use, but renders the NeuroClass UI
 * kit (components/ui) so every screen shares one set of tokens and components.
 * New code should import from 'components/ui' directly.
 */

type LegacyButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'student';
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: LegacyButtonVariant; loading?: boolean; icon?: React.ReactNode; size?: 'sm' | 'md' };

const BUTTON_MAP: Record<LegacyButtonVariant, ButtonVariant> = {
  primary: 'primary',
  student: 'primary',
  secondary: 'outline',
  danger: 'danger',
  ghost: 'text',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', icon, size = 'md', ...rest }) => (
  <KitButton variant={BUTTON_MAP[variant]} size={size} iconLeft={icon} {...rest} />
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => <KitCard className={className} {...rest} />;

type LegacyTone = 'slate' | 'blue' | 'purple' | 'green' | 'amber' | 'red';
const TONE_MAP: Record<LegacyTone, BadgeTone> = { slate: 'neutral', blue: 'primary', purple: 'info', green: 'success', amber: 'warning', red: 'danger' };

export const Badge: React.FC<{ tone?: LegacyTone; children: React.ReactNode; className?: string }> = ({ tone = 'slate', children, className }) => (
  <KitBadge tone={TONE_MAP[tone]} className={className}>{children}</KitBadge>
);

export const AVAILABILITY_BADGE: Record<string, { label: string; tone: LegacyTone }> = {
  draft: { label: 'Draft', tone: 'slate' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  active: { label: 'Live', tone: 'green' },
  ended: { label: 'Ended', tone: 'amber' },
  archived: { label: 'Archived', tone: 'slate' },
  published: { label: 'Published', tone: 'green' },
  closed: { label: 'Closed', tone: 'amber' },
};

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => <KitSpinner label={label} />;

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }> = ({ title, body, action }) => (
  <KitEmptyState title={title} body={body} action={action} />
);

export const ErrorNote: React.FC<{ message?: string | null; onRetry?: () => void }> = ({ message, onRetry }) =>
  message ? (
    <InfoCard tone="danger" action={onRetry ? <KitButton variant="text" size="sm" onClick={onRetry}>Retry</KitButton> : undefined}>
      <span className="text-danger-ink">{message}</span>
    </InfoCard>
  ) : null;

/** Wrapping label (implicit association), so plain inputs inside stay labelled. */
export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label data-ui="field" className={cn('flex flex-col gap-1.5', className)}>
    <span className="text-support font-medium text-ink">{label}</span>
    {children}
    {hint && <span className="text-meta text-ink-2">{hint}</span>}
  </label>
);

/** Class string for raw <input>/<select>/<textarea> elements in older screens. */
export const inputClass = controlClasses('min-h-10 py-2');

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }> = (props) => (
  <div className="rounded-card border border-line bg-surface p-4">
    <KitToggle {...props} />
  </div>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <KitModal open onClose={onClose} title={title} size={wide ? 'xl' : 'md'}>{children}</KitModal>
);

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
