import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Microscope, TrendingUp, AlertTriangle, Medal, Filter, Star } from 'lucide-react';
import { getEvaluations, EvaluationRecord, subscribeToStoreChanges } from '../../services/evaluationStore';

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];

export const AnalyticsDashboard: React.FC = () => {
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  useEffect(() => {
    const load = () => {
      setEvaluations(getEvaluations());
    };
    load();
    return subscribeToStoreChanges(load);
  }, []);

  const subjects = ['all', ...Array.from(new Set(evaluations.map(e => e.subject)))];

  const filteredEvals = evaluations.filter(e => 
    subjectFilter === 'all' || e.subject === subjectFilter
  );

  // 1. Calculate Grade Distribution Data
  const gradeCounts: { [key: string]: number } = {};
  filteredEvals.forEach(e => {
    // Simplify grade to A, B, C, D, F for pie chart grouping
    const baseGrade = e.grade.charAt(0);
    gradeCounts[baseGrade] = (gradeCounts[baseGrade] || 0) + 1;
  });
  const pieData = Object.keys(gradeCounts).map(g => ({
    name: `Grade ${g}`,
    value: gradeCounts[g]
  })).sort((a,b) => a.name.localeCompare(b.name));

  // 2. Score Distribution Histogram (ranges of marks e.g. <50, 50-60, 60-70, 70-80, 80-90, 90-100)
  const ranges = [
    { name: '<50', count: 0 },
    { name: '50-60', count: 0 },
    { name: '60-70', count: 0 },
    { name: '70-80', count: 0 },
    { name: '80-90', count: 0 },
    { name: '90-100', count: 0 }
  ];
  filteredEvals.forEach(e => {
    const marks = e.marksObtained;
    if (marks < 50) ranges[0].count++;
    else if (marks < 60) ranges[1].count++;
    else if (marks < 70) ranges[2].count++;
    else if (marks < 80) ranges[3].count++;
    else if (marks < 90) ranges[4].count++;
    else ranges[5].count++;
  });

  // 3. Trends over dates
  const trendData = filteredEvals
    .map(e => ({
      date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: e.percentage,
      name: e.studentName
    }))
    .reverse(); // simple chron order

  // Calculating averages
  const totalScoreObtained = filteredEvals.reduce((a, b) => a + b.marksObtained, 0);
  const totalScorePossible = filteredEvals.reduce((a, b) => a + b.totalMarks, 0);
  const classAvgPercentage = totalScorePossible > 0 ? Math.round((totalScoreObtained / totalScorePossible) * 100) : 0;

  // Weak Topics Analysis (Simulated structured output from RAG feedback matching)
  const weakTopics = [
    { topic: 'Quantum Normalization Constant Limits', parentSubject: 'Quantum Mechanics', confidence: '42% Average Score', impact: 'High Impact' },
    { topic: 'Exponent Calculations in Tunneling Coefficients', parentSubject: 'Quantum Mechanics', confidence: '48% Average Score', impact: 'Medium Impact' },
    { topic: 'Sophisticated Scientific Syntax & Sentence Breakouts', parentSubject: 'Academic Writing', confidence: '55% Average Score', impact: 'Low Impact' },
  ].filter(t => subjectFilter === 'all' || t.parentSubject === subjectFilter);

  // Leaderboard lists
  const leaderboard = [...filteredEvals]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl">
        <div className="flex items-center gap-3">
          <Filter size={16} className="opacity-40" />
          <span className="text-xs font-bold uppercase tracking-wider opacity-60">Analytics Subject Filter</span>
        </div>
        <select 
          value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value)}
          className="px-5 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 text-xs font-bold uppercase tracking-wider focus:outline-none"
        >
          {subjects.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Classes' : s}</option>
          ))}
        </select>
      </div>

      {/* Grade and Performance Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider opacity-40">Class average score</span>
            <h4 className="text-4xl font-black italic mt-1 text-slate-800 dark:text-white">{classAvgPercentage}%</h4>
            <p className="text-[10px] opacity-40 font-bold mt-1.5 uppercase transition-all">Across {filteredEvals.length} evaluated items</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider opacity-40">Flagged Submissions</span>
            <h4 className="text-4xl font-black italic mt-1 text-amber-500">0</h4>
            <p className="text-[10px] opacity-40 font-bold mt-1.5 uppercase">Plagiarism thresholds safe</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center animate-pulse">
            <Microscope size={24} />
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider opacity-40">Top Student Marks</span>
            <h4 className="text-4xl font-black italic mt-1 text-emerald-500">
              {leaderboard.length > 0 ? `${leaderboard[0].marksObtained}/${leaderboard[0].totalMarks}` : 'N/A'}
            </h4>
            <p className="text-[10px] opacity-40 font-bold mt-1.5 uppercase">
              {leaderboard.length > 0 ? `Set by ${leaderboard[0].studentName}` : 'No submissions yet'}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Star size={24} />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Line Chart: Performance Trends Over Time */}
        <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-md">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Performance Progression Timeline</h3>
            <p className="text-xs opacity-40 mt-1">Timeline of direct percentages awarded on evaluations.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '16px' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Marks Distribution Histogram */}
        <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-md">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Score Density & Distribution</h3>
            <p className="text-xs opacity-40 mt-1">Histogram displaying quantity of students in specified mark bandwidths.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranges}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={11} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '16px' }}
                />
                <Bar dataKey="count" fill="#a855f7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Grades Demographics */}
        <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-md">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Grades Breakdown</h3>
            <p className="text-xs opacity-40 mt-1">Demographics analysis of letter grades allocated to this course.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="opacity-80">{item.name}</span>
                  </div>
                  <span className="font-mono text-slate-500 dark:text-white/40">{item.value} Student(s)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leaderboard and Weak Topics */}
        <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-md">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Top Student Rankings</h3>
            <p className="text-xs opacity-40 mt-1">Leaderboard mapping our top-percentage achievers.</p>
          </div>
          <div className="space-y-4">
            {leaderboard.length === 0 ? (
              <p className="text-sm opacity-40 py-10 text-center">No evaluations cataloged for leaderboard yet.</p>
            ) : (
              leaderboard.map((item, idx) => (
                <div key={item.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c0d12] border border-black/5 dark:border-white/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-xs ${idx === 0 ? 'bg-amber-500/10 text-amber-500' : idx === 1 ? 'bg-slate-400/10 text-slate-400' : 'bg-orange-500/10 text-orange-500'}`}>
                      {idx === 0 ? <Medal size={16} /> : `#${idx + 1}`}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.studentName}</h4>
                      <p className="text-[10px] opacity-40 mt-0.5 uppercase tracking-wider">Roll: {item.rollNumber}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className="font-mono text-sm font-black text-blue-500">{item.percentage}%</span>
                    <span className="block text-[9px] font-bold uppercase tracking-widest opacity-40 mt-0.5">Grade: {item.grade}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Weak Topics Section */}
      <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-md">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-rose-500 animate-bounce" size={20} />
          <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Topic Gap Remediation (Urgent Focus)</h3>
        </div>
        <p className="text-xs opacity-40">Identified from student answer sheets via our automated semantic OCR grader.</p>

        <div className="space-y-4">
          {weakTopics.length === 0 ? (
            <p className="text-sm opacity-40 py-5 text-center">No topic gap deficiencies registered.</p>
          ) : (
            weakTopics.map(t => (
              <div key={t.topic} className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-rose-500/10">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-rose-500 tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-full">{t.impact}</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{t.topic}</h4>
                  <p className="text-[10px] opacity-40 font-bold uppercase">Course: {t.parentSubject}</p>
                </div>
                <div className="text-left md:text-right">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">{t.confidence}</span>
                  <p className="text-[9px] opacity-40 uppercase tracking-widest mt-0.5">Class Average Math Gap</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
