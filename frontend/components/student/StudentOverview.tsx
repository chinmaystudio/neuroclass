import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, FileText, CheckCircle2, Award, 
  Sparkles, ArrowRight, ShieldCheck, Clock, Plus, Zap
} from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';

interface StudentOverviewProps {
  onNavigate: (section: string) => void;
  onJoinClick: () => void;
  onStartTest: (testId: string) => void;
}

export const StudentOverview: React.FC<StudentOverviewProps> = ({
  onNavigate,
  onJoinClick,
  onStartTest,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    enrolledCount: 0,
    activeTestsCount: 0,
    completedTestsCount: 0,
    averageScorePercent: 0,
    biometricVerified: false,
  });
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchOverviewData();
    }
  }, [user]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      // 1. Get enrollments and biometric status
      const { data: studentProfiles } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user!.id);

      const isBio = (studentProfiles || []).some(s => s.face_descriptor != null);
      const enrolledCount = studentProfiles ? studentProfiles.length : 0;
      const classIds = (studentProfiles || []).map(s => s.classroom_id);
      // 2. Fetch tests for enrolled classes
      let pendingTests: any[] = [];
      let completedResults: any[] = [];

      if (classIds.length > 0) {
        const { data: availableTests } = await supabase
          .from('tests')
          .select('*, classrooms(name)')
          .in('classroom_id', classIds)
          .order('created_at', { ascending: false });

        const { data: results, error: attemptsError } = await (supabase.from('attempts') as any)
          .select('*, tests(*)')
          .eq('student_id', user!.id)
          .in('status', ['submitted', 'flagged'])
          .order('submitted_at', { ascending: false })
          .limit(200);
        if (attemptsError) throw attemptsError;
        completedResults = results || [];

        const completedTestIds = new Set(completedResults.map(r => r.test_id));
        pendingTests = (availableTests || []).filter(t => !completedTestIds.has(t.id));
      }

      // Calculate average score percentage
      let totalPercentSum = 0;
      completedResults.forEach(r => {
        const totalMarks = r.tests?.total_marks || 100;
        const pct = Math.min(100, Math.round(((r.score || 0) / totalMarks) * 100));
        totalPercentSum += pct;
      });

      const averageScorePercent = completedResults.length > 0 
        ? Math.round(totalPercentSum / completedResults.length)
        : 0;

      setStats({
        enrolledCount,
        activeTestsCount: pendingTests.length,
        completedTestsCount: completedResults.length,
        averageScorePercent,
        biometricVerified: isBio,
      });

      setRecentTests(pendingTests.slice(0, 3));

      // Build activity timeline
      const activities: any[] = [];
      (studentProfiles || []).forEach(sp => {
        if (sp.joined_at) {
          activities.push({
            id: `enroll-${sp.id}`,
            type: 'enrollment',
            title: 'Enrolled in Classroom',
            time: new Date(sp.joined_at).toLocaleDateString(),
            icon: <BookOpen className="text-purple-500" size={16} />,
          });
        }
      });
      completedResults.forEach(cr => {
        activities.push({
          id: `res-${cr.id}`,
          type: 'exam',
          title: `Completed Assessment: ${cr.tests?.title || 'Exam'}`,
          detail: `Score: ${cr.score}/${cr.tests?.total_marks || 100}`,
          time: new Date(cr.submitted_at || cr.created_at).toLocaleDateString(),
          icon: <CheckCircle2 className="text-emerald-500" size={16} />,
        });
      });

      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivities(activities.slice(0, 5));

    } catch (e) {
      console.error('Error fetching overview data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-purple-900 via-indigo-900 to-black p-8 md:p-10 text-white shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={13} /> Student Portal
              </span>
              {stats.biometricVerified ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Biometric Verified
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-widest">
                  Biometric Pending
                </span>
              )}
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              Welcome back, {user?.email?.split('@')[0] || 'Student'}! 👋
            </h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Monitor your enrolled courses, complete proctored assessments, and track your academic progress in real time.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onJoinClick}
              className="px-6 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-500/30 flex items-center gap-2 transition-all"
            >
              <Plus size={16} /> Join Class
            </button>
            <button
              onClick={() => onNavigate('tests')}
              className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest text-xs border border-white/20 flex items-center gap-2 transition-all"
            >
              <Zap size={16} /> Active Tests
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => onNavigate('classes')}
          className="cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <BookOpen size={24} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Classes</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.enrolledCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Active Enrolled Courses</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => onNavigate('tests')}
          className="cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <FileText size={24} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Active</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.activeTestsCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pending Assessments</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => onNavigate('history')}
          className="cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Completed</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.completedTestsCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Exams Submitted</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          onClick={() => onNavigate('performance')}
          className="cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Award size={24} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Average</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.averageScorePercent}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Overall Grade Score</p>
        </motion.div>
      </div>

      {/* Main Grid: Active Tests Widget & Recent Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Quick Pending Assessments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="text-purple-500" size={20} />
              Pending Assessments
            </h2>
            <button
              onClick={() => onNavigate('tests')}
              className="text-xs font-bold uppercase tracking-widest text-purple-500 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          {recentTests.length === 0 ? (
            <div className="p-8 border border-dashed border-black/10 dark:border-white/10 rounded-3xl bg-white/40 dark:bg-black/20 text-center space-y-3">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
              <p className="text-slate-700 dark:text-slate-300 font-bold">You are all caught up!</p>
              <p className="text-xs text-slate-500">No pending tests in your enrolled classrooms.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTests.map((t) => (
                <div
                  key={t.id}
                  className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="space-y-1">
                    <span className="px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-widest">
                      {t.classrooms?.name || 'Classroom'}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.title}</h3>
                    <p className="text-xs text-slate-500">Duration: {t.duration_minutes ?? t.duration_mins ?? 45} Mins • {t.questions?.length || 0} Questions</p>
                  </div>
                  <button
                    onClick={() => onStartTest(t.id)}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-500/20 shrink-0 transition-colors"
                  >
                    Start Exam
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Activity Timeline */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Activity</h2>
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 space-y-4 shadow-sm">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No recent activity logged.</p>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 border-b border-slate-100 dark:border-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 shrink-0">
                    {act.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{act.title}</p>
                    {act.detail && <p className="text-[11px] text-slate-500">{act.detail}</p>}
                    <span className="text-[10px] text-slate-400">{act.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
