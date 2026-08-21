# Live Preview & Manual Capture Workflow

I have updated the Group Mode scanner to exactly match your requested workflow.

## 1. Live Preview (Green Boxes)
When you click **Start Live Face Preview**, the camera will continuously analyze the room. Green boxes will appear around detected students to show you who the ML model currently sees, but **no attendance is permanently recorded yet**. This lets you adjust the camera angle until everyone is visible.

## 2. Authoritative Capture
When you are ready, click **Capture Photo & Analyze**. 
- The system takes exactly one high-quality photo and sends it to the ML service.
- The ML service processes it and returns the confirmed students.
- The Vercel backend immediately logs those students as `Present` in the database.
- The students instantly appear in the Attendance Log on the right side of the screen.

You can click "Capture Photo & Analyze" as many times as you want. The system automatically deduplicates, so a student is only marked present once per session.

## 3. Final Session Report
When attendance is done and you click **Close Session**:
- The system stops the camera.
- The backend aggregates the entire session and generates a final report.
- A summary appears on the screen showing `Present`, `Absent`, and the `Attendance Rate`.
- You can click **Download Final Report** to get a JSON file containing every student's final status and confidence score for your records.

## Next Steps
This update requires both frontend and backend changes. I have pushed them to `chinmaystudio/neuroclass` (Commit `55c7c7b`).

**Please redeploy both Vercel and Cloudflare Pages.**
Once deployed, you can use the "Start Live Face Preview" to line up the shot, and the "Capture Photo" button to permanently log attendance!
