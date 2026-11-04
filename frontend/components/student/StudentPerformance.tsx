import React, { useEffect, useState } from 'react';
import { 
  BarChart3, Award, TrendingUp, Sparkles, BookOpen, Hourglass
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../features/lms/api';
import type { StudentTest } from '../../features/lms/types';

/** Only released results count; nothing is estimated or invented. */
export const StudentPerformance: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalExams: 0,
    averagePercent: 0,
    highestPercent: 0,
    awaiting: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPerformanceData();
    }
  }, [user]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { tests } = await api.get<{ tests: StudentTest[] }>('me/tests');
      const finished = tests.filter((t) => t.lastAttemptId);
      const released = finished
        .filter((t) => t.result && t.result.percentage !== null)
        .sort((a, b) => new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime());
      const formatted = released.map((t) => ({
        name: t.title,
        score: t.result!.score ?? 0,
        total: t.result!.maxScore ?? t.totalMarks,
        percentage: Math.max(0, Math.min(100, Math.round(t.result!.percentage ?? 0))),
        classroom: t.classroomName || 'Class',
      }));
      const sum = formatted.reduce((acc, r) => acc + r.percentage, 0);
      setChartData(formatted);
      setSummary({
        totalExams: finished.length,
        averagePercent: formatted.length ? Math.round(sum / formatted.length) : 0,
        highestPercent: formatted.reduce((m, r) => Math.max(m, r.percentage), 0),
        awaiting: finished.length - formatted.length,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not load your results.');
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
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <BarChart3 className="text-purple-500" size={32} />
          Performance & Analytics
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Your released exam results across all classrooms.
        </p>
        {error && <p className="mt-3 text-sm text-red-500">{error} <button type="button" className="underline" onClick={fetchPerformanceData}>Retry</button></p>}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Exams</span>
            <BookOpen className="text-purple-500" size={20} />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{summary.totalExams}</p>
          <p className="text-xs text-slate-500 mt-1">Submitted Assessments</p>
        </div>

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Average Grade</span>
            <TrendingUp className="text-indigo-500" size={20} />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{summary.averagePercent}%</p>
          <p className="text-xs text-slate-500 mt-1">Mean of released results</p>
        </div>

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Peak Performance</span>
            <Award className="text-amber-500" size={20} />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{summary.highestPercent}%</p>
          <p className="text-xs text-slate-500 mt-1">Highest Score Achieved</p>
        </div>

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Awaiting Results</span>
            <Hourglass className="text-amber-500" size={20} />
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{summary.awaiting}</p>
          <p className="text-xs text-slate-500 mt-1">Submitted, not yet released</p>
        </div>
      </div>

      {/* Main Bar Chart */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 shadow-xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="text-purple-500" size={20} /> Exam Performance Progression
            </h2>
            <p className="text-xs text-slate-500 mt-1">Percentage scores across all completed assessments</p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-black/10 dark:border-white/10 rounded-2xl text-slate-400 text-sm">
            <BarChart3 size={40} className="mb-2 opacity-50" />
            No released results yet. Results appear here once your teacher publishes them.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#888888" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#888888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid #333', color: '#fff' }}
                  formatter={(value: any) => [`${value}%`, 'Score Percentage']}
                />
                <Bar dataKey="percentage" fill="#a855f7" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
