# NeuroClass AI Architecture Refactoring Report

## 1. Architectural Changes Implemented

The `chinmaystudio/neuroclass` repository has been completely refactored to remove browser-side authoritative face recognition. The browser now acts solely as a camera client, while Vercel orchestrates the business logic and Render performs the actual biometric processing.

### Browser (Cloudflare Pages)
- **Removed:** All `face-api.js` models (`tiny_face_detector`, `face_landmark_68`, `face_recognition_model`, `ssd_mobilenetv1_model`) and the `FaceMatcher` library.
- **Removed:** Client-side face descriptor generation and embedding comparison.
- **Updated:** `AttendanceSystem`, `StudentAttendanceModal`, and `JoinClassWizard` now capture simple image blobs and send them to the Vercel API gateway.
- **Preserved:** Non-biometric proctoring (COCO-SSD object detection) remains browser-side for real-time exam monitoring without sending continuous video feeds to the server.

### API Gateway (Vercel)
- **Added:** Native Next.js App Router endpoints under `backend/app/api/` for `face-registration`, `attendance/start`, `attendance/frame`, `attendance/review`, and `attendance/finalize`.
- **Security:** All AI endpoints require a valid Supabase JWT and enforce classroom ownership before proxying requests to Render.
- **Persistence:** The Vercel layer now orchestrates Supabase persistence, ensuring that Render's `MATCHED`, `REVIEW`, and `UNKNOWN` results are stored securely in `attendance_observations` and `attendance`.

### AI Service (Render)
- The Render service (`chinmaystudio/test`) remains the authoritative source for biometric embeddings, using ArcFace and InsightFace.
- The browser never communicates with Render directly, and Render never returns raw embeddings to the browser.

## 2. Deployment Instructions

### Vercel Backend Deployment
1. Ensure your Vercel project is connected to `chinmaystudio/neuroclass` and the root directory is set to `backend`.
2. Add the following environment variables in Vercel:
   ```env
   AI_SERVICE_URL=https://neuroclass-ai-kktd.onrender.com
   AI_SERVICE_SECRET=your-secure-secret-matching-render
   SUPABASE_URL=https://hdjtgyvdlxwntfrighff.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```
3. Trigger a redeployment in Vercel.

### Cloudflare Pages Frontend Deployment
1. Ensure your Cloudflare Pages project is connected to `chinmaystudio/neuroclass`.
2. Add the following environment variables in Cloudflare:
   ```env
   VITE_API_URL=https://neuroclass-swart.vercel.app
   VITE_SUPABASE_URL=https://hdjtgyvdlxwntfrighff.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Trigger a redeployment in Cloudflare Pages.

## 3. Verification

Once deployed, open Chrome DevTools Network tab on `https://neuroclass.pages.dev`. You will no longer see requests for `tiny_face_detector_model` or `face_recognition_model`. Face enrollment and attendance will securely route through `https://neuroclass-swart.vercel.app` to your Render service.
