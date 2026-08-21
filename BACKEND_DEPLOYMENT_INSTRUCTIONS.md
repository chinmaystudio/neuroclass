# Backend Deployment Instructions

I have identified and permanently fixed the "UNABLE TO PERSIST REVIEWED ATTENDANCE" error.

## What Was Fixed

**The Root Cause:**
The error occurred because the backend was attempting to use Supabase's `upsert` method with the `onConflict: 'session_id,student_id'` constraint. However, in the Supabase schema, `attendance_session_student_idx` is defined as a **partial index** (`WHERE session_id IS NOT NULL`). PostgreSQL (and by extension Supabase) explicitly prohibits using a partial index for `ON CONFLICT` resolution during an `upsert`. Because of this database engine limitation, the manual capture and review endpoints were throwing a 500 Gateway Error whenever they tried to materialize the attendance.

**The Fix:**
I rewrote the attendance persistence logic in `backend/lib/aiGateway.ts` and `backend/app/api/attendance/review/route.ts`. Instead of relying on the unsupported partial-index `upsert`, the backend now securely queries for existing attendance records first, and then explicitly performs an `insert` for new records and an `update` for existing ones. This bypasses the PostgreSQL constraint limitation entirely while maintaining full data integrity.

## Action Required: Redeployments

You must trigger a manual redeployment of your Vercel backend to push these changes to production:

1. **Vercel (Backend):** Redeploy the `chinmaystudio/neuroclass` backend.
   - *Why:* To apply the fixed attendance persistence logic that prevents the "UNABLE TO PERSIST REVIEWED ATTENDANCE" error during manual photo captures and manual attendance reviews.
