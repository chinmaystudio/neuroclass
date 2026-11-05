# Google AdSense and Google Search readiness

What Google requires for a site to show AdSense ads and to be indexed, how NeuroClass meets each requirement, and what the site owner still has to do. Sources: AdSense eligibility requirements and Program policies, Google Publisher Policies, AdSense required content (privacy), Google's EU user consent requirements, ads.txt guidance, and Google Search Essentials. Not legal advice.

## Google Search (indexing)

| Requirement (Search Essentials) | NeuroClass |
|---|---|
| Googlebot isn’t blocked | `robots.txt` allows everything public; it disallows only `/teacher`, `/student`, `/attendance`, `/ui-kit`, which are private signed-in screens. |
| The page works (HTTP 200, not an error) | Public pages are real files: `/help.html`, `/privacy.html` and so on, served at clean URLs. Unknown URLs show a "Page not found" page marked `noindex` instead of silently redirecting home. |
| Indexable content | Original guides (`/help/*`), About, Contact, Privacy and Terms, all linked from the header and footer. Each page has its own title, description and canonical URL in the HTML before JavaScript runs. |
| Spam policies (no cloaking, doorways, hidden text, scaled low-value content) | One version of each page for users and crawlers; content describes the real product. |
| Best practices | `sitemap.xml` lists every public page; descriptive titles; one `<h1>` per page; mobile-friendly; HTTPS; structured data (`WebSite`). |

**Search Console:** add the property `https://neuroclass.pages.dev/` (URL-prefix). Verify it with the HTML tag method: put the token in `VITE_GOOGLE_SITE_VERIFICATION` on Cloudflare Pages and redeploy. Then submit `https://neuroclass.pages.dev/sitemap.xml`.

## Google AdSense

| Requirement | NeuroClass | Owner action |
|---|---|---|
| **Own or control the site.** AdSense verifies sites at the root-domain level; a `*.pages.dev` or `*.vercel.app` hosting subdomain can’t be added because you don’t own the root domain. | Site URL is configurable (`VITE_SITE_URL`); canonical URLs, sitemap and robots follow it. | **Buy a domain**, add it to the Cloudflare Pages project, set `VITE_SITE_URL=https://yourdomain`, then apply with that domain. |
| Applicant is 18 or older | Not applicable to the site itself. | Apply with an adult’s account. |
| High-quality, original content that attracts an audience | Guides, About and policy pages written for this product. | Add more guides over time; Google reviews content, not page counts. |
| Easy navigation | Header (Features, Help, About) and footer (Help, About, Contact, Privacy, Terms) on every public page. | None. |
| Privacy policy with the AdSense required disclosures | `/privacy` states that third-party vendors including Google use cookies to serve ads based on prior visits, explains Google’s advertising cookies, and links to Ads Settings, aboutads.info and Google’s partner-sites page. | Review the policy, and add your vendors if you enable other ad networks. |
| Consent in the EEA, UK and Switzerland through a Google-certified CMP (TCF) | The privacy policy describes the consent message. | In AdSense, open **Privacy & messaging → European regulations**, create and publish the message. Google’s own message is a certified CMP. Do this **before** turning ads on. |
| No ads on screens without publisher content (login, error, navigation, private communication, exam screens) | Ads render only through `AdSlot`, which is disabled on `/teacher`, `/student`, `/attendance` and exam screens, and appears only inside guide articles below real content. | Keep **Auto ads off**: auto ads could place ads on signed-in screens after navigation. Use the manual display unit. |
| No click encouragement and accurate labels | Each unit is labelled "Advertisement", with no arrows or "support us" text. | Never click your own ads. |
| ads.txt | Written automatically at build time when `VITE_ADSENSE_CLIENT` is set (`google.com, pub-…, DIRECT, f08c47fec0942fa0`). | None after setting the variable. |
| Site verification | `google-adsense-account` meta tag added automatically when `VITE_ADSENSE_CLIENT` is set. | None. |
| Contact information | `/contact` shows `VITE_CONTACT_EMAIL` when set. | Set it to a real support address. |

## Environment variables (Cloudflare Pages → Settings → Variables, then redeploy)

| Variable | Example | Effect |
|---|---|---|
| `VITE_SITE_URL` | `https://neuroclass.app` | Canonical URLs, sitemap, robots |
| `VITE_CONTACT_EMAIL` | `support@yourdomain` | Contact and policy pages |
| `VITE_SITE_OPERATOR` | `Your name or organisation` | Named in the privacy policy |
| `VITE_GOOGLE_SITE_VERIFICATION` | token from Search Console | Search Console verification meta |
| `VITE_ADSENSE_CLIENT` | `ca-pub-1234567890123456` | AdSense account meta, ads.txt, ad script |
| `VITE_ADSENSE_SLOT` | `1234567890` | The display unit shown in guides; ads stay off until both AdSense values are set |
