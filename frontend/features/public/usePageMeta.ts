import React from 'react';
import { SITE } from '../../config/site';

type Meta = { title: string; description?: string; path?: string; noindex?: boolean; type?: 'website' | 'article' };

const setMeta = (attr: 'name' | 'property', key: string, value: string | null) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (value === null) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
};

const setCanonical = (href: string | null) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = href;
};

/** Keeps <title>, description, canonical, Open Graph and robots in sync with the route. */
export function usePageMeta({ title, description = SITE.description, path, noindex, type = 'website' }: Meta) {
  React.useEffect(() => {
    const full = title.startsWith(SITE.name) ? title : `${title} | ${SITE.name}`;
    document.title = full;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    const url = path !== undefined && !noindex ? `${SITE.url}${path}` : null;
    setCanonical(url);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
  }, [title, description, path, noindex, type]);
}
