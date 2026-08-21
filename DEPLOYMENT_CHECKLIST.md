# NeuroClass Deployment Checklist

This checklist applies to the commits already pushed to `chinmaystudio/neuroclass` and `chinmaystudio/test`.

## 0. Understand the service boundaries

The final flow is:

```text
Cloudflare Pages frontend
        ↓
Vercel API
        ↓ Authorization: Bearer AI_SERVICE_SECRET
Render FastAPI AI service
        ↓
Supabase PostgreSQL + pgvector
```

The browser must call Vercel only. It must never call Render directly or receive biometric embeddings.

## 1. Create or verify the Supabase project

Open the Supabase dashboard and select the project used by NeuroClass. Before running the migration, inspect the existing `students` and `classrooms` tables and confirm that their IDs are compatible with the UUID columns in the new migration.

Run this file in the Supabase SQL editor:

```text
supabase/migrations/20260821000000_face_profiles_and_attendance.sql
```

Then verify that these tables exist:

```text
face_profiles
face_embeddings
face_profile_versions
learning_observations
attendance_sessions
attendance_observations
attendance
```

Enable and test Row Level Security before production. Students should see only their own profile status. Teachers should see only authorized classrooms and attendance. Public users must not access biometric tables.

## 2. Deploy the AI service to Render

Use the `chinmaystudio/test` repository as the Render AI service source. In Render:

1. Create a new Docker web service or use the repository’s existing `render.yaml` blueprint.
2. Set the service root to the AI repository root.
3. Use the Dockerfile already committed in the repository.
4. Configure these environment variables:

```env
ENVIRONMENT=production
AI_SERVICE_SECRET=generate-a-long-random-secret
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
MODEL_NAME=buffalo_l
SIMILARITY_THRESHOLD=0.55
REVIEW_THRESHOLD=0.45
MIN_OBSERVATIONS=5
MAX_PROFILE_EMBEDDINGS=50
LOG_LEVEL=INFO
```

5. Deploy the service.
6. Open:

```text
https://YOUR_RENDER_SERVICE.onrender.com/health
```

The service must return a healthy response. Confirm that the reported ONNX provider is the actual provider. A CPU provider is acceptable for functional testing, but 30-face group recognition may be slow and Render memory limits may require a larger instance.

## 3. Verify Render authentication

The following request should fail because it has no service token:

```bash
curl -i -X POST https://YOUR_RENDER_SERVICE.onrender.com/ai/v1/attendance/start
```

The Vercel backend must send:

```text
Authorization: Bearer AI_SERVICE_SECRET
```

Never put this secret in Cloudflare Pages variables.

## 4. Configure the Vercel backend

Deploy `chinmaystudio/neuroclass` to Vercel. If the repository is currently configured as a Vite/Express app, confirm that Vercel is also configured to serve the `api/` handlers. Add these Vercel environment variables:

```env
AI_SERVICE_URL=https://YOUR_RENDER_SERVICE.onrender.com
AI_SERVICE_SECRET=THE_SAME_SECRET_USED_ON_RENDER
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
FRONTEND_URL=https://YOUR_CLOUDFLARE_PAGES_DOMAIN
GEMINI_API_KEY=YOUR_EXISTING_KEY
```

Redeploy after saving variables.

Verify:

```text
https://YOUR_VERCEL_PROJECT.vercel.app/api/health
```

The response should show both the Vercel API and the Render AI health status.

## 5. Add authentication before real use

The committed Vercel handlers contain explicit TODO boundaries for the project-specific Supabase JWT validation and classroom/teacher authorization. Implement these before allowing real attendance:

1. Validate the Supabase access token from the request.
2. Confirm the student owns the registration request.
3. Confirm the teacher owns or can manage the classroom session.
4. Confirm the session is active before accepting frames.
5. Write review and finalization decisions to Supabase.
6. Make finalization idempotent using the unique session/student constraint.

Do not treat the current TODO handlers as production-ready authorization.

## 6. Deploy the frontend to Cloudflare Pages

Create a Cloudflare Pages project from the `chinmaystudio/neuroclass` repository.

Use:

```text
Build command: npm run build
Output directory: dist
```

Add only public frontend variables:

```env
VITE_API_URL=https://YOUR_VERCEL_PROJECT.vercel.app
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Do not add `AI_SERVICE_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` to Cloudflare.

## 7. Wire the existing UI

The new frontend service modules are:

```text
src/services/api/faceRegistration.ts
src/services/api/attendance.ts
```

Update the existing `AttendanceSystem.tsx` and face-registration UI to:

1. Capture 5–10 face images during registration.
2. Call `uploadFaceSamples()` for registration.
3. Capture a webcam frame at a controlled interval, initially once every 500–1000 ms.
4. Call `sendAttendanceFrame()`.
5. Draw returned bounding boxes and display `MATCHED`, `REVIEW`, `UNKNOWN`, `AMBIGUOUS`, or `REJECTED`.
6. Allow teacher review.
7. Call the finalization endpoint only after review.

Remove authoritative use of browser `face-api`, `TinyFaceDetector`, `FaceMatcher`, or browser-generated descriptors. Browser-side models may remain only for non-authoritative UI guidance if absolutely necessary.

## 8. Test student registration

Use a consented test account:

1. Join or create a classroom.
2. Open Register Face.
3. Capture 5–10 samples with different small pose changes.
4. Confirm the browser request goes to Vercel, not Render.
5. Confirm the Vercel request reaches Render.
6. Confirm only accepted sample counts and profile status return to the browser.
7. Confirm no embedding appears in the browser response, logs, or network payload.
8. Confirm the profile and embeddings exist in Supabase.

Test rejected samples separately: no face, multiple faces, blur, small face, and invalid image.

## 9. Test group attendance

1. Start an attendance session through Vercel.
2. Capture a frame containing a small number of consented registered participants first.
3. Confirm the frame reaches Vercel and Render.
4. Confirm recognized students are classroom-restricted.
5. Include an unknown participant and confirm the result is `UNKNOWN`, not the closest student.
6. Include a difficult pair and confirm ambiguous results go to `REVIEW` or `AMBIGUOUS`.
7. Confirm repeated frames do not create duplicate final attendance rows.
8. Review uncertain cases and finalize the session.
9. Verify one attendance record per student/session in Supabase.

## 10. Run the performance tests

Benchmark progressively:

```text
10 faces → 25 faces → 30 faces → 50 faces → 75 faces → 100 faces
```

Record detection latency, batch embedding latency, vector search latency, total latency, FPS, memory, CPU, and actual ONNX provider. The first frame will be slower than warmed tracker frames. Do not claim real-time performance until the target Render instance has been measured.

## 11. Production security checklist

Before production, confirm HTTPS on all services, server-side secrets, Render bearer authentication, Vercel auth and classroom authorization, Supabase RLS, rate limiting, audit logs, consent/notice, biometric deletion, retention policy, no raw face images in Git, no public FAISS files, no embeddings in API responses, and a manual attendance fallback when Render is unavailable.

## 12. Current repository status

The integration commit was pushed to `chinmaystudio/neuroclass`. The Render AI contract and authentication changes were pushed to `chinmaystudio/test`. The neuroclass TypeScript check and production build passed locally.

The remaining production-specific work is the Supabase JWT/role authorization implementation and wiring the existing `AttendanceSystem.tsx` UI to the new service modules.
