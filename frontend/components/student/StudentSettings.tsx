import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, User, ShieldCheck, Camera, Bell, CheckCircle2, Trash2, RotateCcw
} from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';

interface StudentSettingsProps {
  onRegisterFaceClick: () => void;
}

export const StudentSettings: React.FC<StudentSettingsProps> = ({ onRegisterFaceClick }) => {
  const { user } = useAuth();
  const [hasBiometric, setHasBiometric] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      checkBiometric();
    }
  }, [user]);

  const checkBiometric = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('face_descriptor')
        .eq('user_id', user!.id);

      const isBio = (data || []).some(s => s.face_descriptor != null);
      setHasBiometric(isBio);
    } catch (e) {
      console.error('Error checking biometric:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFaceData = async () => {
    if (!user || !window.confirm('Are you sure you want to clear your Face-ID biometric data across all enrolled classrooms?')) return;
    setClearing(true);
    try {
      await supabase
        .from('students')
        .update({
          face_descriptor: null,
          face_samples: [],
        })
        .eq('user_id', user.id);

      setHasBiometric(false);
    } catch (e) {
      console.error('Error clearing face data:', e);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Settings className="text-purple-500" size={32} />
          Student Settings & Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your account credentials, face ID biometric authentication, and portal preferences.
        </p>
      </div>

      {/* Account Info Box */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 space-y-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="text-purple-500" size={20} /> Account Identity
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Email Address</label>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono text-sm">
              {user?.email || 'student@neuroclass.ai'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Student Unique ID</label>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono text-sm">
              {user?.id ? `STU-${user.id.substring(0, 8).toUpperCase()}` : 'STU-PROD-2026'}
            </div>
          </div>
        </div>
      </div>

      {/* Biometric Face ID Box */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={20} /> Biometric Face Verification
            </h2>
            <p className="text-xs text-slate-500">
              Required for AI facecam proctoring and automated classroom attendance check-ins. Register once for all classes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasBiometric && (
              <button
                onClick={handleClearFaceData}
                disabled={clearing}
                className="px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                title="Clear Face-ID Data across all classes"
              >
                <Trash2 size={14} /> Clear Data
              </button>
            )}

            <button
              onClick={onRegisterFaceClick}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 shrink-0 transition-colors"
            >
              <Camera size={16} />
              {hasBiometric ? 'Update Face ID' : 'Register Biometrics'}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle2 size={18} />
          {hasBiometric ? 'Unified Face ID template registered. Applied automatically to all your enrolled classrooms.' : 'Biometric registration ready. Register once to apply across all classrooms.'}
        </div>
      </div>

      {/* System Preferences */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 space-y-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="text-indigo-500" size={20} /> Notifications & Preferences
        </h2>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Exam Release Alerts</p>
            <p className="text-xs text-slate-500">Receive notifications when an instructor publishes a new test.</p>
          </div>

          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative p-1 ${notificationsEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-white/20'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
