# Classroom Attendance Portal Fixes

I have resolved the issues preventing the attendance portal from working within specific classrooms and ensured the GUI is fully functional and safe for 50+ student rosters.

## 1. Classroom-Scoped Portal Restored
- **Dedicated Tab:** Added a dedicated **Attendance** tab inside the `ClassroomDetail` view.
- **Proctoring Split:** The "Proctoring" tab now handles only exam integrity monitoring (using the lightweight non-biometric COCO-SSD object model).
- **Session Lifecycle:** When you open an attendance session in the Attendance tab, it now correctly calls Vercel (`/api/attendance/start`) to sync the session state with the Render AI service before capturing frames.

## 2. Full Feature Wiring
- **5-Sample Registration:** The `JoinClassWizard` now correctly captures 5 face samples and uploads them through the Vercel gateway (`/api/students/face-registration`) instead of relying on the removed browser `LocalMLService`.
- **Group Scanning:** The "Scan Group" button correctly captures the frame blob and sends it to the Vercel gateway, which proxies it to Render for ArcFace matching.
- **Manual Review:** If Render returns an `AMBIGUOUS` or `REVIEW` match, the teacher's "Confirm Match" click now calls the Vercel `/api/attendance/review` endpoint to persist the manual decision safely.
- **Session Closure:** Clicking "Close session" now correctly finalizes the session on Render and Supabase.

## 3. 50-Student GUI & Security Fixes
- **Legacy Descriptor Removal:** Removed all wildcard `select('*')` queries in `StudentOverview`, `StudentSettings`, and `StudentPortal` that were accidentally downloading the heavy `face_descriptor` and `face_samples` columns to the browser for every student.
- **Registration Status:** The classroom roster now relies exclusively on the lightweight `face_registration_status` metadata column to show "Biometric ready" or "Needs registration".
- **Deduplication:** Validated that the UI correctly deduplicates identified students so that 50 students can be scanned across multiple frames without duplicate attendance records.

## Next Steps
1. **Redeploy Vercel:** Your backend API needs the latest changes to handle the session start/finish and review routes.
2. **Redeploy Cloudflare Pages:** Your frontend needs the latest changes to display the Attendance tab inside the classroom and use the correct API routes.
3. **Test:** Open a classroom, click the new **Attendance** tab, click **Open Session**, and use **Scan Group**.
