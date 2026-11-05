import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../database/supabase';

export type AppUser = SupabaseUser;

type AppRole = 'teacher' | 'student';
export type RoleState = { role: AppRole | null; needsChoice: boolean };

const PENDING_ROLE_KEY = 'nc-pending-role';

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
        // The profile row is created server-side from this metadata by the
        // nc_on_auth_user_created trigger, so sign-up works without a session.
        data: {
          full_name: name.trim(),
          role: role,
          phone: phone.trim(),
        },
      },
    });

    if (error) throw formatAuthError(error);
    if (!data.user) throw new Error('Sign-up did not return a user. Please try again.');
    // public.users is created by the database (nc_on_auth_user_created) from the
    // metadata above; the role cannot be changed from the browser afterwards.
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

  /**
   * Google sign-in. A role chosen on the sign-up screen is remembered for the
   * round trip to Google and applied once (see applyPendingRole); the server
   * only accepts a first-time choice.
   */
  async signInWithGoogle(role?: AppRole): Promise<void> {
    requireSupabaseConfiguration();
    try {
      if (role) localStorage.setItem(PENDING_ROLE_KEY, role);
      else localStorage.removeItem(PENDING_ROLE_KEY);
    } catch { /* storage unavailable: the person will be asked after sign-in */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (error) throw formatAuthError(error);
  },

  /** Role plus whether this account still has to choose one (first Google sign-in). */
  async getRoleState(uid: string): Promise<RoleState> {
    requireSupabaseConfiguration();
    const { data, error } = await (supabase.from('users') as any).select('role,role_chosen_at').eq('uid', uid).maybeSingle();
    if (!error && data && data.role_chosen_at === null) {
      const applied = await this.applyPendingRole();
      if (applied) return { role: applied, needsChoice: false };
      return { role: null, needsChoice: true };
    }
    if (!error && !data) {
      // No profile row yet (trigger failed): let the person choose, which creates it.
      const applied = await this.applyPendingRole();
      return applied ? { role: applied, needsChoice: false } : { role: null, needsChoice: true };
    }
    return { role: await this.getUserRole(uid), needsChoice: false };
  },

  /** Uses the role picked before the Google redirect, if any. */
  async applyPendingRole(): Promise<AppRole | null> {
    let pending: string | null = null;
    try { pending = localStorage.getItem(PENDING_ROLE_KEY); localStorage.removeItem(PENDING_ROLE_KEY); } catch { /* ignore */ }
    if (pending !== 'teacher' && pending !== 'student') return null;
    return this.chooseRole(pending);
  },

  /** First-time role choice; the server ignores later attempts and returns the stored role. */
  async chooseRole(role: AppRole): Promise<AppRole> {
    requireSupabaseConfiguration();
    const { data, error } = await (supabase as any).rpc('nc_choose_role', { p_role: role });
    if (error) throw formatAuthError(error);
    if (data !== 'teacher' && data !== 'student') throw new Error('Your account has no valid portal role. Contact an administrator.');
    return data;
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
