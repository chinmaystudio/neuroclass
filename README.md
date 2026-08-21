
# NeuroClass

NeuroClass is an AI-powered classroom platform with separate teacher and student portals, Supabase-backed identity/data, and paid AI endpoints using x402 on Algorand Testnet.

## What this project includes

- **Frontend**: React 19 + Vite + Tailwind (inside `/frontend`, bootstrapped from root Vite config)
- **Backend**: Next.js API routes (inside `/backend/app/api`) with Hono-based x402 payment middleware
- **Database**: Supabase/Postgres schema and migrations (inside `/supabase`)
- **Paid AI flows**: x402 payment-gated endpoints for test generation, assignment generation, and project idea generation
- **Classroom flows**: role-aware teacher/student dashboards, attendance session APIs, classroom learning assistant, exam attempt lifecycle APIs

## Repository structure

```text
.
├── frontend/                 # Vite React app (UI, context, services)
├── backend/                  # Next.js backend APIs + auth/payment services
├── supabase/                 # Canonical schema + SQL migrations
├── docs/                     # Architecture/audit research documents
├── .github/workflows/ci.yml  # CI pipeline
├── Dockerfile                # Multi-stage frontend+backend build image
└── docker-compose.yml        # Local/staging container orchestration
```

## Core API surface (backend)

- `POST /api/ai/generate-test` (x402 paid)
- `POST /api/ai/generate-assignment` (x402 paid)
- `POST /api/ai/project-idea` (x402 paid, authenticated)
- `POST /api/ai/classroom-answer` (authenticated classroom assistant)
- `GET /api/x402/ledger` and `GET/POST /api/x402/verify` (payment visibility/verification)
- `POST /api/attendance/session`, `PATCH /api/attendance/session`, `POST /api/attendance/teacher-mark`, `POST /api/attendance/verify`, `POST /api/attendance/correct`, `GET /api/attendance/active`
- `POST /api/exams/attempt/start`, `POST /api/exams/attempt/violation`, `POST /api/exams/attempt/submit`
- `GET /api/health`

## Local development

### 1) Install dependencies

```bash
npm ci
cd backend && npm ci
```

### 2) Configure environment variables

Use the example files:

- `/home/runner/work/neuro-class/neuro-class/frontend/.env.example`
- `/home/runner/work/neuro-class/neuro-class/backend/.env.example`

Important variables used by the app:

- Frontend: `VITE_BACKEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ALGOD_SERVER_URL`, `VITE_NEUROCLASS_TREASURY_ADDRESS`, `VITE_X402_NETWORK`, `VITE_X402_USDC_ASSET_ID`
- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS`, `NEUROCLASS_TREASURY_ADDRESS`, `X402_FACILITATOR_URL`, `X402_TEST_PRICE_USDC_MICRO`, `X402_ASSIGNMENT_PRICE_USDC_MICRO`, `X402_PROJECT_IDEA_PRICE_USDC_MICRO`, `ALGOD_SERVER_URL`, `ALGORAND_INDEXER_URL`

### 3) Run frontend and backend

```bash
# terminal 1 (root)
npm run dev

# terminal 2 (backend)
cd backend && npm run dev
```

By default, Next.js backend runs on `http://localhost:3000`. Set `VITE_BACKEND_URL` accordingly when frontend and backend are split across hosts.

## Database setup

- Apply `/home/runner/work/neuro-class/neuro-class/supabase/schema.sql` for a fresh instance, or
- Run incremental migrations from `/home/runner/work/neuro-class/neuro-class/supabase/migrations/`

## Quality checks (same checks used in CI)

```bash
# frontend
npm run lint
npm run build

# backend
cd backend && npm run typecheck && npm run build
```

CI (`.github/workflows/ci.yml`) runs frontend typecheck/build, backend typecheck/build, and container build validation.

## Container workflow

```bash
docker-compose up --build -d
```

The Dockerfile builds frontend and backend artifacts, then runs the backend runtime container on port `3000`.

## Additional documentation

- `/home/runner/work/neuro-class/neuro-class/docs/PRODUCTION_FEATURE_INVENTORY.md`
- `/home/runner/work/neuro-class/neuro-class/docs/PRODUCTION_ARCHITECTURE.md`
- `/home/runner/work/neuro-class/neuro-class/PRODUCTION_GRADE.md`
