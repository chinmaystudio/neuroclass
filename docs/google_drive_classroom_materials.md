# Google Drive classroom materials

NeuroClass supports a teacher-connected Google Drive workflow for classroom study materials. A teacher connects Google Drive from the Materials tab of a teacher-owned classroom. The backend stores the OAuth refresh token encrypted with a server-only key, creates a dedicated folder named `NeuroClass - <classroom> (<id-prefix>)`, and records the Google Drive folder ID against the NeuroClass classroom.

Teachers can upload a supported file directly to the classroom Drive folder through NeuroClass or open the folder in Google Drive, refresh the file list, and import one selected file. The first supported formats are PDF, DOCX, TXT, Markdown, CSV, JSON, and Google Docs. Imported files are copied into the existing private Supabase classroom-material bucket, then processed by the existing extraction worker so the classroom tutor can use them after `extraction_status=ready`.

Students do not receive raw Drive links or Drive permissions. The student Materials tab calls the protected NeuroClass API, which verifies the student’s Supabase identity and enrollment in the exact classroom before listing materials. Downloads are returned as short-lived signed URLs from private NeuroClass storage. Removing a student from the classroom blocks new listing and download requests.

## Backend configuration

Configure the following values only in the NeuroClass backend deployment environment:

| Variable | Purpose |
|---|---|
| `GOOGLE_DRIVE_CLIENT_ID` | Google Cloud OAuth web-client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Google Cloud OAuth web-client secret |
| `GOOGLE_DRIVE_REDIRECT_URI` | Exact HTTPS callback URL ending in `/api/google-drive/callback` |
| `GOOGLE_DRIVE_FRONTEND_ORIGIN` | Allowlisted NeuroClass frontend origin, normally `https://neuroclass.pages.dev` |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | 32-byte key encoded as 64 hex characters or base64 |
| `GOOGLE_DRIVE_STATE_SECRET` | Optional separate long random HMAC secret for OAuth state |
| `CLASSROOM_MATERIALS_BUCKET` | Existing private bucket name, normally `classroom-materials` |

Enable the Google Drive API in the Google Cloud project and register the exact redirect URI on the OAuth web client. The implementation requests the narrow `https://www.googleapis.com/auth/drive.file` scope. Google’s current OAuth guidance recommends server-side OAuth for web applications that can store confidential state and tokens, and Google Drive’s file and permission APIs document the supported creation and sharing scopes [1] [2] [3].

## Operational boundaries

The Google Drive connection is teacher-scoped, but classroom membership remains a NeuroClass concern. The implementation does not make folders public, grant domain-wide access, add student Drive ACLs, or expose refresh tokens. A teacher must own the classroom before creating its Drive folder or importing a file. A selected Drive file must be a direct child of the mapped classroom folder before it is downloaded.

The OAuth client secret and token-encryption key must never be placed in the frontend, repository, browser URL, GitHub Actions logs, or chat. Rotate the encryption key only with a planned token re-encryption migration; changing it without re-encrypting stored tokens invalidates existing connections.

## References

[1]: https://developers.google.com/identity/protocols/oauth2/web-server "Using OAuth 2.0 for Web Server Applications"
[2]: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create "Google Drive API files.create"
[3]: https://developers.google.com/workspace/drive/api/guides/manage-sharing "Google Drive API sharing and permissions"
