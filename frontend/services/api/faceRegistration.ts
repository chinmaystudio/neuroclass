import { getApiAuthHeaders } from '../../lib/api-auth';
import { getApiUrl } from '../../config/apiConfig';

export async function uploadFaceSamples(
  studentId: string, 
  classroomId: string, 
  images: Blob[]
) {
  const formData = new FormData();
  formData.append('student_id', studentId);
  formData.append('classroom_id', classroomId);
  formData.append('registration_session_id', crypto.randomUUID());
  
  images.forEach((blob, i) => {
    formData.append('files', blob, `sample_${i}.jpg`);
  });

  const response = await fetch(getApiUrl('/api/students/face-registration'), {
    method: 'POST',
    headers: await getApiAuthHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : payload.detail?.error;
    throw new Error(payload.error || detail || 'Failed to register face samples.');
  }

  return payload;
}
