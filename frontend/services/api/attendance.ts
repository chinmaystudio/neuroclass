import { getApiAuthHeaders } from '../../lib/api-auth';

export async function startAttendanceSession(classroomId: string, sessionId: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/attendance/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ classroom_id: classroomId, session_id: sessionId }),
  });
  if (!response.ok) throw new Error('Failed to start attendance session');
  return response.json();
}

export async function finalizeAttendanceSession(sessionId: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/attendance/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) throw new Error('Failed to finalize attendance session');
  return response.json();
}

export async function reviewAttendanceObservation(sessionId: string, observationId: string, decision: 'PRESENT' | 'ABSENT', studentId?: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/attendance/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ session_id: sessionId, observation_id: observationId, decision, student_id: studentId }),
  });
  if (!response.ok) throw new Error('Failed to record attendance review');
  return response.json();
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

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/attendance/frame`, {
    method: 'POST',
    headers: await getApiAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to process attendance frame');
  }

  return response.json();
}
