import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE, isPrivatePath } from '../../config/site';
import { Breadcrumbs, type Crumb } from '../../components/ui';

const FOOTER_LINKS = [
  { to: '/help', label: 'Help and guides' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of service' },
];

export const SiteFooter: React.FC = () => (
  <footer data-ui="footer" className="border-t border-line bg-surface">
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
      <p className="text-support text-ink-2">© {new Date().getFullYear()} {SITE.name}</p>
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-support">
          {FOOTER_LINKS.map((l) => (
            <li key={l.to}><Link to={l.to} className="focus-ring rounded-control text-ink-2 hover:text-primary hover:underline">{l.label}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  </footer>
);

/** Frame for public content pages: header space, readable column, footer. */
export const PublicPage: React.FC<{ title: string; intro?: React.ReactNode; crumbs?: Crumb[]; meta?: React.ReactNode; children: React.ReactNode; wide?: boolean }> = ({ title, intro, crumbs, meta, children, wide }) => (
  <div data-ui="public-page" className="flex min-h-screen flex-col bg-canvas text-ink">
    <main id="main-content" className={`mx-auto w-full flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
      {crumbs && <Breadcrumbs className="mb-4" items={crumbs} />}
      <h1 className="text-[2rem] font-semibold leading-10 tracking-tight text-ink">{title}</h1>
      {meta && <p className="mt-2 text-support text-ink-2">{meta}</p>}
      {intro && <p className="mt-4 text-[1.0625rem] leading-7 text-ink-2">{intro}</p>}
      <div className="mt-8">{children}</div>
    </main>
    <SiteFooter />
  </div>
);

/** Long-form text styles for policy and guide pages. */
export const Prose: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col gap-4 text-body leading-7 text-ink-2 [&_a]:text-primary [&_a:hover]:underline [&_h2]:mt-6 [&_h2]:text-section [&_h2]:text-ink [&_h3]:mt-2 [&_h3]:text-card [&_h3]:text-ink [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-6">
    {children}
  </div>
);

declare global { interface Window { adsbygoogle?: unknown[] } }

let adScriptRequested = false;

/**
 * One display ad unit, labelled "Advertisement". Renders only when AdSense is
 * configured, and never on signed-in, exam or attendance screens (Google
 * publisher policy: no ads on screens without publisher content).
 */
export const AdSlot: React.FC<{ className?: string }> = ({ className }) => {
  const { pathname } = useLocation();
  const ref = React.useRef<HTMLModElement>(null);
  const enabled = Boolean(SITE.adsenseClient && SITE.adsenseSlot) && !isPrivatePath(pathname);

  React.useEffect(() => {
    if (!enabled || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    if (!adScriptRequested) {
      adScriptRequested = true;
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(SITE.adsenseClient!)}`;
      document.head.appendChild(s);
    }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an extension */ }
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <aside aria-label="Advertisement" className={`my-10 border-y border-line-2 py-4 ${className ?? ''}`}>
      <p className="mb-2 text-meta text-ink-2">Advertisement</p>
      <ins ref={ref} key={pathname} className="adsbygoogle block" style={{ display: 'block' }} data-ad-client={SITE.adsenseClient!} data-ad-slot={SITE.adsenseSlot!} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
};
