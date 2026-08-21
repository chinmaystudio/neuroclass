import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://hdjtgyvdlxwntfriqhff.supabase.co';
const defaultSupabasePublishableKey = 'sb_publishable_t2cJNXXRJV_ZmOKyKEAHjA_81pd2cbl';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim() || defaultSupabasePublishableKey;

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
