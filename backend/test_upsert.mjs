import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('attendance').upsert([{
    session_id: '00000000-0000-0000-0000-000000000000',
    classroom_id: '00000000-0000-0000-0000-000000000000',
    student_id: '00000000-0000-0000-0000-000000000000',
    student_name: 'Test',
    status: 'Present'
  }], { onConflict: 'session_id,student_id' });
  console.log('Error:', error);
}
test();
