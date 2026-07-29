import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Settings as SettingsIcon, 
  Eye, 
  Shield, 
  Layout, 
  CheckCircle,
  Save,
  LogIn,
  LogOut,
  User as UserIcon,
  Search,
  FolderOpen,
  X
} from 'lucide-react';
import { Test, Theme, QuestionType, LayoutModuleType } from './types';
import BuilderTab from './components/tabs/BuilderTab';
import DesignerTab from './components/tabs/DesignerTab';
import SettingsTab from './components/tabs/SettingsTab';
import ProctoringTab from './components/tabs/ProctoringTab';
import PreviewTab from './components/tabs/PreviewTab';
import { supabase, signInWithGoogle, signInWithEmail, saveTest, fetchTests, isSupabaseConfigured } from './lib/supabase';
// Supabase user type
import type { User } from '@supabase/supabase-js';

const DEFAULT_TEST: Test = {
  settings: {
    title: 'New Examination',
    institutionName: 'My Institution',
    institutionIcon: '🎓',
    duration: 60,
    totalMarks: 100,
    passingMarks: 40,
    maxAttempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResultImmediately: true,
    theme: Theme.Default,
    accentColor: '#3b82f6'
  },
  proctoring: {
    enabled: false,
    level: 'basic',
    tabSwitchDetection: true,
    faceDetection: false,
    gazeDetection: false,
    audioDetection: false,
    deviceDetection: false
  },
  sections: [
    {
      id: 'initial-section',
      title: 'General Knowledge',
      questions: [],
      defaultMarks: 1,
      defaultNegativeMarks: 0
    }
  ],
  layout: [
    { id: '1', type: LayoutModuleType.Heading, content: 'Final Examination', position: { x: 50, y: 50 }, size: { width: '100%', height: 'auto' } },
    { id: '2', type: LayoutModuleType.Text, content: 'Please read all instructions carefully before starting the exam.', position: { x: 50, y: 120 }, size: { width: '100%', height: 'auto' } },
    { id: '3', type: LayoutModuleType.QuestionBox, position: { x: 50, y: 200 }, size: { width: '100%', height: 'auto' } },
    { id: '4', type: LayoutModuleType.StatsBox, position: { x: 50, y: 600 }, size: { width: '100%', height: 'auto' } }
  ],
  appearance: {
    canvasBg: '#f8fafc',
    containerWidth: 'medium',
    cardStyle: 'elevated',
    fontFamily: 'Inter'
  }
};

export default function App() {
  const [test, setTest] = useState<Test>(DEFAULT_TEST);
  const [activeTab, setActiveTab] = useState<'builder' | 'designer' | 'settings' | 'proctoring' | 'preview'>('builder');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [savedTests, setSavedTests] = useState<any[]>([]);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        try {
          const fetched = await fetchTests(u.id);
          setSavedTests(fetched);
        } catch (err) {
          console.error("Failed to fetch tests", err);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        try {
          const fetched = await fetchTests(u.id);
          setSavedTests(fetched);
        } catch (err) {
          console.error("Failed to fetch tests", err);
        }
      } else {
        setSavedTests([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!user) {
      setShowEmailInput(true);
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const savedId = await saveTest(test, user.id);
      setTest(prev => ({ ...prev, id: savedId }));
      setSaveStatus('success');
      const updated = await fetchTests(user.id);
      setSavedTests(updated);
    } catch (error) {
      console.error('Failed to save test:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const loadTest = (saved: any) => {
    setTest(saved);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoggingIn(true);
    try {
      await signInWithEmail(email);
      alert('Check your email for the login link!');
      setShowEmailInput(false);
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      alert(`Google sign in failed: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const tabs = [
    { id: 'builder', label: 'Builder', icon: Layout },
    { id: 'designer', label: 'Designer (Canva)', icon: Plus },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'proctoring', label: 'Proctoring', icon: Shield },
    { id: 'preview', label: 'Live Preview', icon: Eye },
  ];

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 relative ${test.settings.theme === Theme.Dark ? 'dark' : ''}`}>
      {/* Login Modal */}
      {showEmailInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-900">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-100"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Save Your Progress</h3>
                <p className="text-sm text-slate-500 mt-1">Sign in to save and manage your tests</p>
              </div>
              <button 
                onClick={() => setShowEmailInput(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                id="close-login-btn"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  <span className="font-bold">Tip:</span> If Google login fails, try opening the app in a <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="underline font-bold">new tab</a>.
                </p>
              </div>
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                id="google-login-btn"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoggingIn ? 'Connecting...' : 'Continue with Google'}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-xs text-slate-400 font-medium tracking-widest uppercase">OR</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1">
                    Magic Link Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
                  id="email-login-btn"
                >
                  {isLoggingIn ? 'Sending...' : 'Send Magic Link'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-white flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="logo-mark w-8 h-8">
            {test.settings.institutionIcon}
          </div>
          <div className="font-bold text-lg tracking-tight">CertiBuild</div>
        </div>
        
        <nav className="mt-6 flex-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={18} />
              {tab.label}
            </div>
          ))}

          {user && savedTests.length > 0 && (
            <div className="mt-8 px-6 space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block">Saved Exams</label>
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2 scrollbar-none">
                {savedTests.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => loadTest(t)}
                    className={`w-full text-left p-3 rounded-xl text-[10px] font-bold truncate transition-all ${
                      test.id === t.id 
                        ? 'bg-slate-800 text-indigo-400 border border-indigo-500/30' 
                        : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-300'
                    }`}
                  >
                    {t.settings.title || 'Untitled Exam'}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-auto border-t border-slate-800 p-4">
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full ring-2 ring-indigo-500" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <UserIcon size={14} />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-black uppercase text-indigo-400 truncate">{user.user_metadata?.full_name || 'Developer'}</p>
                    <p className="text-[8px] text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <LogOut size={14} /> SIGN OUT
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 transition-colors"
              >
                <LogIn size={14} /> SIGN IN TO SYNC
              </button>
            )}
          </div>

          <div className="px-6 py-4">
             <div className="flex items-center gap-2 text-xs font-medium tracking-wide">
                {!isSupabaseConfigured ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-red-400">CONFIG MISSING</span>
                  </>
                ) : (
                  <>
                    <span className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`}></span>
                    <span className="text-slate-500">{user ? 'CLOUD READY' : 'LOCAL ONLY'}</span>
                  </>
                )}
             </div>
          </div>
        </nav>
      </aside>

      {/* Main View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">Tests / Editor</div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {test.settings.title || 'Untitled Exam'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('preview')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Eye size={16} />
              Preview
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`btn-primary flex items-center gap-2 text-sm ${
                saveStatus === 'success' ? 'bg-green-600 hover:bg-green-700' :
                saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : saveStatus === 'success' ? (
                <CheckCircle size={16} />
              ) : (
                <Save size={16} />
              )}
              {saveStatus === 'success' ? 'Saved' : saveStatus === 'error' ? 'Failed' : 'Save & Publish'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950">
          <div className="mx-auto max-w-5xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'builder' && <BuilderTab test={test} setTest={setTest} />}
                {activeTab === 'designer' && <DesignerTab test={test} setTest={setTest} />}
                {activeTab === 'settings' && <SettingsTab test={test} setTest={setTest} />}
                {activeTab === 'proctoring' && <ProctoringTab test={test} setTest={setTest} />}
                {activeTab === 'preview' && <PreviewTab test={test} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
