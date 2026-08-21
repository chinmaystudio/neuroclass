import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BrainCircuit, Clock, Play, FileText } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';

interface ActiveTestsProps {
  onStartTest: (testId: string) => void;
}

export const ActiveTests: React.FC<ActiveTestsProps> = ({ onStartTest }) => {
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTests();
    }
  }, [user]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      // 1. Get student profiles and enrolled classrooms
      const { data: studentProfiles } = await supabase
        .from('students')
        .select('id, classroom_id')
        .eq('user_id', user!.id);
          
        if (studentProfiles) {
           const classIds = studentProfiles.map(s => s.classroom_id);
           const { data: availableTests } = await supabase
             .from('tests')
             .select('*, classrooms(name, code)')
             .in('classroom_id', classIds)
             .order('created_at', { ascending: false });

           const { data: completedAttempts } = await supabase
             .from('attempts')
             .select('test_id,status')
             .eq('student_id', user!.id)
             .in('status', ['submitted', 'flagged']);

           const completedTestIds = new Set((completedAttempts || []).map(r => r.test_id));
           
           const pendingTests = (availableTests || []).filter(t => !completedTestIds.has(t.id));
           setTests(pendingTests);
        }
    } catch (e) {
      console.error(e);
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
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <BrainCircuit className="text-purple-500" size={32} />
          Active Assessments
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
          Pending tests from your enrolled classrooms.
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-black/10 dark:border-white/10 rounded-3xl bg-white/30 dark:bg-black/10 backdrop-blur-md">
          <FileText size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-4" />
          <p className="text-slate-500 dark:text-white/50 font-medium">You have no pending assessments.</p>
          <p className="text-xs text-slate-400 dark:text-white/30 mt-1">Check back later or join a new classroom.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tests.map((test, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={test.id}
              className="group bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-200/20 dark:shadow-none hover:shadow-2xl hover:-translate-y-1 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{test.title}</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-500">
                    {test.classrooms?.name}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <FileText size={18} />
                </div>
              </div>
              
              <p className="text-sm text-slate-500 dark:text-white/50 mb-6 line-clamp-2 min-h-[40px]">
                {test.description || "No specific instructions provided."}
              </p>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <Clock size={14} />
                  {test.duration_minutes ?? test.duration_mins ?? 45} Mins
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <BrainCircuit size={14} />
                  {test.questions?.length || 0} Qs
                </div>
              </div>

              <button 
                onClick={() => onStartTest(test.id)}
                className="w-full py-3.5 rounded-2xl bg-purple-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-purple-500/30 group-hover:bg-purple-500 transition-colors flex items-center justify-center gap-2"
              >
                <Play size={14} /> Start Exam
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
