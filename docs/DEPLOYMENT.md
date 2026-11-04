# Deployment

Nothing in this branch has been deployed. These are the steps to deploy it.

```text
Cloudflare Pages (frontend) ──► Vercel (API) ──► Supabase (DB, auth, storage)
                                   ├──► Render: face recognition (existing AI_SERVICE_URL)
                                   ├──► Render: ml-service (this repo)
                                   └──► Judge0 / Piston sandbox (code execution)
```

## 0. Order of operations

1. **Back up the database**, then apply the three `supabase/migrations/20261105*` files (docs/DATABASE.md).
2. Deploy `ml-service` to Render and note its URL and key.
3. Set the new Vercel environment variables and deploy the API.
4. Deploy the frontend to Cloudflare Pages.
5. Once tests have been checked, retire the old `test_creation` Render service and remove `PORTAL_HANDOFF_SECRET` / `VITE_TEST_PORTAL_URL`.

## 1. Supabase

- Apply the migrations (SQL editor or `supabase db push`).
- Storage: the migration creates the **private** bucket `assignment-files` (50 MB file limit). Leave it private; the API issues signed URLs that expire after 120 seconds.
- Auth: keep email confirmation as you have it. Profiles are now created by the `nc_on_auth_user_created` trigger.

## 2. ML service on Render

The root `render.yaml` is a Blueprint: Render → New → Blueprint → select this repo. It builds `ml-service/Dockerfile`.

| Variable | Value |
|---|---|
| `ML_SERVICE_API_KEY` | long random string (also used as `ML_PROCTORING_API_KEY` on Vercel) |
| `ML_MODEL_VERSION` | `robust-baseline-v1.1.0` |
| `ML_MAX_REQUEST_BYTES` | `65536` (rejects images and video by design) |
| `ML_RATE_LIMIT_PER_MINUTE` | `180` |

Health checks: `GET /health` (liveness) and `GET /ready` (`ready` is true once the key is configured). Free instances sleep when idle. The API treats a sleeping or slow ML service as "unavailable" and the exam continues under the teacher's failure policy.

## 3. API on Vercel

Project root directory: `backend`. Framework preset: Next.js. Build command: `next build`. See `backend/.env.example` for every variable. The new ones are:

| Variable | Notes |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated Cloudflare domains. **Set this in production**; when it's unset the API reflects any origin. |
| `AI_SERVICE_URL`, `AI_SERVICE_SECRET` | Existing face service (also used for attendance). |
| `AI_EXAM_FACE_PATH` | Defaults to `/ai/v1/proctoring/exam-frame`, falling back to `/ai/v1/attendance/frame` on 404. |
| `EXAM_FACE_MATCH_THRESHOLD` | Default 45 (similarity 0–100). |
| `ML_PROCTORING_URL`, `ML_PROCTORING_API_KEY` | ml-service URL and key. |
| `CODE_RUNNER_PROVIDER`, `CODE_RUNNER_URL`, `CODE_RUNNER_AUTH_HEADER`, `CODE_RUNNER_AUTH_TOKEN`, `CODE_RUNNER_RAPIDAPI_HOST`, `CODE_RUNNER_LANGUAGES`, `CODE_RUNNER_HOURLY_LIMIT` | See section 5. |
| `ASSIGNMENT_FILES_BUCKET` | Default `assignment-files`. |
| `PAYMENTS_ENABLED` | `false` |

`/api/v1/[...path]` sets `maxDuration = 60` because grading coding answers on submit makes several sandbox round trips. On the Vercel Hobby plan the effective limit may be lower; if submissions with many hidden tests time out, use fewer or lighter tests, or upgrade the plan.

