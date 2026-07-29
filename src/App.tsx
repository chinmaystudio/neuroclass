/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ParticleBackground from './components/ParticleBackground';
import { Hero } from './components/Hero';
import Features from './components/Features';
import { Process, DashboardPreview } from './components/WorkAndDashboard';
import { TestSystem, Footer } from './components/TestAndFooter';
import { ClassroomView } from './components/ClassroomView';
import { StudentPortal } from './components/StudentPortal';
import { AIModuleDashboard } from './ai_system/AIModuleDashboard';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { auth as firebaseAuth, googleProvider, db, handleFirestoreError } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged as onFirebaseAuthStateChanged, User as FirebaseUser, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { logPageView } from './lib/analytics';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AppUser = SupabaseUser | FirebaseUser;

const MissingConfigMessage = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black px-4 py-20 overflow-y-auto">
    <div className="max-w-2xl w-full p-10 lg:p-16 rounded-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-2xl text-center space-y-10">
      <div className="w-24 h-24 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto animate-pulse">
        <AlertCircle size={48} />
      </div>
      
      <div className="space-y-4">
        <h2 className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white uppercase transition-all duration-700">Database Connection Required</h2>
        <p className="text-slate-500 dark:text-white/40 text-sm max-w-lg mx-auto leading-relaxed">
          NeuroClass AI requires a Supabase connection for persistent data sync. Please configure your environment variables in the <span className="font-bold text-slate-900 dark:text-white underline decoration-blue-500 underline-offset-4 cursor-pointer">AI Studio Settings</span> menu.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Step 1</div>
          <p className="text-xs font-medium opacity-60">Go to <span className="font-bold">Settings</span> and find <span className="font-bold">Environment Variables</span>.</p>
        </div>
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Step 2</div>
          <p className="text-xs font-medium opacity-60">Add <span className="font-bold">VITE_SUPABASE_URL</span> and <span className="font-bold">VITE_SUPABASE_ANON_KEY</span>.</p>
        </div>
        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 md:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Step 3</div>
          <p className="text-xs font-medium opacity-60">Run the <span className="font-bold">schema.sql</span> script provided in the database SQL Editor to initialize tables.</p>
        </div>
      </div>

      <div className="pt-6">
        <button 
          onClick={onBack}
          className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-3xl font-bold uppercase tracking-[0.2em] text-[11px] hover:shadow-[0_0_40px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all transform active:scale-95"
        >
          Return to Portal
        </button>
      </div>
    </div>
  </div>
);

