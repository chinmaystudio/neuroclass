import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { Avatar } from './Avatar';
import { IconButton } from './Button';
import { SearchInput } from './Form';
import { Dropdown, type MenuItem } from './Overlay';
import { IconBell, IconChevronRight, IconClose, IconMenu } from './icons';

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

export const BrandMark: React.FC<{ className?: string; showName?: boolean }> = ({ className, showName = true }) => (
  <span data-ui="brand" className={cn('inline-flex items-center gap-2', className)}>
    <img src="/logo-light.png" alt="" width={28} height={28} className="h-7 w-7 object-contain dark:hidden" />
    <img src="/logo-dark.png" alt="" width={28} height={28} className="hidden h-7 w-7 object-contain dark:block" />
    {showName && <span className="text-[1.125rem] font-semibold tracking-tight text-ink">Neuro<span className="text-primary">Class</span></span>}
  </span>
);

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

export type NavItemDef = { id: string; label: string; icon?: React.ReactNode; href?: string; badge?: number };
export type NavSectionDef = { id: string; label?: string; items: NavItemDef[] };

export type SidebarNavProps = {
  sections: NavSectionDef[];
  activeId: string;
  onNavigate: (item: NavItemDef) => void;
  label?: string;
  footer?: React.ReactNode;
  className?: string;
};

