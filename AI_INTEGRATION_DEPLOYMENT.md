# NeuroClass AI Attendance Integration

This repository now contains the first integration layer for the Render AI service.

## Runtime boundary

```text
Cloudflare Pages frontend
        ↓ VITE_API_URL
Vercel application API
        ↓ AI_SERVICE_SECRET
Render FastAPI AI service
        ↓
Supabase PostgreSQL + pgvector
```

The browser never calls Render directly and never receives raw embeddings.

## Vercel environment variables

```env
AI_SERVICE_URL=https://your-render-service.onrender.com
AI_SERVICE_SECRET=use-a-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-key
FRONTEND_URL=https://your-project.pages.dev
```

## Cloudflare Pages environment variables

```env
VITE_API_URL=https://your-vercel-project.vercel.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key
```

Never add `AI_SERVICE_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` to Cloudflare Pages.

## Render environment variables

```env
ENVIRONMENT=production
AI_SERVICE_SECRET=the-same-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-key
MODEL_NAME=buffalo_l
SIMILARITY_THRESHOLD=0.55
REVIEW_THRESHOLD=0.45
MIN_OBSERVATIONS=5
```

Render should deploy the AI service from `chinmaystudio/test` using its existing Docker/Render configuration. Confirm `GET /health` before connecting Vercel.

## Supabase migration

Apply `supabase/migrations/20260821000000_face_profiles_and_attendance.sql` after reviewing foreign-key compatibility with the existing `students` and `classrooms` tables. Enable RLS before production use and add policies for student self-access and teacher classroom access.

## Frontend API usage

The new frontend service modules are:

```text
src/services/api/faceRegistration.ts
src/services/api/attendance.ts
```

They call Vercel routes:

```text
POST /api/students/face-registration
POST /api/attendance/frame
```

The UI should use the AI response states `MATCHED`, `REVIEW`, `UNKNOWN`, `AMBIGUOUS`, and `REJECTED`. Existing browser-side face recognition must not be used as the authoritative identity decision.

## Validation

```bash
npm ci
npm run lint
npm run build
```

The repository currently validates with TypeScript and a production Vite/Express build. The Vercel API handlers still require project-specific authentication and Supabase persistence wiring before production launch; the placeholder comments mark those boundaries explicitly.
