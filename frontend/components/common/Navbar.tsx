import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BrandMark, Button, buttonClasses, IconButton, NavDrawer } from '../ui';
import { IconMenu, IconMoon, IconSun } from '../ui/icons';

interface NavbarProps {
  onLogin?: (mode: 'signin' | 'signup') => void;
}

/** Public header for the home page and the attendance hand-off pages. */
const Navbar: React.FC<NavbarProps> = ({ onLogin }) => {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const { user, userRole, logout } = useAuth();
  const location = useLocation();

  // Signed-in portals and the UI kit have their own frame.
  if (/^\/(student|teacher|ui-kit)/.test(location.pathname)) return null;

  const isHome = location.pathname === '/';
  const links = [
    { name: 'Features', href: isHome ? '#features' : '/#features' },
    { name: 'Help', href: '/help' },
    { name: 'About', href: '/about' },
  ];

  const themeButton = (
    <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} icon={theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />} onClick={toggleTheme} />
  );

  const account = user && userRole ? (
    <>
      <Link to={`/${userRole ?? ''}`} className={buttonClasses('primary')}>Open dashboard</Link>
      <Button variant="text" onClick={() => void logout()}>Sign out</Button>
    </>
  ) : (
    <>
      <Button variant="text" onClick={() => onLogin?.('signin')}>Sign in</Button>
      <Button onClick={() => onLogin?.('signup')}>Create account</Button>
    </>
  );

  return (
    <header data-ui="public-header" className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="NeuroClass home" className="focus-ring rounded-control"><BrandMark /></Link>
        {(
          <nav aria-label="Page sections" className="ml-6 hidden items-center gap-1 md:flex">
            {links.map((l) => l.href.startsWith('/') && !l.href.includes('#') ? (
              <Link key={l.href} to={l.href} aria-current={location.pathname.startsWith(l.href) ? 'page' : undefined} className="focus-ring rounded-button px-3 py-2 text-button font-medium text-ink-2 hover:bg-surface-2 hover:text-ink aria-[current=page]:text-primary">{l.name}</Link>
            ) : (
              <a key={l.href} href={l.href} className="focus-ring rounded-button px-3 py-2 text-button font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">{l.name}</a>
            ))}
          </nav>
        )}
        <div className="ml-auto hidden items-center gap-2 md:flex">{themeButton}{account}</div>
        <div className="ml-auto flex items-center gap-1 md:hidden">
          {themeButton}
          <IconButton label="Open menu" icon={<IconMenu size={22} />} onClick={() => setOpen(true)} />
        </div>
      </div>
      <NavDrawer open={open} onClose={() => setOpen(false)} label="Menu">
        <div className="flex h-full flex-col gap-1 p-3" onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a,button')) setOpen(false); }}>
          {links.map((l) => l.href.startsWith('/') && !l.href.includes('#') ? (
            <Link key={l.href} to={l.href} className="focus-ring flex h-11 items-center rounded-button px-3 text-body text-ink hover:bg-surface-2">{l.name}</Link>
          ) : (
            <a key={l.href} href={l.href} className="focus-ring flex h-11 items-center rounded-button px-3 text-body text-ink hover:bg-surface-2">{l.name}</a>
          ))}
          <div className="mt-auto flex flex-col gap-2 border-t border-line-2 pt-3 [&>*]:w-full">{account}</div>
        </div>
      </NavDrawer>
    </header>
  );
};

export default Navbar;