/** Fixed-width labelled navigation. Active item: light-blue background, brand text. */
export const SidebarNav: React.FC<SidebarNavProps> = ({ sections, activeId, onNavigate, label = 'Main', footer, className }) => (
  <nav data-ui="sidebar" aria-label={label} className={cn('flex h-full w-full flex-col bg-surface', className)}>
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {sections.map((section, si) => (
        <div key={section.id} className={cn(si > 0 && 'mt-3 border-t border-line-2 pt-3')}>
          {section.label && <p className="px-3 pb-1 text-meta font-medium text-ink-2">{section.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = item.id === activeId;
              const cls = cn(
                'focus-ring flex h-10 w-full items-center gap-3 rounded-r-full rounded-l-control pl-3 pr-4 text-left text-button transition-colors',
                active ? 'bg-primary-light font-semibold text-primary-dark' : 'font-medium text-ink hover:bg-surface-2',
              );
              const inner = (
                <>
                  {item.icon && <span className={cn('shrink-0', active ? 'text-primary-dark' : 'text-ink-2')}>{item.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && <span className="rounded-full bg-primary px-1.5 text-meta font-semibold text-on-primary tabular-nums">{item.badge}</span>}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <a data-ui="nav-item" href={item.href} aria-current={active ? 'page' : undefined} className={cls} onClick={(e) => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); onNavigate(item); } }}>{inner}</a>
                  ) : (
                    <button data-ui="nav-item" type="button" aria-current={active ? 'page' : undefined} className={cls} onClick={() => onNavigate(item)}>{inner}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
    {footer && <div className="border-t border-line-2 p-3">{footer}</div>}
  </nav>
);

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

export type TopBarProps = {
  user: { name: string; email?: string | null; avatarUrl?: string | null; roleLabel?: string };
  menuItems: MenuItem[];
  onOpenNav?: () => void;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string; onSubmit?: () => void };
  notifications?: { count: number; onOpen: () => void };
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export const TopBar: React.FC<TopBarProps> = ({ user, menuItems, onOpenNav, search, notifications, title, actions, className }) => (
  <header data-ui="topbar" className={cn('sticky top-0 z-[100] flex h-16 items-center gap-2 border-b border-line bg-surface px-2 sm:px-4', className)}>
    {onOpenNav && <IconButton label="Open navigation" icon={<IconMenu size={22} />} onClick={onOpenNav} className="lg:hidden" />}
    <BrandMark className="ml-1 shrink-0" />
    {title && <span className="ml-2 hidden min-w-0 items-center gap-2 truncate text-body text-ink-2 md:flex"><IconChevronRight size={16} className="text-ink-3" />{title}</span>}
    <div className="mx-auto hidden w-full max-w-xl px-4 md:block">
      {search && (
        <form role="search" onSubmit={(e) => { e.preventDefault(); search.onSubmit?.(); }}>
          <SearchInput value={search.value} onChange={(e) => search.onChange(e.target.value)} onClear={() => search.onChange('')} placeholder={search.placeholder ?? 'Search'} aria-label={search.placeholder ?? 'Search'} className="h-10 border-transparent bg-surface-2 hover:border-transparent focus:bg-surface" />
        </form>
      )}
    </div>
    <div className="ml-auto flex items-center gap-1">
      {actions}
      {notifications && (
        <span className="relative">
          <IconButton label={notifications.count > 0 ? `Notifications, ${notifications.count} unread` : 'Notifications'} icon={<IconBell size={20} />} onClick={notifications.onOpen} />
          {notifications.count > 0 && <span aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold text-white dark:text-[#601410]">{notifications.count > 9 ? '9+' : notifications.count}</span>}
        </span>
      )}
      <Dropdown
        label="Account"
        items={menuItems}
        header={<div className="min-w-0"><p className="truncate text-body font-medium text-ink">{user.name}</p>{user.email && <p className="truncate text-support text-ink-2">{user.email}</p>}{user.roleLabel && <p className="mt-1 text-meta text-ink-2">{user.roleLabel}</p>}</div>}
        trigger={(props) => (
          <button {...props} type="button" data-ui="icon-button" aria-label={`Account menu for ${user.name}`} className="focus-ring ml-1 rounded-full">
            <Avatar name={user.name} src={user.avatarUrl} size="md" />
          </button>
        )}
      />
    </div>
  </header>
);

/* -------------------------------------------------------------------------- */
/* Mobile drawer                                                              */
/* -------------------------------------------------------------------------- */

export const NavDrawer: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode; label?: string }> = ({ open, onClose, children, label = 'Navigation' }) => {
  const panel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button,a[href]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; previous?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div data-ui="drawer" className="fixed inset-0 z-[190] lg:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div aria-hidden className="absolute inset-0 bg-overlay" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-dialog">
        <div className="flex h-16 items-center justify-between border-b border-line-2 px-4">
          <BrandMark />
          <IconButton label="Close navigation" icon={<IconClose size={20} />} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

/* -------------------------------------------------------------------------- */
/* Breadcrumbs and page header                                                */
/* -------------------------------------------------------------------------- */

export type Crumb = { label: string; onClick?: () => void; href?: string };

export const Breadcrumbs: React.FC<{ items: Crumb[]; className?: string }> = ({ items, className }) => (
  <nav data-ui="breadcrumbs" aria-label="Breadcrumb" className={cn('min-w-0', className)}>
    <ol className="flex flex-wrap items-center gap-1 text-support text-ink-2">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <IconChevronRight size={14} className="shrink-0 text-ink-3" />}
            {last ? (
              <span aria-current="page" className="truncate font-medium text-ink">{c.label}</span>
            ) : c.href || c.onClick ? (
              <a data-ui="link" href={c.href ?? '#'} onClick={(e) => { if (c.onClick) { e.preventDefault(); c.onClick(); } }} className="focus-ring truncate rounded-control hover:text-primary hover:underline">{c.label}</a>
            ) : (
              <span className="truncate">{c.label}</span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export const PageHeader: React.FC<{ title: React.ReactNode; description?: React.ReactNode; breadcrumbs?: Crumb[]; actions?: React.ReactNode; className?: string }> = ({ title, description, breadcrumbs, actions, className }) => (
  <header data-ui="page-header" className={cn('flex flex-col gap-3', className)}>
    {breadcrumbs && breadcrumbs.length > 1 && <Breadcrumbs items={breadcrumbs} />}
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-page text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-body text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </header>
);

/* -------------------------------------------------------------------------- */
/* App shell                                                                  */
/* -------------------------------------------------------------------------- */

/** Top bar + fixed sidebar on desktop (≥1024px) + drawer on smaller screens. */
export const AppShell: React.FC<{ topBar: (openNav: () => void) => React.ReactNode; sidebar: React.ReactNode; children: React.ReactNode; className?: string }> = ({ topBar, sidebar, children, className }) => {
  const [navOpen, setNavOpen] = React.useState(false);
  return (
    <div data-ui="app-shell" className={cn('flex min-h-screen flex-col bg-canvas text-ink', className)}>
      <a href="#main-content" className="focus-ring sr-only z-[400] rounded-button bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      {topBar(() => setNavOpen(true))}
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-line lg:block">{sidebar}</aside>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
      </div>
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)}>
        <div onClickCapture={(e) => { if ((e.target as HTMLElement).closest('[data-ui="nav-item"]')) setNavOpen(false); }} className="h-full">{sidebar}</div>
      </NavDrawer>
    </div>
  );
};