## 4. Frontend on Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 22 |
| Env | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PAYMENTS_ENABLED=false` (optional: `VITE_MEDIAPIPE_WASM_URL`, `VITE_FACE_LANDMARKER_MODEL_URL`) |

`public/_redirects` provides SPA routing, and `public/_headers` sets security headers (camera allowed for the same origin only). Both lockfiles (`package-lock.json` and `pnpm-lock.yaml`) are kept in sync. Cloudflare uses pnpm when `pnpm-lock.yaml` is present.

The on-device face model loads from jsDelivr and Google Storage by default. For locked-down school networks, host `node_modules/@mediapipe/tasks-vision/wasm/*` and the `face_landmarker.task` model yourself, then set the two `VITE_*` URLs.

## 5. Code execution sandbox

Student code must run in an isolated sandbox. **Neither Vercel nor Render web services can host one safely**: Judge0 and Piston need privileged containers (cgroups, isolate/nsjail). Choose one of these:

| Option | Setup | Variables |
|---|---|---|
| **Self-hosted Judge0 CE** (recommended) | A small VM (e.g. 2 vCPU / 4 GB) running Docker with cgroup v1 or the documented v2 workaround. Follow Judge0's `docker-compose` deployment and set an `AUTHN_TOKEN`. Firewall it so only Vercel can reach it. | `CODE_RUNNER_PROVIDER=judge0`, `CODE_RUNNER_URL=https://judge0.your-domain`, `CODE_RUNNER_AUTH_HEADER=X-Auth-Token`, `CODE_RUNNER_AUTH_TOKEN=…` |
| Judge0 via RapidAPI | Fastest to try. Your code is sent to a third party, so check that your institution allows it. | `CODE_RUNNER_PROVIDER=judge0`, `CODE_RUNNER_URL=https://judge0-ce.p.rapidapi.com`, `CODE_RUNNER_AUTH_HEADER=X-RapidAPI-Key`, `CODE_RUNNER_AUTH_TOKEN=…`, `CODE_RUNNER_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com` |
| Self-hosted Piston | Privileged Docker host; install the runtimes you need with `ppman`. | `CODE_RUNNER_PROVIDER=piston`, `CODE_RUNNER_URL=https://piston.your-domain` |

Until one is configured, `/code/run` returns 503 with a clear message. Coding submissions are still accepted and flagged for manual grading, and teachers can **Re-run code tests** later. Restrict `CODE_RUNNER_LANGUAGES` to the runtimes your sandbox actually has installed.

## 6. Smoke test after deploying

1. `GET https://<api>/api/health` returns 200. Calling `GET https://<api>/api/v1/code/languages` without a token returns 401.
2. Teacher: open a classroom → Tests → create a test with one multiple-choice and one coding question → publish.
3. Student (enrolled): Tests → Start → consent → verify → start. Answer, refresh the page (the answer is kept), then submit.
4. Teacher: Results → review → grade → release. Student: view the result.
5. A student from another classroom calling `GET /api/v1/tests/<id>` gets a 404.

## Rollback

- Frontend and API: redeploy the previous build in Cloudflare and Vercel (instant rollback).
- Database: see DATABASE.md → Rollback. The new tables are additive, so older app versions keep working with them in place. Older versions that read `tests.questions` from the browser **will not work** after migration 0100. That is intentional, because it closes the answer-key leak.
- The old `test_creation` service can be redeployed from its own repository if needed. Its `tc_*` tables are not dropped.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every API call fails with a CORS error | `ALLOWED_ORIGINS` doesn't include the exact Cloudflare origin (scheme and host, no trailing slash). |
| "Face verification is temporarily unavailable" | `AI_SERVICE_URL` or `AI_SERVICE_SECRET` is missing, or the Render face service is asleep (the first call can take about 50 seconds). |
| "Code execution is not configured" | Set the `CODE_RUNNER_*` variables (section 5). |
| The proctoring badge says "Camera on" but never "Monitoring" | MediaPipe assets are blocked by the network. Self-host them (section 4). |
| Students see "Test not found" | They are not enrolled in that classroom, or the test is still a draft. |
