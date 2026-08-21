import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle2, FileText, X, ShieldCheck, Eye, Award } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';

export const StudentHistory: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await (supabase.from('attempts') as any)
        .select('*, tests(*, classrooms(name))')
        .eq('student_id', user!.id)
        .in('status', ['submitted', 'flagged'])
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setHistoryItems(results || []);
    } catch (e) {
      console.error('Error fetching exam history:', e);
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
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Clock className="text-purple-500" size={32} />
          Assessment History
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Historical log of your submitted exams, scores, and answer reviews.
        </p>
      </div>

      {historyItems.length === 0 ? (
        <div className="p-12 border border-dashed border-black/10 dark:border-white/10 rounded-3xl bg-white/40 dark:bg-black/20 text-center space-y-3">
          <FileText size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-2" />
          <p className="text-slate-700 dark:text-slate-300 font-bold">No exam history available.</p>
          <p className="text-xs text-slate-500">Completed tests will automatically appear here once submitted.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {historyItems.map((item) => {
            const test = item.tests;
            const totalMarks = test?.total_marks || 100;
            const pct = Math.min(100, Math.round(((item.score || 0) / totalMarks) * 100));

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-widest">
                      {test?.classrooms?.name || 'Classroom'}
                    </span>
                    <span className="px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck size={12} /> Verified Submitted
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{test?.title || 'Assessment'}</h3>
                  <p className="text-xs text-slate-400">Submitted on: {new Date(item.submitted_at || item.created_at).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{item.score} / {totalMarks}</p>
                    <p className="text-xs font-bold text-purple-500">{pct}% Grade Score</p>
                  </div>

                  <button
                    onClick={() => setSelectedResult(item)}
                    className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <Eye size={14} /> Review Answers
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-[36px] max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedResult.tests?.title || 'Exam Review'}</h2>
                  <p className="text-xs text-slate-500">Score: {selectedResult.score} / {selectedResult.tests?.total_marks || 100}</p>
                </div>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {(selectedResult.tests?.questions || []).map((q: any, idx: number) => {
                  const studentAns = selectedResult.answers?.[q.id];
                  const isCorrect = q.type === 'mcq' && studentAns === q.correctAnswer;

                  return (
                    <div key={q.id || idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Question {idx + 1} ({q.points || 1} pts)</span>
                        {q.type === 'mcq' && (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${isCorrect ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-slate-900 dark:text-white">{q.text}</p>

                      <div className="text-xs space-y-1">
                        <p className="text-slate-500">Your Answer: <span className="font-bold text-slate-800 dark:text-slate-200">{studentAns != null ? (q.options ? q.options[Number(studentAns)] || studentAns : studentAns) : 'Not answered'}</span></p>
                        {q.type === 'mcq' && !isCorrect && (
                          <p className="text-emerald-500">Correct Answer: <span className="font-bold">{q.options ? q.options[Number(q.correctAnswer)] || q.correctAnswer : q.correctAnswer}</span></p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
