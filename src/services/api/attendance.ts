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
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to process attendance frame');
  }

  return response.json();
}
