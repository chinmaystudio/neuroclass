# Render Multi-Face, API Contract, and 1,000-Student Benchmark Report

## Executive Summary

The Render service now performs aligned crop extraction once per detected face, sends all new-face crops through the existing ArcFace batch API, skips embeddings for already-confirmed stable tracks, and uses a lighter tracker IoU calculation. These changes preserve the single `buffalo_s` model and CPU-safe architecture; they do not add model files or increase the model memory footprint.

The exact Vercel-to-Render capture contract is documented separately in [`AI_API_CONTRACT.md`](./AI_API_CONTRACT.md). The live Supabase vector verification is documented in [`SUPABASE_VECTOR_SCHEMA.md`](./SUPABASE_VECTOR_SCHEMA.md).

## Exact Capture Contract

For each frame, Vercel sends Render a multipart request to `POST /ai/v1/attendance/frame` with the following fields: `classroom_id`, `session_id`, `capture_mode`, and the JPEG `file`. Vercel authenticates the teacher and forwards the multipart image to Render with the private `AI_SERVICE_SECRET`; the browser never calls Render directly.

Render returns JSON containing `classroom_id`, a timestamp, and a `results` array. Each result contains a track ID, canonical student UUID or null, name or null, ArcFace similarity, status, confidence, verification mode, observation count, and `[x1, y1, x2, y2]` bounding-box coordinates. For manual captures, the Vercel gateway then performs the authoritative attendance materialization before returning the result to the browser.

## Live Supabase Verification

The live NeuroClass project is `hdjtgyvdlxwntfriqhff`. Read-only metadata confirmed that `public.face_embeddings.embedding` is a PostgreSQL `vector` column with a type modifier of **512**, meaning the live column is `vector(512)`. The table also contains UUID fields for `profile_id`, `student_id`, and `classroom_id`, plus `source`, `quality_score`, and `created_at` metadata.

A read-only live count returned `rows = 0` and `embeddings = 0`. This means the schema is ready, but the connected production database currently has no persisted embedding rows. The 1,000-student benchmark therefore validates the local FAISS/ArcFace recognition path and one-vector-per-student storage accounting; it must not be interpreted as proof that production enrollment data is already populated in Supabase.

## 1,000-Identity Recognition Benchmark

The benchmark used the repository’s LFW-based held-out evaluation harness with 1,000 registered identities, 999 successfully populated profile vectors, 500 present roster identities, 500 absent roster identities, and 680 unknown impostor identities. It used `buffalo_s`, ArcFace, `CPUExecutionProvider`, and one normalized centroid vector per registered identity.

At the benchmark’s zero-false-accept operating point, the threshold was 0.58. It produced 783 true positives, 217 false negatives, 0 false positives, and 680 true negatives, corresponding to 78.3% genuine recognition, 21.7% false rejection, and 0.0% false acceptance. At lower thresholds, genuine recognition increases but false acceptance is non-zero; this is an engineering stress test and not a demographic or real-classroom accuracy claim.

The benchmark measured 43.23 ms average embedding latency and 56.25 ms p95 embedding latency for the held-out embedding evaluation. Resident memory increased from approximately 137.35 MiB before the index to 231.82 MiB after the 999-vector local index. The raw 999-vector payload was approximately 1.95 MiB before database and index overhead.

## Multi-Face Throughput Benchmark

A separate stitched 30-face classroom stress frame was processed through the actual `AttendanceEngine` path. The warm-up took 0.660 seconds. Five cold runs averaged **0.710 seconds per frame**, with p95 cold latency of **0.724 seconds**, returning an average of 36 result records and an estimated 1.41 frames per second on the sandbox CPU using `buffalo_s`. This is a CPU throughput measurement, not a claim that 30 real classroom faces will always be detected or recognized at that rate.

## Validation and Commits

The Render test suite passed all four tests. Python compilation and repository diff checks passed. The NeuroClass frontend lint and production build passed, with the existing bundle-size warning remaining non-blocking.

The product repository contains the API and schema documentation. The AI repository contains the Render multi-face optimization and the reproducible throughput benchmark script. The final code changes should be deployed to Render before measuring latency in the user’s live classroom.

## Deployment Notes

Redeploy the `chinmaystudio/test` Render service to apply the multi-face optimization. The product repository documentation does not change the deployed runtime by itself. After deployment, re-enroll at least one test student and verify that a corresponding row appears in `public.face_embeddings`; the current live count of zero means this production persistence check is still required.
