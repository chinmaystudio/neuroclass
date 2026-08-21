import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://hdjtgyvdlxwntfriqhff.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
  const toInsert = [{
    session_id: '123e4567-e89b-12d3-a456-426614174000',
    classroom_id: '123e4567-e89b-12d3-a456-426614174000',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
    student_name: 'Test Student',
    status: 'Present',
    verified_method: 'Teacher Face-ID Biometric (Manual Capture)'
  }];
  const { data, error } = await supabase.from('attendance').insert(toInsert);
  console.log('Insert Error:', error);
}
test();
