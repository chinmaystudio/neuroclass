/**
 * Build-time SEO and ads files for the static frontend (Cloudflare Pages):
 *  - default <head> tags (description, Open Graph, verification metas)
 *  - one HTML file per public route with its own title, description and
 *    canonical, so crawlers and link previews see the right tags before JS
 *  - robots.txt, sitemap.xml and (when AdSense is configured) ads.txt
 * The page body is still rendered by React; only <head> differs per route.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { PUBLIC_ROUTES } from '../frontend/features/public/content';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function seoPlugin(env: Record<string, string>): Plugin {
  const site = (env.VITE_SITE_URL?.trim() || 'https://neuroclass.pages.dev').replace(/\/+$/, '');
  const adClient = env.VITE_ADSENSE_CLIENT?.trim();            // ca-pub-0000000000000000
  const pubId = adClient?.replace(/^ca-/, '');                  // pub-0000000000000000
  const gsv = env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
  const home = PUBLIC_ROUTES[0];

  const headFor = (title: string, description: string, path: string) => {
    const url = `${site}${path}`;
    return [
      `<title>${esc(title === 'NeuroClass' || title.startsWith('NeuroClass') ? title : `${title} | NeuroClass`)}</title>`,
      `<meta name="description" content="${esc(description)}" />`,
      `<meta name="robots" content="index, follow" />`,
      `<link rel="canonical" href="${esc(url)}" />`,
      `<meta property="og:site_name" content="NeuroClass" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      `<meta property="og:type" content="${path.startsWith('/help/') ? 'article' : 'website'}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:image" content="${esc(`${site}/logo.png`)}" />`,
      `<meta name="twitter:card" content="summary" />`,
    ].join('\n    ');
  };

  return {
    name: 'neuroclass-seo',
    apply: 'build',
    transformIndexHtml(html) {
      const extra = [
        '<meta name="theme-color" content="#1a73e8" />',
        gsv ? `<meta name="google-site-verification" content="${esc(gsv)}" />` : '',
        adClient ? `<meta name="google-adsense-account" content="${esc(adClient)}" />` : '',
        `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'NeuroClass', url: site })}</script>`,
      ].filter(Boolean).join('\n    ');
      return html
        .replace(/<title>[\s\S]*?<\/title>/, `${headFor(home.title, home.description, '/')}\n    ${extra}`);
    },
    writeBundle(opts) {
      const dir = opts.dir ?? 'dist';
      const indexPath = path.join(dir, 'index.html');
      if (!fs.existsSync(indexPath)) return;
      const base = fs.readFileSync(indexPath, 'utf8');
      const emit = (fileName: string, source: string) => {
        const out = path.join(dir, fileName);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, source);
      };
      const blockRe = /<title>[\s\S]*?<meta name="twitter:card" content="summary" \/>/;
      for (const r of PUBLIC_ROUTES) {
        if (r.path === '/') continue;
        // Flat "<path>.html" files: Cloudflare Pages serves /help/x.html at /help/x.
        emit(`${r.path.slice(1)}.html`, base.replace(blockRe, headFor(r.title, r.description, r.path)));
      }
      const today = new Date().toISOString().slice(0, 10);
      emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_ROUTES.map((r) => `  <url><loc>${site}${r.path}</loc><lastmod>${today}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority.toFixed(1)}</priority></url>`).join('\n')}\n</urlset>\n`);
      emit('robots.txt', [
          '# Public pages are open to all crawlers. Signed-in portals hold private',
          '# classroom data and are not useful search results.',
          'User-agent: *',
          'Allow: /',
          'Disallow: /teacher',
          'Disallow: /student',
          'Disallow: /attendance',
          'Disallow: /ui-kit',
          '',
          `Sitemap: ${site}/sitemap.xml`,
          '',
      ].join('\n'));
      if (pubId && /^pub-\d{10,20}$/.test(pubId)) {
        emit('ads.txt', `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
      }
    },
  };
}
