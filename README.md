# NeuroClass

NeuroClass is an AI-assisted classroom platform: classrooms with join codes, Face ID attendance, classroom materials with an AI tutor, **classroom-specific tests with AI proctoring**, a **built-in coding IDE** for programming exams and assignments, and **assignment management**.

This repository is the single, consolidated codebase. The former standalone `test_creation` portal has been merged in (see [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md)); it is no longer deployed separately.

| Part | Folder | Deploys to |
|---|---|---|
| Web app (React 19 + Vite + Tailwind) | `frontend/` (root Vite config) | Cloudflare Pages |
| API (Next.js route handlers) | `backend/` | Vercel |
| ML proctoring service (FastAPI) | `ml-service/` | Render |
| Database, auth, storage | `supabase/` | Supabase (PostgreSQL + RLS) |
| Face recognition (existing ArcFace service) | external | Render (`AI_SERVICE_URL`) |
| Code execution sandbox | external | Judge0 or Piston host (`CODE_RUNNER_URL`) |

> **Payments are temporarily disabled.** The x402/Algorand and Stripe test-mode code is still in the repository behind `PAYMENTS_ENABLED` / `VITE_PAYMENTS_ENABLED` (both default to `false`).

## What teachers and students can do

**Teachers**: open a classroom, then use the **Tests** tab to create tests (multiple choice, multiple select, true/false, short answer, fill-in, numerical, long answer, coding). They can generate question suggestions with AI and review them before saving, set timing, scheduling, attempts, shuffling, negative marking and proctoring, then preview and publish. While a test is running they can watch a **live monitor**, then grade answers, review each attempt's proctoring timeline, release results and resolve appeals. The **Assignments** tab handles text, file, document, programming and mixed assignments with attachments, deadlines, late penalties, grading and feedback.

**Students** see only their own classrooms' published tests and assignments. A test runs in a **full-screen exam**: consent, camera check, Face ID verification, a server-controlled timer, autosave with an offline queue, and resume after refresh. Coding questions open the IDE, where students can run their code against sample tests; hidden tests run on the server after submission.

## Local development

```bash
# 1. Install
npm ci                     # frontend
(cd backend && npm ci)     # API

# 2. Configure
cp frontend/.env.example .env.local          # VITE_* values (public)
cp backend/.env.example backend/.env.local   # server secrets

# 3. Database: apply supabase/schema.sql (new project) or the files in
#    supabase/migrations/ in order (existing project). See docs/DATABASE.md.

# 4. Run
npm run dev                # frontend on :5173
(cd backend && npm run dev)  # API on :3000 (set VITE_API_URL=http://localhost:3000)
```

ML service: see [ml-service/README.md](ml-service/README.md).

## Quality checks

```bash
npm run lint && npm run build                                     # frontend
cd backend && npm run typecheck && npm test && npm run build      # API + unit tests
TEST_DATABASE_ADMIN_URL=postgresql://postgres@localhost:5432/postgres ./tests/integration/prepare-db.sh
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/neuroclass_test npm run test:integration
cd ../ml-service && ML_SERVICE_API_KEY=dev python -m pytest -q
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, request flows, design decisions
- [docs/DATABASE.md](docs/DATABASE.md): schema, migrations, RLS, rollback
- [docs/API.md](docs/API.md): `/api/v1` reference
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Cloudflare Pages, Vercel, Render, Supabase, code sandbox
- [docs/SECURITY.md](docs/SECURITY.md): threat model, controls, findings fixed, open items
- [docs/TESTING.md](docs/TESTING.md): test suites and the end-to-end scenarios they cover
- [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md): what changed in the consolidation, and what remains
- [ml-service/MODEL_CARD.md](ml-service/MODEL_CARD.md): proctoring models, thresholds, limitations
- `docs/history/`: earlier fix reports and deployment notes, kept for reference
