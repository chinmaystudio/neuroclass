import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, GraduationCap, Monitor, ArrowRight, Sparkles, User, Mail, Lock, Phone } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: 'teacher' | 'student') => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSelectRole, initialMode = 'signin' }) => {
  const { setUserRole } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);

  // Sync state if prop changes
  React.useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = (selectedRole: 'teacher' | 'student') => {
    setRole(selectedRole);
    setStep(2);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let targetRole: 'teacher' | 'student' = role || 'student';

      if (authMode === 'signin') {
        const userResult = await authService.signInWithEmail(email, password);
        // The server-backed profile role is authoritative on sign-in; the UI tab
        // cannot switch an existing account into another portal.
        targetRole = await authService.getUserRole(userResult.id);
      } else {
        await authService.signUpWithEmail(email, password, name, phone, targetRole);
      }

      setUserRole(targetRole);
      onSelectRole(targetRole);
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep(authMode === 'signup' ? 1 : 2);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setError('');
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setStep(authMode === 'signup' ? 1 : 2);
    }
  }, [isOpen, authMode]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetState}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-white dark:bg-[#0a0a0a] rounded-[40px] overflow-hidden shadow-2xl flex border border-black/5 dark:border-white/10 max-h-[90vh]"
          >
            {/* Left Side: Branding / Copy */}
            <div className="hidden md:flex w-5/12 bg-slate-50 dark:bg-black p-12 flex-col justify-between border-r border-black/5 dark:border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2 mb-8">
                  <img src="/logo-dark.png" className="w-8 h-8 hidden dark:block drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" alt="Logo" />
                  <img src="/logo-light.png" className="w-8 h-8 block dark:hidden" alt="Logo" />
                  <span className="text-xl font-black tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-white">
                    NEURO<span className="text-blue-600 dark:text-blue-400 font-light">CLASS</span>
                  </span>
                </div>
                <h2 className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white leading-tight">
                  Welcome to the <br /><span className="font-bold">Future of Learning.</span>
                </h2>
                <p className="text-slate-500 dark:text-white/40 text-sm leading-relaxed max-w-[250px]">
                  {step === 1 ? 'Identify your role to access your personalized AI-powered academic workspace.' : 'Enter your credentials to securely connect to your dashboard.'}
                </p>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <Sparkles size={14} className="text-blue-500" /> Powered by NeuroClass AI
                </div>
              </div>
            </div>

            {/* Right Side: Dynamic Content */}
            <div className="w-full md:w-7/12 p-8 md:p-12 relative bg-white dark:bg-[#0a0a0a] overflow-y-auto">
              <button
                onClick={resetState}
                className="absolute top-8 right-8 w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors z-20"
              >
                <X size={20} />
              </button>

              <AnimatePresence mode="wait">
                {step === 1 && authMode === 'signup' && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="mt-12 md:mt-8 space-y-8"
                  >
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Select your portal</h3>
                      <p className="text-sm text-slate-500 dark:text-white/40">Choose how you want to interact with NeuroClass.</p>
                    </div>

                    <div className="space-y-4">
                      <motion.div
                        onClick={() => handleRoleSelect('teacher')}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative p-6 rounded-3xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 shadow-xl shadow-blue-500/10 cursor-pointer overflow-hidden transition-all"
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-500">
                              <Monitor size={24} />
                            </div>
                            <div className="text-left">
                              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Instructor</h4>
                              <p className="text-xs text-slate-500 dark:text-white/50 mt-1">Manage classrooms, deploy AI tests, and monitor.</p>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        onClick={() => handleRoleSelect('student')}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative p-6 rounded-3xl border border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5 shadow-xl shadow-purple-500/10 cursor-pointer overflow-hidden transition-all"
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-500">
                              <GraduationCap size={24} />
                            </div>
                            <div className="text-left">
                              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Student</h4>
                              <p className="text-xs text-slate-500 dark:text-white/50 mt-1">Join classrooms, take tests, and view feedback.</p>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="mt-8 space-y-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      {authMode === 'signup' && (
                        <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                          <ArrowRight size={20} className="rotate-180" />
                        </button>
                      )}

                      {/* Role Selector Tabs for Portal Choice */}
                      <div className="flex rounded-full bg-slate-100 dark:bg-white/10 p-1">
                        <button
                          type="button"
                          onClick={() => setRole('student')}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            role === 'student' ? "bg-purple-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          Student Portal
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('teacher')}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            role === 'teacher' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          Instructor Portal
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                        {authMode === 'signin' ? `Sign In to ${role === 'student' ? 'Student' : 'Instructor'} Portal` : `Create ${role === 'student' ? 'Student' : 'Instructor'} Account`}
                      </h3>
                    </div>

                    {error && (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {authMode === 'signup' && (
                        <div className="space-y-4">
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                              type="text"
                              required
                              placeholder="Full Name"
                              value={name}
                              onChange={e => setName(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                              type="tel"
                              required
                              placeholder="Mobile Number"
                              value={phone}
                              onChange={e => setPhone(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      )}

                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="email"
                          required
                          placeholder="Email Address"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="password"
                          required
                          placeholder="Password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "w-full py-4 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-xl disabled:opacity-50 transition-all flex justify-center items-center h-14 mt-4",
                          role === 'student' ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20" : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                        )}
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          authMode === 'signin' ? `Sign In (${role === 'student' ? 'Student' : 'Instructor'})` : 'Create Account'
                        )}
                      </button>
                    </form>

                    <div className="text-center pt-4">
                      <p className="text-sm text-slate-500">
                        {authMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                            setError('');
                          }}
                          className="text-blue-500 font-bold hover:underline"
                        >
                          {authMode === 'signin' ? 'Create one' : 'Sign in'}
                        </button>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
