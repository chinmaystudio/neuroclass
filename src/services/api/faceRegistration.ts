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

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/students/face-registration`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to register face samples');
  }

  return response.json();
}
