/**
 * Public site settings. Everything here is public by design (VITE_* values
 * are compiled into the browser bundle). Set them in the Cloudflare Pages
 * project's environment variables.
 */
const env = import.meta.env as Record<string, string | undefined>;
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export const SITE = {
  name: 'NeuroClass',
  /** Canonical origin, no trailing slash. Set VITE_SITE_URL when a custom domain is added. */
  url: (clean(env.VITE_SITE_URL) ?? 'https://neuroclass.pages.dev').replace(/\/+$/, ''),
  description: 'NeuroClass brings classrooms, auto-graded and proctored tests, assignments and verified attendance together for teachers and students.',
  /** Shown on the Contact and legal pages when set. */
  contactEmail: clean(env.VITE_CONTACT_EMAIL),
  /** Operator name shown in the legal pages. */
  operator: clean(env.VITE_SITE_OPERATOR) ?? 'the NeuroClass team',
  /** AdSense publisher client id (ca-pub-…) and display slot. Ads stay off until both are set. */
  adsenseClient: clean(env.VITE_ADSENSE_CLIENT),
  adsenseSlot: clean(env.VITE_ADSENSE_SLOT),
  legalUpdated: '2026-11-05',
} as const;

/** Signed-in, transactional or private screens: never indexed, never show ads. */
export const isPrivatePath = (path: string) => /^\/(teacher|student|attendance|ui-kit)(\/|$)/.test(path);
