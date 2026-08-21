# Backend Diagnostic & Deduplication Deployment Instructions

I have investigated the ongoing "UNABLE TO PERSIST REVIEWED ATTENDANCE" error and pushed a new patch to address two critical database issues.

## What Was Fixed

1. **AI Face Deduplication:**
   When the AI service detects the same student multiple times in a single frame (e.g., if it draws two boxes for one face, or detects a reflection), the backend previously attempted to insert multiple attendance rows for the same `student_id`. This triggered a **Unique Constraint Violation** in the database, failing the entire transaction. I have updated `aiGateway.ts` to deduplicate all recognized faces by `student_id` before inserting them into the database.

2. **Missing `marked_by` Constraint:**
   The Supabase Row-Level Security (RLS) policies for the `attendance` table require the `marked_by` column to match the authenticated teacher's ID (`attendance.marked_by = auth.uid()::text`). This column was missing from the backend's manual capture payload, causing the database to reject the insert. I have added `marked_by: auth.user.id` to the payload.

3. **Detailed Error Surfacing:**
   Previously, the backend swallowed the exact database error and returned a generic "Unable to persist reviewed attendance" string. If the error happens again, the UI will now show the exact Supabase database error (e.g., "duplicate key value violates unique constraint" or "new row violates row-level security policy"), making it instantly clear what the database is rejecting.

## Action Required: Redeployments

You must trigger a manual redeployment of your Vercel backend to push these changes to production:

1. **Vercel (Backend):** Redeploy the `chinmaystudio/neuroclass` backend.
   - *Why:* To apply the face deduplication, the `marked_by` payload addition, and the detailed error surfacing.
   - *Next Steps:* After Vercel finishes deploying, refresh your classroom page and try the "Capture Photo & Analyze" button again. If it succeeds, the issue is resolved. If it fails, the red banner will now contain the exact technical database error, which will tell us exactly what Supabase is rejecting.
