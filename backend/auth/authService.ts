import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../database/supabase';

export type AppUser = SupabaseUser;

export const authService = {
  /**
   * Sign Up with Email and Password
   */
  async signUpWithEmail(email: string, password: string, name: string, phone: string, role: 'teacher' | 'student'): Promise<AppUser> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      const userRef = data.user;
      
      // Insert user profile into public.users table
      await supabase.from('users').insert({
        uid: userRef.id,
        email: userRef.email,
        displayName: name,
        photoURL: '',
        mobile_number: phone,
        role: role,
        createdAt: new Date().toISOString()
      });
      
      return userRef;
    }
    
    throw new Error('Sign up failed');
  },

  /**
   * Sign In with Email and Password
   */
  async signInWithEmail(email: string, password: string): Promise<AppUser> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      return data.user;
    }

    throw new Error('Sign in failed');
  },

  /**
   * Sign out current active user from Supabase session
   */
  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Retrieve user role ('teacher' | 'student') from Supabase
   */
  async getUserRole(uid: string): Promise<'teacher' | 'student'> {
    try {
      const { data: userDoc, error } = await supabase.from('users').select('role').eq('uid', uid).single();
      if (!error && userDoc) {
        return userDoc.role || 'teacher';
      }
    } catch (e) {
      console.warn('Failed to fetch user role from Supabase:', e);
    }
    return 'teacher';
  },

  /**
   * Subscribe to authentication state changes
   */
  subscribeToAuthState(onUserChanged: (user: AppUser | null) => void): () => void {
    supabase.auth.getSession().then(({ data: { session } }) => {
      onUserChanged(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      onUserChanged(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }
};
