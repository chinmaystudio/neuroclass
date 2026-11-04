# UI audit harness

Renders the real NeuroClass frontend in Chromium against a **mocked** Supabase and
API (a teacher and a student with realistic classrooms, tests and assignments) and
captures screenshots at desktop (1440×900), tablet (820×1180) and mobile (iPhone 13).
Nothing talks to production.

```bash
# 1. Start the app pointed at the mock hosts
VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=mock-key \
VITE_API_URL=https://api.mock npx vite --port 5199 --strictPort &
# 2. Capture (Playwright must be resolvable from this folder or globally)
node scripts/ui-audit/capture.mjs   # full tour, all viewports → scripts/ui-audit/shots
node scripts/ui-audit/supp.mjs      # tabs, editor, results, grading, exam intro
node scripts/ui-audit/a11y.mjs      # quick accessibility / navigation probe
```

`shots/` is git-ignored; curated images live in `docs/ui-audit/`.
