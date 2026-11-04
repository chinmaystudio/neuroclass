# Persistence and Latency Improvements

## Why the Green Box Appeared Before Attendance Failed
The screenshot showed a green `PRESENT STUDENT` box while the bottom error banner read `Unable to persist reviewed attendance`. 

This happened because the green box is drawn by the browser immediately when the Render AI service returns a confirmed match. The browser then made a second request to Vercel to save that confirmed match to the database. If that second database request failed, the green box remained on screen because the AI *did* recognize the student, but the student was not added to the Attendance Log.

## The Fix: One-Step Batch Persistence
I have removed the fragile two-step process. When you click **Capture Photo & Analyze**, the Vercel backend now receives the AI result and saves the attendance rows to the Supabase database in a single transaction *before* returning the result to the browser. 

If a database error occurs, the photo capture is safely rejected so you know exactly what happened. When it succeeds, all students in the photo are persisted simultaneously, making the Attendance Log 100% reliable.

## Faster Live Preview
When multiple people walked into the frame, the live preview was slow to react because it was waiting for five consecutive frames to confirm a face, and the browser was pausing for over a second between frames.

I have optimized this path:
1. **Faster confirmation:** The AI service now only requires 3 consecutive frames to confirm a live face, reducing the time you have to hold the camera steady.
2. **Faster polling:** The browser now requests the next live frame after 450 milliseconds instead of 1,200 milliseconds, making the green boxes track moving faces much more smoothly.

## Deployment Steps
These changes span both the AI service and the Vercel backend. I have pushed them to GitHub (Commits `a50c1eb` and `404ef16`).

**Please redeploy both the Render AI service and the Vercel backend.**
Once deployed, refresh the Cloudflare page. The live preview will track faces faster, and clicking "Capture Photo" will reliably save all recognized students to the database at once.
