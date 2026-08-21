# Live Capture Browser Findings

The live browser session is on `https://neuroclass.pages.dev/teacher`, classroom `AI`, code `SB92JQ`. The classroom detail page loads the enrolled student Chinmay Joshi, roll 089, marked `NEEDS REGISTRATION`.

The live classroom navigation contains an `ATTENDANCE` tab and the connected browser click highlights it, but the extracted content still shows the roster view. The user-provided screenshot shows the camera stream is active, the `Register Face` mode is selected, the student is selected, and the green capture control is disabled while the status line says `Next step: open an attendance session.` This means the registration UI is incorrectly coupled to attendance session state. Face sample capture should only require a selected student and an active camera; Group Scan should remain session-gated.
