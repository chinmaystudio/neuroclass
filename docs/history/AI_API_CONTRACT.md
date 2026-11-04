# NeuroClass Vercel-to-Render API Contract

This document specifies the exact internal API payloads exchanged between the Vercel API Gateway and the Render AI Service during attendance capture.

## 1. Frame Processing Request (Vercel -> Render)

**Endpoint:** `POST https://neuroclass-ai-kktd.onrender.com/ai/v1/attendance/frame`  
**Content-Type:** `multipart/form-data`  
**Authentication:** `Authorization: Bearer <AI_SERVICE_SECRET>`

### Payload Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `classroom_id` | `string` | The canonical Supabase UUID of the classroom. |
| `session_id` | `string` | The canonical Supabase UUID of the active attendance session. |
| `capture_mode` | `string` | `"live"` for continuous preview frames, `"manual"` for teacher-triggered captures. |
| `file` | `File (Blob)` | The captured frame as a JPEG binary blob. |

## 2. Frame Processing Response (Render -> Vercel)

**Content-Type:** `application/json`

### Payload Structure

```json
{
  "classroom_id": "uuid-string",
  "timestamp": 1692612345.123,
  "results": [
    {
      "track_id": 1,
      "student_id": "uuid-string-or-null",
      "name": "Student Name or null",
      "similarity": 0.88,
      "status": "PRESENT",
      "confidence": "HIGH",
      "verification": "AUTO",
      "observations": 5,
      "already_confirmed": false,
      "bbox": [100.0, 150.0, 200.0, 250.0]
    }
  ]
}
```

### Field Definitions

*   **`track_id`**: Integer identifying the tracked face across consecutive live frames.
*   **`student_id`**: The canonical Supabase UUID of the matched student, or `null` if the face is unknown or unconfirmed.
*   **`name`**: The enrolled name of the matched student, or `null`.
*   **`similarity`**: The ArcFace cosine similarity score (0.0 to 1.0) against the matched enrollment profile.
*   **`status`**: `"PRESENT"` (confirmed match), `"REVIEW"` (low confidence match), or `"UNKNOWN"` (no match or rejected).
*   **`confidence`**: `"HIGH"`, `"MEDIUM"`, or `"LOW"`.
*   **`verification`**: `"AUTO"` (confirmed by threshold) or `"MANUAL"` (requires teacher review).
*   **`observations`**: The number of consecutive frames this face has been tracked (used for temporal stability).
*   **`already_confirmed`**: Boolean indicating if this student was already marked present in an earlier frame of this session.
*   **`bbox`**: Array of four floats `[x1, y1, x2, y2]` representing the face bounding box in the original image coordinates.
