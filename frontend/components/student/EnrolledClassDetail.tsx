import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Users, ShieldCheck, FileText, CheckCircle2, Clock, ArrowLeft, Plus, Sparkles
} from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/apiConfig';

interface EnrolledClassDetailProps {
  classroom: any;
  onBack: () => void;
  onStartTest: (testId: string) => void;
}

export const EnrolledClassDetail: React.FC<EnrolledClassDetailProps> = ({
  classroom,
  onBack,
  onStartTest,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tests' | 'attendance' | 'announcements'>('tests');
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealMessage, setAppealMessage] = useState('');
  const [activeAttendanceSession, setActiveAttendanceSession] = useState<any>(null);
  const [attendancePin, setAttendancePin] = useState('');
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [attendanceVerifying, setAttendanceVerifying] = useState(false);

  useEffect(() => {
    if (classroom && user) {
      fetchClassroomData();
    }
  }, [classroom, user]);

  const fetchClassroomData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Tests for this classroom
      const { data: testsData } = await supabase
        .from('tests')
        .select('*')
        .eq('classroom_id', classroom.id)
        .order('created_at', { ascending: false });

      setTests(testsData || []);

      // 2. Fetch Student Profile for this classroom
      const { data: profile } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user!.id)
        .eq('classroom_id', classroom.id)
        .single();

      if (profile) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('classroom_id', classroom.id)
          .eq('student_id', profile.id)
          .order('verified_at', { ascending: false });

        setAttendanceLogs(attData || []);

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          const activeResponse = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(classroom.id)}`, {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          });
          const activePayload = await activeResponse.json().catch(() => ({}));
          if (activeResponse.ok) setActiveAttendanceSession(activePayload.session || null);
        }
      }
    } catch (e) {
      console.error('Error fetching classroom detail:', e);
    } finally {
      setLoading(false);
    }
  };

  const verifyCurrentAttendance = async () => {
    if (!activeAttendanceSession || !attendancePin.trim()) return;
    setAttendanceVerifying(true);
    setAttendanceMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error('Please sign in again before verifying attendance.');
      const response = await fetch(getApiUrl('/api/attendance/verify'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ sessionId: activeAttendanceSession.id, pin: attendancePin.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Attendance verification failed.');
      setAttendancePin('');
      setAttendanceMessage('Attendance verified for this live classroom session.');
      await fetchClassroomData();
    } catch (error: any) {
      setAttendanceMessage(error.message || 'Attendance verification failed.');
    } finally {
      setAttendanceVerifying(false);
    }
  };

  const submitAttendanceAppeal = async () => {
    if (!user || !appealReason.trim() || attendanceLogs.length === 0) return;
    setAppealSubmitting(true);
    setAppealMessage('');
    try {
      const { error } = await (supabase.from('attendance_appeals') as any).insert({
        attendance_id: attendanceLogs[0].id,
        classroom_id: classroom.id,
        student_id: user.id,
        reason: appealReason.trim(),
      });
      if (error) throw error;
      setAppealReason('');
      setAppealMessage('Appeal submitted. Your instructor will review it.');
    } catch (error: any) {
      setAppealMessage(error.message || 'Could not submit the appeal.');
    } finally {
      setAppealSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-purple-500">Enrolled Classroom</span>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">{classroom.name}</h1>
        </div>
      </div>

      {/* Classroom Hero Card */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-black rounded-[36px] p-8 text-white border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono font-bold uppercase tracking-widest border border-white/20">
              Code: {classroom.code}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
              <Users size={14} /> {classroom.students || 1} Enrolled
            </span>
          </div>
          <h2 className="text-2xl font-bold">{classroom.name}</h2>
          <p className="text-xs text-slate-300">Secure proctored assessments & biometric face verification enabled.</p>
        </div>

        <div className="px-5 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white/80 text-xs font-bold uppercase tracking-widest flex items-center gap-2 shrink-0 z-10">
          <ShieldCheck size={16} /> Attendance is instructor-verified
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 dark:border-white/10 gap-8">
        <button
          onClick={() => setActiveTab('tests')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tests' ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={16} /> Course Tests ({tests.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'attendance' ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck size={16} /> Attendance Logs ({attendanceLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'announcements' ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles size={16} /> Announcements
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'tests' ? (
        <div className="space-y-4">
          {tests.length === 0 ? (
            <div className="p-12 border border-dashed border-black/10 dark:border-white/10 rounded-3xl text-center space-y-2 text-slate-400 text-xs">
              <FileText size={40} className="mx-auto opacity-50 mb-2" />
              <p>No tests published for this classroom yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tests.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{t.description || 'Proctored assessment'}</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Duration: {t.duration_minutes} Mins</span>
                      <span>Marks: {t.total_marks || 100}</span>
                    </div>

                    <button
                      onClick={() => onStartTest(t.id)}
                      className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-500/20 transition-colors"
                    >
                      Start Exam
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'attendance' ? (
        <div className="space-y-4">
          {activeAttendanceSession && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/5 p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Live attendance session</p>
                  <p className="text-xs text-slate-500">Your instructor opened a time-bound session. Enter the PIN shown in the classroom; this does not create a self-service attendance record.</p>
                </div>
                <Clock size={18} className="text-emerald-600 shrink-0" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={attendancePin}
                  onChange={(event) => setAttendancePin(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit classroom PIN"
                  className="flex-1 rounded-xl border border-emerald-200 dark:border-white/10 bg-white dark:bg-black/20 p-3 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={verifyCurrentAttendance}
                  disabled={attendanceVerifying || attendancePin.length !== 6}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
                >
                  {attendanceVerifying ? 'Verifying…' : 'Verify presence'}
                </button>
              </div>
              {attendanceMessage && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{attendanceMessage}</p>}
            </div>
          )}
          {attendanceLogs.length === 0 ? (
            <div className="p-12 border border-dashed border-black/10 dark:border-white/10 rounded-3xl text-center space-y-2 text-slate-400 text-xs">
              <ShieldCheck size={40} className="mx-auto opacity-50 mb-2" />
              <p>No instructor attendance record has been published for this class yet.</p>
              <p className="text-[11px] text-slate-500">Students cannot create attendance records. Ask your instructor to open an attendance session.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendanceLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Status: {log.status || 'Present'}</p>
                      <p className="text-xs text-slate-400">Verified via: {log.verified_method || 'Face-ID Biometric'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(log.verified_at || log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-5 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Attendance appeal</p>
              <p className="text-xs text-slate-500">If your instructor missed a valid attendance entry, submit a reason for manual review.</p>
            </div>
            <textarea
              value={appealReason}
              onChange={(event) => setAppealReason(event.target.value)}
              placeholder="Explain the date, class session, and supporting context."
              rows={3}
              className="w-full rounded-xl border border-amber-200 dark:border-white/10 bg-white dark:bg-black/20 p-3 text-sm outline-none focus:border-amber-500"
            />
            {appealMessage && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{appealMessage}</p>}
            <button
              onClick={submitAttendanceAppeal}
              disabled={appealSubmitting || !appealReason.trim() || attendanceLogs.length === 0}
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40"
            >
              {appealSubmitting ? 'Submitting…' : 'Submit for instructor review'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 border border-dashed border-black/10 dark:border-white/10 rounded-3xl text-center text-slate-400 text-xs space-y-2">
          <Sparkles size={36} className="mx-auto opacity-50" />
          <p>No announcements posted by instructor.</p>
        </div>
      )}

    </div>
  );
};
