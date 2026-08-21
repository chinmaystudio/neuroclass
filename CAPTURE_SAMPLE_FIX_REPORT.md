# Capture Sample Workflow Fix

I have resolved the issue where the "Capture Sample" button was disabled with the message "Next step: open an attendance session."

## Root Cause
The `Register Face` mode was accidentally sharing the exact same strict requirements as `Group Mode`. The UI was demanding an active teacher attendance session before it would let you capture face samples. This was a logical error: attendance sessions are for tracking who is in class on a specific day, but face registration is a one-time setup that should be possible at any time, as long as you own the classroom and the camera is on.

## Fixes Implemented
- **Independent Registration Logic:** The "Register Face" tab now operates independently of the attendance session. You no longer need to click "Open Session" to register a face.
- **Auto-Camera Activation:** If the camera is off, clicking "Capture Sample" will now automatically start the camera, wait for the video stream to become ready, and capture the sample in one smooth flow.
- **Clear Progress Feedback:** The UI now explicitly updates as you capture each of the 5 required samples, and tells you when it is uploading them to the secure gateway.
- **Group Scan Convenience:** As a bonus, I also updated the Group Scan button so that if you *do* click it without an open session, it will automatically open the session and start the camera for you, removing all friction.

## Next Steps
The frontend changes have been pushed to `chinmaystudio/neuroclass` (Commit `6339ac8`).

**Please redeploy Cloudflare Pages.**

Once the frontend finishes deploying:
1. Refresh the classroom page.
2. Go to the **Attendance** tab.
3. Select **Register Face** and pick a student.
4. Click **Capture Sample**. It will start the camera and take the first photo immediately.
5. Capture 5 samples to complete registration.
