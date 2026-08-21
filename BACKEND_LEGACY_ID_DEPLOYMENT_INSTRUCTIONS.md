# Backend Legacy ID Deployment Instructions

I have identified and resolved the root cause of the "null value in column student_id_legacy" error.

## What Was Fixed

The detailed error message successfully revealed another mismatch between the deployed code and your live database: your live Supabase `attendance` table has a custom column named `student_id_legacy` that is set to `NOT NULL`. 

Because the backend was recently upgraded to use canonical UUIDs for `student_id`, it was not sending a value for this legacy column. Since the column cannot be null, the database rejected the save operation.

I have updated the backend persistence logic in `aiGateway.ts` and `review/route.ts` to explicitly populate `student_id_legacy` with the canonical student ID during the save operation. This satisfies the database's `NOT NULL` constraint without weakening the system's new UUID-based identity architecture.

## Action Required: Redeployments

You must trigger a manual redeployment of your Vercel backend to push this fix to production:

1. **Vercel (Backend):** Redeploy the `chinmaystudio/neuroclass` backend.
   - *Why:* To apply the code changes that populate the `student_id_legacy` column and satisfy the database constraints.
   - *Next Steps:* After Vercel finishes deploying, refresh your classroom page and try the "Capture Photo & Analyze" button again. It should now successfully save the attendance records.
