import { getApiAuthHeaders } from '../../lib/api-auth';
import { getApiUrl } from '../../config/apiConfig';

async function parseResponse(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : payload.detail?.error;
    throw new Error(payload.error || detail || fallback);
  }
  return payload;
}

export async function startAttendanceSession(classroomId: string, sessionId: string) {
  const response = await fetch(getApiUrl('/api/attendance/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ classroom_id: classroomId, session_id: sessionId }),
  });
  return parseResponse(response, 'Failed to start attendance session.');
}

export async function finalizeAttendanceSession(sessionId: string) {
  const response = await fetch(getApiUrl('/api/attendance/finalize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return parseResponse(response, 'Failed to finalize attendance session.');
}

export async function reviewAttendanceObservation(sessionId: string, observationId: string, decision: 'PRESENT' | 'ABSENT', studentId?: string) {
  const response = await fetch(getApiUrl('/api/attendance/review'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ session_id: sessionId, observation_id: observationId, decision, student_id: studentId }),
  });
  return parseResponse(response, 'Failed to record attendance review.');
}

export async function sendAttendanceFrame(
  classroomId: string,
  sessionId: string,
  imageBlob: Blob
) {
  const formData = new FormData();
  formData.append('classroom_id', classroomId);
  formData.append('session_id', sessionId);
  formData.append('file', imageBlob, 'frame.jpg');

  const response = await fetch(getApiUrl('/api/attendance/frame'), {
    method: 'POST',
    headers: await getApiAuthHeaders(),
    body: formData,
  });

  return parseResponse(response, 'Failed to process attendance frame.');
}
