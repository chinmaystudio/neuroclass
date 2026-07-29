import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => (import.meta as any).env[key];

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Initialize with placeholders if missing to prevent crash on module load
const effectiveUrl = supabaseUrl || 'https://qjlfnioglnjympptsuvk.supabase.co';
const effectiveKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbGZuaW9nbG5qeW1wcHRzdXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTAxMDMsImV4cCI6MjA5MjYyNjEwM30.27gdB1_B5Yh6sLz8FdD1umG6TUEjoOQxN76jTyzlpPQ';

console.log('Supabase initialized with URL:', effectiveUrl);

/**
 * SQL SCHEMA FOR SUPABASE:
 * 
 * create table tests (
 *   id uuid default gen_random_uuid() primary key,
 *   userId text not null,
 *   title text not null,
 *   settings jsonb default '{}'::jsonb,
 *   proctoring jsonb default '{}'::jsonb,
 *   sections jsonb default '[]'::jsonb,
 *   layout jsonb default '[]'::jsonb,
 *   appearance jsonb default '{}'::jsonb,
 *   createdAt timestamp with time zone default now(),
 *   updatedAt timestamp with time zone default now()
 * );
 * 
 * -- Enable RLS
 * alter table tests enable row level security;
 * 
 * -- Policies
 * create policy "Users can view their own tests" on tests for select using (auth.uid()::text = userId);
 * create policy "Users can insert their own tests" on tests for insert with check (auth.uid()::text = userId);
 * create policy "Users can update their own tests" on tests for update using (auth.uid()::text = userId);
 * create policy "Users can delete their own tests" on tests for delete using (auth.uid()::text = userId);
 */

export const supabase = createClient(effectiveUrl, effectiveKey);

export const signInWithGoogle = async () => {
  // Use trial-and-error for origin as iframes might have different origins
  const origin = window.location.origin;
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      skipBrowserRedirect: false
    }
  });
  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    }
  });
  if (error) throw error;
  return data;
};

export const fetchTests = async (userId: string) => {
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('userId', userId)
    .order('updatedAt', { ascending: false });
  
  if (error) {
    console.error('Error fetching tests:', error);
    return [];
  }
  return data || [];
};

export const saveTest = async (testData: any, userId: string) => {
  const { id, settings, proctoring, sections, layout, appearance } = testData;
  
  const payload = {
    userId,
    title: settings?.title || 'Untitled Test',
    settings: settings || {},
    proctoring: proctoring || {},
    sections: sections || [],
    layout: layout || [],
    appearance: appearance || {},
    updatedAt: new Date().toISOString(),
  };

  if (id && id !== '') {
    const { data, error } = await supabase
      .from('tests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  } else {
    const { data, error } = await supabase
      .from('tests')
      .insert([{ ...payload, createdAt: new Date().toISOString() }])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  }
};

export const deleteTest = async (testId: string) => {
  const { error } = await supabase
    .from('tests')
    .delete()
    .eq('id', testId);
  
  if (error) throw error;
};
