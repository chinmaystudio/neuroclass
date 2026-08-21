import { supabase } from '../database/supabase';

export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('You must be signed in to use NeuroClass attendance');
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}
