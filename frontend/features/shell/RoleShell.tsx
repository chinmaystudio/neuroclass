import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, SidebarNav, TopBar, IconButton, type NavSectionDef, type NavItemDef } from '../../components/ui';
import { IconHome, IconMoon, IconSignOut, IconSun } from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { usePageMeta } from '../public/usePageMeta';
import { useTheme } from '../../context/ThemeContext';

/** The signed-in app frame shared by the teacher and student portals. */
export const RoleShell: React.FC<{
  roleLabel: string;
  sections: NavSectionDef[];
  activeId: string;
  onNavigate: (id: string) => void;
  onOpenSettings: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}> = ({ roleLabel, sections, activeId, onNavigate, onOpenSettings, title, children }) => {
  const { user, logout } = useAuth();
  usePageMeta({ title: `${roleLabel} portal`, noindex: true });
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.displayname || meta.display_name || meta.full_name || meta.name || user?.email?.split('@')[0] || 'Account');
  const avatarUrl = (meta.avatar_url || meta.photourl || null) as string | null;

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (
    <SidebarNav
      label={`${roleLabel} navigation`}
      sections={sections}
      activeId={activeId}
      onNavigate={(item: NavItemDef) => onNavigate(item.id)}
      footer={
        <div className="flex flex-col gap-0.5">
          <button type="button" data-ui="nav-item" onClick={() => navigate('/')} className="focus-ring flex h-10 w-full items-center gap-3 rounded-r-full rounded-l-control pl-3 pr-4 text-left text-button font-medium text-ink hover:bg-surface-2">
            <IconHome size={20} className="text-ink-2" /> Home page
          </button>
          <button type="button" data-ui="nav-item" onClick={() => void signOut()} className="focus-ring flex h-10 w-full items-center gap-3 rounded-r-full rounded-l-control pl-3 pr-4 text-left text-button font-medium text-ink hover:bg-surface-2">
            <IconSignOut size={20} className="text-ink-2" /> Sign out
          </button>
        </div>
      }
    />
  );

  return (
    <AppShell
      className="fixed inset-0 z-[60] overflow-y-auto"
      sidebar={sidebar}
      topBar={(openNav) => (
        <TopBar
          onOpenNav={openNav}
          title={title}
          user={{ name, email: user?.email, avatarUrl, roleLabel }}
          actions={
            <IconButton
              label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              icon={theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              onClick={toggleTheme}
            />
          }
          menuItems={[
            { id: 'settings', label: 'Settings', onSelect: onOpenSettings },
            { id: 'home', label: 'Home page', onSelect: () => navigate('/') },
            { id: 'signout', label: 'Sign out', onSelect: () => void signOut(), separatorBefore: true },
          ]}
        />
      )}
    >
      {children}
    </AppShell>
  );
};

/** Standard page container inside the shell. */
export const PageBody: React.FC<{ children: React.ReactNode; className?: string; wide?: boolean }> = ({ children, className, wide }) => (
  <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8', wide ? 'max-w-[1400px]' : 'max-w-6xl', className)}>{children}</div>
);
