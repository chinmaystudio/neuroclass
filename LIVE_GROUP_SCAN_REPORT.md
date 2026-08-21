# Live Group Attendance Scanner

I have completely rewritten the Group Mode behavior to function as a continuous live scanner.

## What changed
Previously, Group Mode was just a "one-shot" photo button. You had to click it, wait for it to process one frame, and then click it again. 

Now, when you click **Start Live Group Scan**:
1. **Continuous Analysis:** The system automatically captures and sends a camera frame to the AI service every 1.2 seconds. You just move the camera slowly across the classroom.
2. **Live Bounding Boxes:** As the AI service returns coordinates, the frontend draws green bounding boxes directly over the live video feed for any confirmed `PRESENT` students. The boxes track the faces and show the student's name and confidence percentage.
3. **Immediate Logging:** The moment a student is confirmed `PRESENT` by the AI, they are instantly added to the "Attendance Log" on the right side of the screen. The system deduplicates results, so a student is only added to the log once per session even if they remain in the camera view for 10 frames.
4. **Stop Control:** The button turns red and becomes **Stop Live Group Scan**. You can click it at any time to pause the scanning loop.

## Next Steps
This frontend change has been pushed to `chinmaystudio/neuroclass` (Commit `2e74d0f`).

**Please redeploy Cloudflare Pages.**
Once the frontend is redeployed, refresh your browser, select the "Group Mode" tab, and click the new "Start Live Group Scan" button to see the live bounding boxes and automatic log updates in action!
