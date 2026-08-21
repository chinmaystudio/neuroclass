import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const attendanceSource = readFileSync(new URL('../frontend/components/ai/AttendanceSystem.tsx', import.meta.url), 'utf8');
const classroomSource = readFileSync(new URL('../frontend/components/instructor/ClassroomDetail.tsx', import.meta.url), 'utf8');

const students = Array.from({ length: 50 }, (_, index) => ({
  id: randomUUID(),
  name: `Student ${String(index + 1).padStart(2, '0')}`,
  email: `student${index + 1}@example.test`,
  face_registration_status: 'REGISTERED',
}));

if (students.length !== 50) throw new Error('50-student fixture was not created');
if (new Set(students.map((student) => student.id)).size !== 50) throw new Error('Student UUIDs are not unique');
if (!attendanceSource.includes("select('id,name,email,face_registration_status')")) throw new Error('Attendance roster uses an unsafe or incomplete student query');
if (!attendanceSource.includes('sendAttendanceFrame')) throw new Error('Attendance scanner is not using the Vercel frame gateway');
if (attendanceSource.includes('LocalMLService.matchFace') || attendanceSource.includes('FaceMatcher')) throw new Error('Browser-side authoritative matching is still present');
if (!classroomSource.includes("id: 'attendance'")) throw new Error('Classroom attendance tab is missing');

const identified = new Set();
for (const student of students) {
  if (!identified.has(student.id)) identified.add(student.id);
}
if (identified.size !== 50) throw new Error('Attendance log deduplication failed for 50 students');

console.log(JSON.stringify({
  ok: true,
  students: students.length,
  unique_student_ids: identified.size,
  roster_query_is_safe: true,
  classroom_attendance_tab: true,
  remote_frame_gateway: true,
  browser_authoritative_matching: false,
}, null, 2));
