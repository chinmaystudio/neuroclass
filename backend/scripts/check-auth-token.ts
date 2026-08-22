import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.STUDENT_TEST_EMAIL;
  const password = process.env.STUDENT_TEST_PASSWORD;
  if (!supabaseUrl || !serviceKey || !anonKey || !email || !password) throw new Error('required auth diagnostics are not configured');
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const signIn = await auth.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(`sign-in failed: ${signIn.error?.code || signIn.error?.message || 'unknown'}`);
  const server = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await server.auth.getUser(signIn.data.session.access_token);
  console.log(JSON.stringify({ signedIn: true, serverAccepted: Boolean(result.data.user), error: result.error?.code || null }));
}

void main().catch((error) => { console.error(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' })); process.exitCode = 1; });
