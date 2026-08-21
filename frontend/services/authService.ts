import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../database/supabase';

export type AppUser = SupabaseUser;

type AppRole = 'teacher' | 'student';

function requireSupabaseConfiguration(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the frontend deployment environment.'
    );
  }
}

function formatAuthError(error: { message?: string; name?: string }): Error {
  const message = error.message?.trim();
  if (message === 'Failed to fetch' || error.name === 'TypeError') {
    return new Error(
      'Unable to reach Supabase authentication. Verify the frontend Supabase URL, publishable key, and deployment network settings.'
    );
  }
  return new Error(message || 'Authentication request failed. Please try again.');
}

export const authService = {
  async signUpWithEmail(
    email: string,
    password: string,
    name: string,
    phone: string,
    role: AppRole
  ): Promise<AppUser> {
    requireSupabaseConfiguration();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          role: role,
        },
      },
    });

    if (error) throw formatAuthError(error);
    if (!data.user) throw new Error('Sign-up did not return a user. Please try again.');

    const { error: profileError } = await supabase.from('users').upsert(
      {
        uid: data.user.id,
        email: data.user.email,
        displayName: name.trim(),
        photoURL: '',
        mobile_number: phone.trim(),
        role: role,
        createdAt: new Date().toISOString(),
      },
      { onConflict: 'uid' }
    );

    if (profileError) {
      console.warn('Supabase account created, but the application profile could not be saved:', profileError.message);
    }

    return data.user;
  },

  async signInWithEmail(email: string, password: string): Promise<AppUser> {
    requireSupabaseConfiguration();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw formatAuthError(error);
    if (!data.user) throw new Error('Sign-in did not return a user. Please try again.');

    return data.user;
  },

  async setUserRole(uid: string, role: AppRole): Promise<void> {
    if (!uid) return;
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('users').upsert(
          {
            uid,
            role,
          },
          { onConflict: 'uid' }
        );
      } catch (err) {
        console.warn('Unable to persist role update to Supabase:', err);
      }
    }
  },

  async getUserRole(uid: string): Promise<AppRole> {
    if (!uid) throw new Error('Cannot resolve a role without an authenticated user.');
    requireSupabaseConfiguration();

    try {
      // The profile row is the source of truth. Do not trust localStorage for authorization.
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('uid', uid)
        .maybeSingle();

      if (userError) throw userError;
      if (userRow?.role === 'student' || userRow?.role === 'teacher') return userRow.role;

      const { data: authData } = await supabase.auth.getUser();
      const metaRole = authData?.user?.user_metadata?.role;
      if (metaRole === 'student' || metaRole === 'teacher') return metaRole;

      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();

      if (studentRow) return 'student';
    } catch (e) {
      console.warn('Error determining user role:', e);
    }

    throw new Error('Your account has no valid portal role. Contact an administrator.');
  },

  async logout(): Promise<void> {
    requireSupabaseConfiguration();
    const { error } = await supabase.auth.signOut();
    if (error) throw formatAuthError(error);
  },

  subscribeToAuthState(onUserChanged: (user: AppUser | null) => void): () => void {
    if (!isSupabaseConfigured()) {
      onUserChanged(null);
      return () => undefined;
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      onUserChanged(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      onUserChanged(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  },
};