const LoginPage = ({ onLogin }: { onLogin: (user: AppUser, role: 'teacher' | 'student' | 'admin') => void }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [role, setRole] = React.useState<'teacher' | 'student' | 'admin'>('teacher');
  const [guardianError, setGuardianError] = React.useState<{ email: string; currentRole: string; targetRole: string } | null>(null);

  const checkAndSetRoleBound = async (userEmail: string, chosenRole: 'teacher' | 'student' | 'admin'): Promise<boolean> => {
    const cleanEmail = userEmail.toLowerCase().trim();
    if (!cleanEmail) return false;
    
    try {
      const docRef = doc(db, 'user_roles', cleanEmail);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (getErr: any) {
        handleFirestoreError(getErr, 'get', `user_roles/${cleanEmail}`);
      }
      
      if (docSnap && docSnap.exists()) {
        const boundRole = docSnap.data().role;
        if (boundRole !== chosenRole) {
          throw new Error(`[Session Guardian] This email address is registered as a ${boundRole.toUpperCase()} and cannot be used to access the ${chosenRole.toUpperCase()} workspace. Please use a separate email address.`);
        }
        return true;
      } else {
        // Safe mapping - write first
        try {
          await setDoc(docRef, {
            email: cleanEmail,
            role: chosenRole,
            created_at: new Date().toISOString()
          });
        } catch (setErr: any) {
          handleFirestoreError(setErr, 'create', `user_roles/${cleanEmail}`);
        }
        return true;
      }
    } catch (err: any) {
      console.error('Session Guardian protection error:', err);
      throw err;
    }
  };

  const handleRoleOverride = async () => {
    if (!guardianError) return;
    setLoading(true);
    const { email: cleanEmail, targetRole } = guardianError;
    try {
      const docRef = doc(db, 'user_roles', cleanEmail);
      await setDoc(docRef, {
        email: cleanEmail,
        role: targetRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { merge: true });
      
      localStorage.setItem('neuroclass_role', targetRole);
      setGuardianError(null);

      const currentUser = firebaseAuth.currentUser;
      if (currentUser && currentUser.email?.toLowerCase().trim() === cleanEmail) {
        onLogin(currentUser, targetRole as 'teacher' | 'student' | 'admin');
      } else {
        alert(`Success! Your role has been switched to ${targetRole.toUpperCase()}. Please sign in again to enter.`);
      }
    } catch (err: any) {
      alert("Failed to override role: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOverride = async () => {
    setGuardianError(null);
    try {
      await firebaseSignOut(firebaseAuth);
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Signout failed on cancel:', e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGuardianError(null);
    try {
      if (isSignUp) {
        // Pre-validate role availability BEFORE creating the account
        await checkAndSetRoleBound(email, role);

        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { role }
          }
        });
        if (error) throw error;
        if (data.user) onLogin(data.user, role);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        const userRole = data.user.user_metadata?.role || role;
        
        // Enforce Session Guardian Check on login!
        try {
          await checkAndSetRoleBound(email, userRole as 'teacher' | 'student' | 'admin');
        } catch (authGuardErr: any) {
          if (authGuardErr.message.includes('[Session Guardian]')) {
            const boundRole = authGuardErr.message.toLowerCase().includes('teacher') ? 'teacher' : 'student';
            setGuardianError({
              email: email.toLowerCase().trim(),
              currentRole: boundRole,
              targetRole: userRole as 'teacher' | 'student' | 'admin'
            });
            setLoading(false);
            return;
          } else {
            // Rollback login session
            await supabase.auth.signOut();
            throw authGuardErr;
          }
        }

        if (data.user) onLogin(data.user, userRole as 'teacher' | 'student');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setGuardianError(null);
    try {
      // 1. Persist the chosen role immediately
      localStorage.setItem('neuroclass_role', role);
      
      // 2. Use Firebase for the Google login
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      
      if (result.user && result.user.email) {
        try {
          await checkAndSetRoleBound(result.user.email, role);
        } catch (authGuardErr: any) {
          if (authGuardErr.message.includes('[Session Guardian]')) {
            const boundRole = authGuardErr.message.toLowerCase().includes('teacher') ? 'teacher' : 'student';
            setGuardianError({
              email: result.user.email.toLowerCase().trim(),
              currentRole: boundRole,
              targetRole: role
            });
            setLoading(false);
            return;
          } else {
            await firebaseSignOut(firebaseAuth);
            throw authGuardErr;
          }
        }

        // Success: pass user and role up
        onLogin(result.user, role);
        console.log('Firebase Google Login successful, Session Guardian approved.');
      }
    } catch (error: any) {
      console.error('Firebase Auth Error:', error);
      // Fallback for environments that block popups (like some iFrames)
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        alert('Signin popup was blocked. Please enable popups or try again.');
      } else {
        alert(error.message || 'Verification failed. Please check your internet connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full p-10 rounded-[32px] editorial-glass border-black/5 dark:border-white/10 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-4.514A9.01 9.01 0 0012 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878m4.562-10.878c.492 0 .937.195 1.264.512M18.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm-5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">NeuroClass AI</h2>
          <p className="text-slate-500 dark:text-white/40 mt-2">{isSignUp ? 'Create your management account' : 'Sign in to your classroom'}</p>
        </div>

        {/* Role Toggle */}
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl mb-8">
           <button 
             type="button"
             onClick={() => setRole('teacher')}
             className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer", role === 'teacher' ? "bg-white dark:bg-white/10 text-blue-600 shadow-sm" : "text-slate-400")}
           >
             Teacher
           </button>
           <button 
             type="button"
             onClick={() => setRole('student')}
             className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer", role === 'student' ? "bg-white dark:bg-white/10 text-blue-600 shadow-sm" : "text-slate-400")}
           >
             Student
           </button>
        </div>

        {/* Session Guardian Active Banner / Override Option */}
        {guardianError && (
          <div className="mb-6 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Session Guardian Mismatch
            </h4>
            <p className="text-[11px] text-slate-800 dark:text-slate-300 leading-relaxed font-semibold">
              This email (<span className="font-bold font-mono text-slate-900 dark:text-white">{guardianError.email}</span>) is registered as a <span className="font-bold text-blue-500">{guardianError.currentRole.toUpperCase()}</span> in the cloud database.
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              You chose to enter as a <strong className="text-purple-500">{guardianError.targetRole.toUpperCase()}</strong>. Since you are in a sandbox workspace environment, you can securely override and switch your role.
            </p>
            <div className="flex gap-2 pt-1 font-bold text-[9px] uppercase tracking-wider">
              <button
                type="button"
                onClick={handleRoleOverride}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black transition-all cursor-pointer text-center font-bold"
              >
                {loading ? 'Switching...' : `Switch to ${guardianError.targetRole.toUpperCase()}`}
              </button>
              <button
                type="button"
                onClick={handleCancelOverride}
                className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
           <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google OAuth
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/5 dark:border-white/10"></span></div>
            <div className="relative flex justify-center text-[8px] uppercase tracking-[0.3em] font-bold text-slate-400"><span className="bg-slate-50 dark:bg-black px-4">OR USE EMAIL</span></div>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="admin@school.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Secure Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-white/30">
          {isSignUp ? "Already have an account? " : "New to NeuroClass? "}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-500 hover:underline font-medium"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = React.useState<AppUser | null>(null);
  const [userRole, setUserRole] = React.useState<'teacher' | 'student' | 'admin'>('teacher');
  const [view, setView] = React.useState<'landing' | 'classroom'>('landing');
  const [authLoading, setAuthLoading] = React.useState(true);
  const [showAICore, setShowAICore] = React.useState(false); 

  React.useEffect(() => {
    let path = `/${view}`;
    if (showAICore) path = '/ai-module';
    if (!user && view === 'classroom') path = '/login';
    logPageView(path);
  }, [view, showAICore, user]);

  React.useEffect(() => {
    const checkAuth = async () => {
      // 1. Firebase (Primary as per user preference)
      const unsubscribeFirebase = onFirebaseAuthStateChanged(firebaseAuth, (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          const savedRole = localStorage.getItem('neuroclass_role') as 'teacher' | 'student';
          if (savedRole) setUserRole(savedRole);
          if (view === 'landing') setView('classroom');
        } else if (!isSupabaseConfigured()) {
          setUser(null);
        }
        setAuthLoading(false);
      });

      // 2. Supabase (Secondary Auth/Data Sync)
      let subscription: any = null;
      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && !firebaseAuth.currentUser) {
            setUser(session.user);
            const metadataRole = session.user.user_metadata?.role;
            const savedRole = localStorage.getItem('neuroclass_role') as 'teacher' | 'student';
            setUserRole(metadataRole || savedRole || 'teacher');
            if (view === 'landing') setView('classroom');
          }
        } catch (e) {
          console.warn("Supabase session check failed:", e);
        }

        const res = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user && !firebaseAuth.currentUser) {
            setUser(session.user);
            const metadataRole = session.user.user_metadata?.role;
            const savedRole = localStorage.getItem('neuroclass_role') as 'teacher' | 'student' | 'admin';
            const roleToSet = metadataRole || savedRole || 'teacher';
            setUserRole(roleToSet as 'teacher' | 'student' | 'admin');
            
            if (view === 'landing') setView('classroom');
          }
          else if (!session?.user && !firebaseAuth.currentUser) {
             setUser(null);
          }
        });
        subscription = res.data.subscription;
      }

      return () => {
        unsubscribeFirebase();
        if (subscription) subscription.unsubscribe();
      };
    };

    const unsubscribePromise = checkAuth();
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, []);

  if (authLoading) return null;

  if (view === 'classroom' && !isSupabaseConfigured()) {
    return <MissingConfigMessage onBack={() => setView('landing')} />;
  }

  if (!user && view === 'classroom') {
    return <LoginPage onLogin={(u, r) => { setUser(u); setUserRole(r); }} />;
  }

  return (
    <ThemeProvider>
      <AnimatePresence>
        {showAICore && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
            className="fixed inset-0 z-[200]"
          >
            <AIModuleDashboard onClose={() => setShowAICore(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen text-slate-900 dark:text-white transition-colors duration-500 overflow-x-hidden relative">
        <div className="fixed inset-0 bg-white dark:bg-[#000000] -z-20 transition-colors duration-500" />
        <ParticleBackground />
        
        <AnimatePresence mode="wait">
          {view === 'landing' ? (
            <motion.div
              key="landing"
              className="relative z-10"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <Navbar onLaunch={() => setView('classroom')} />
              <main>
                <Hero onLaunch={() => setView('classroom')} />
                <Features />
                <Process />
                <DashboardPreview onLaunch={() => setView('classroom')} />
                <TestSystem />
              </main>
              <Footer />
            </motion.div>
          ) : (
            <motion.div
              key="classroom"
              initial={{ opacity: 0, x: 100, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.98 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {userRole === 'teacher' ? (
                <ClassroomView user={user} onClose={() => setView('landing')} onOpenAICore={() => setShowAICore(true)} />
              ) : (
                <StudentPortal user={user} onClose={() => setView('landing')} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  );
}
