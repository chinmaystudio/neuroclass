import React from 'react';
import { cn } from '../../lib/utils';

export type TabItem = { id: string; label: React.ReactNode; count?: number; disabled?: boolean };

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab list, e.g. "Classroom sections". */
  label: string;
  className?: string;
  /** Prefix for tab / panel ids so several tab sets can coexist. */
  idPrefix?: string;
};

/**
 * WAI-ARIA tabs: arrow keys / Home / End move between tabs (roving tabindex),
 * the active tab has primary text and a blue underline. Pair with <TabPanel>.
 */
export const Tabs: React.FC<TabsProps> = ({ items, value, onChange, label, className, idPrefix }) => {
  const auto = React.useId();
  const prefix = idPrefix ?? `tabs${auto}`;
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = items.filter((i) => !i.disabled);

  const move = (from: string, delta: number | 'first' | 'last') => {
    const idx = enabled.findIndex((i) => i.id === from);
    const next = delta === 'first' ? 0 : delta === 'last' ? enabled.length - 1 : (idx + delta + enabled.length) % enabled.length;
    const target = enabled[next];
    if (!target) return;
    onChange(target.id);
    refs.current[items.indexOf(target)]?.focus();
  };

  return (
    <div data-ui="tabs" role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {items.map((item, i) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`${prefix}-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`${prefix}-panel-${item.id}`}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(item.id, 1); }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); move(item.id, -1); }
              else if (e.key === 'Home') { e.preventDefault(); move(item.id, 'first'); }
              else if (e.key === 'End') { e.preventDefault(); move(item.id, 'last'); }
            }}
            className={cn(
              'focus-ring relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-control px-4 text-button font-medium transition-colors',
              'after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors',
              active ? 'text-primary after:bg-primary' : 'text-ink-2 after:bg-transparent hover:bg-surface-2 hover:text-ink',
              'disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className={cn('rounded-full px-1.5 text-meta tabular-nums', active ? 'bg-primary-light text-primary-dark' : 'bg-surface-2 text-ink-2')}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel: React.FC<{ tabId: string; idPrefix: string; children: React.ReactNode; className?: string }> = ({ tabId, idPrefix, children, className }) => (
  <div role="tabpanel" id={`${idPrefix}-panel-${tabId}`} aria-labelledby={`${idPrefix}-tab-${tabId}`} tabIndex={0} className={cn('focus-ring rounded-control', className)}>
    {children}
  </div>
);
