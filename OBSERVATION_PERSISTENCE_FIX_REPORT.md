# Attendance Observation Persistence Fix

The latest screenshot confirms that the attendance session and camera now start correctly. The final failure was `Unable to persist attendance observations` after the Render AI service returned a frame result.

## Root Cause
The Vercel gateway was inserting a field named `verification_method` into `public.attendance_observations`. The live Supabase table uses the canonical column name `verification`. The insert therefore failed even though the AI scan request itself succeeded.

The gateway also mapped the Render similarity score into `confidence` only. The live table contains both `similarity` and `confidence`, so the persistence mapping has been corrected to preserve the Render similarity score and the textual confidence/verification values.

## Fix Implemented
The Vercel persistence helper now writes only the live observation columns:

| Render result | Supabase column |
| --- | --- |
| `student_id` | `student_id` |
| `track_id` | `track_id` |
| `status` | `status` |
| `similarity` | `similarity` |
| Render confidence value, when numeric | `confidence` |
| `verification` | `verification` |

The browser still receives no embeddings. The frame is processed by Render, and the Vercel gateway remains the only component that persists observation metadata.

## Validation and Commit
The frontend and backend builds pass, and the live Supabase schema was verified before applying the mapping fix. The correction is pushed to `chinmaystudio/neuroclass` in commit `36ae7c1`.

## Retest
Redeploy the Vercel backend from commit `36ae7c1` if the GitHub integration has not already deployed it. Cloudflare Pages does not need a new frontend change for this correction. Refresh the classroom page, keep the attendance session open, and click `Scan Group`. The scan should now return results without the observation-persistence error.
