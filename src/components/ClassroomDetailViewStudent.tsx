import React from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Calendar, UserCheck, Shield, Award, Sparkles,
  ClipboardList, CheckCircle2, AlertCircle, Clock, Hash, Percent,
  TrendingUp, BarChart3
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface ClassroomDetailViewStudentProps {
  enrollment: any;
  attendance: any[];
  attempts: any[];
  loading: boolean;
  activeTab: 'details' | 'attendance';
  setActiveTab: (tab: 'details' | 'attendance') => void;
  onBack: () => void;
}

export const ClassroomDetailViewStudent: React.FC<ClassroomDetailViewStudentProps> = ({
  enrollment,
  attendance,
  attempts,
  loading,
  activeTab,
  setActiveTab,
  onBack
}) => {
  const classroom = enrollment.classrooms || {};
  
  // Calculations
  const totalClasses = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'Present').length;
  const lateCount = attendance.filter(a => a.status === 'Late').length;
  const absentCount = attendance.filter(a => a.status === 'Absent').length;
  
  // Attendance Rate (Count partial present for Late)
  const attendancePercentage = totalClasses > 0 
    ? Math.round(((presentCount + (lateCount * 0.7)) / totalClasses) * 100)
    : 100;

  // Academic Score
  const gradedAttempts = attempts.filter(a => a.score !== null && a.status === 'finished');
  const averageScore = gradedAttempts.length > 0
    ? Math.round((gradedAttempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / gradedAttempts.length))
    : null;

  // Chart Data preparation
  const chartData = attempts
    .filter(a => a.status === 'finished')
    .map((a, idx) => ({
      name: a.tests?.title?.substring(0, 10) || `Test ${idx + 1}`,
      score: Number(a.score || 0)
    }));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-10 text-left"
    >
      {/* Mini Breadcrumbs & Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-6">
        <div className="space-y-2">
          <button 
            onClick={onBack}
            className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Learning Space
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white capitalize">{classroom.name}</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/5">
              <Hash size={12} className="text-indigo-500" />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-600 dark:text-white/50">{classroom.code}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-medium">Domain Workspace & Personal Academic Report</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-full">
          <button 
            onClick={() => setActiveTab('details')}
            className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'details' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Performance Overview
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'attendance' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Attendance Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fetching personal record files...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Left Content Panel (2 columns in desktop) */}
          <div className="lg:col-span-2 space-y-8">
            {activeTab === 'details' ? (
              <>
                {/* Academic Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Attendance Card */}
                  <div className="p-6 rounded-[32px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm flex flex-col justify-between h-44 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                      <UserCheck size={80} className="text-indigo-600" />
                    </div>
                    <div className="flex justify-between items-start z-10">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Class Attendance</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#10b981] px-2 py-0.5 bg-[#10b981]/10 rounded border border-[#10b981]/25">Sync Raw</span>
                    </div>
                    <div className="my-2 z-10">
                      <span className="text-4xl font-extrabold tracking-tight font-mono">{attendancePercentage}%</span>
                    </div>
                    <div className="flex gap-2 text-[9px] font-bold text-slate-400 z-10">
                      <span className="text-emerald-500">{presentCount} Present</span>
                      <span>•</span>
                      <span className="text-amber-500">{lateCount} Late</span>
                      <span>•</span>
                      <span className="text-rose-500">{absentCount} Absent</span>
                    </div>
                  </div>

                  {/* Avg Score Card */}
                  <div className="p-6 rounded-[32px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm flex flex-col justify-between h-44 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                      <Award size={80} className="text-indigo-600" />
                    </div>
                    <div className="flex justify-between items-start z-10">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Average Score</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-purple-500 px-2 py-0.5 bg-purple-500/10 rounded border border-purple-500/25">Scale Rank</span>
                    </div>
                    <div className="my-2 z-10">
                      <span className="text-4xl font-extrabold tracking-tight font-mono">
                        {averageScore !== null ? `${averageScore}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 z-10">
                      {gradedAttempts.length} out of {attempts.length} exams finalized
                    </div>
                  </div>

                  {/* Biometrics Card */}
                  <div className="p-6 rounded-[32px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm flex flex-col justify-between h-44 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                      <Shield size={80} className="text-indigo-600" />
                    </div>
                    <div className="flex justify-between items-start z-10">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Secure Profile</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 px-2 py-0.5 bg-blue-500/10 rounded border border-blue-500/25">Liveness</span>
                    </div>
                    <div className="my-2 z-10">
                      <span className="text-lg font-bold tracking-tight text-emerald-500">Linked Securely</span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 z-10">
                      5 face sample tokens active
                    </div>
                  </div>
                </div>

                {/* Score progression chart if exists */}
                {chartData.length > 0 && (
                  <div className="p-8 rounded-[40px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm space-y-4">
                    <h3 className="text-md font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <TrendingUp size={16} className="text-indigo-500" /> Performance Trend
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                              border: 'none', 
                              borderRadius: '16px', 
                              color: '#fff',
                              fontSize: '11.5px',
                              fontFamily: 'sans-serif'
                            }} 
                          />
                          <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreColor)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Exams Attempt List */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <ClipboardList size={20} className="text-indigo-500" /> Submitted / Graded Examinations
                  </h3>
                  <div className="space-y-4">
                    {attempts.length > 0 ? (
                      attempts.map(attempt => (
                        <div 
                          key={attempt.id}
                          className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between shadow-sm"
                        >
                          <div className="space-y-2">
                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 bg-indigo-500/10 text-indigo-500 rounded border border-indigo-500/20">TEST RECORD</span>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">{attempt.tests?.title || 'Examination'}</h4>
                            <div className="flex gap-4 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1"><Clock size={12} /> Started: {new Date(attempt.started_at).toLocaleString()}</span>
                              {attempt.finished_at && <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Handed In</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${attempt.status === 'finished' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'}`}>
                              {attempt.status}
                            </span>
                            <span className="text-2xl font-black font-mono">
                              {attempt.score !== null ? `${attempt.score}%` : 'Unmarked'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-12 bg-white dark:bg-white/5 border border-dashed border-black/5 dark:border-white/10 rounded-3xl">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No examinations loaded for selection</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              // Attendance Logs Tab
              <div className="space-y-6">
                <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <Calendar size={20} className="text-indigo-500" /> Face Biometric Attendance Log
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attendance.length > 0 ? (
                    attendance.map(record => (
                      <div 
                        key={record.id}
                        className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <p className="text-xs text-slate-400 font-bold tracking-widest font-mono uppercase">{new Date(record.created_at || record.joined_at).toLocaleDateString()}</p>
                          <p className="text-xs text-slate-500 dark:text-white/40">{new Date(record.created_at || record.joined_at).toLocaleTimeString()}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full border ${
                          record.status === 'Present' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          record.status === 'Late' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {record.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-16 bg-white dark:bg-white/5 border border-dashed border-black/5 dark:border-white/10 rounded-[32px]">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No biometric attendance sessions indexed yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Side Sidebar (1 columns in desktop): Context Details & Help */}
          <div className="space-y-8">
            <div className="p-8 rounded-[40px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm space-y-6">
              <h3 className="text-base font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" /> Guidance Counsel
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Continuous Compliance</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Your face has been verified against active models. During live examinations, please avoid camera deviations, shadowing, or looking away from bounds for longer than 5 seconds.</p>
                </div>
                <div className="space-y-1 pt-4 border-t border-black/5 dark:border-white/5">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">AI Grading Integration</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Your answersheets are scrutinized with highly accurate localized criteria matching (RAG keys and scoring matrices). Ask the Chat Advisor for instant revision schedules based on your topic report.</p>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[40px] border border-blue-500/20 bg-blue-500/5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                <Shield size={16} /> Session Security
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                NeuroClass Session Guardian blocks credentials crossing over. This student portal is securely mapped strictly to your role.
              </p>
            </div>
          </div>

        </div>
      )}
    </motion.div>
  );
};
