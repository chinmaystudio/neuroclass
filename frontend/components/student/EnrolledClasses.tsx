import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, BookOpen, Users, ArrowRight } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { EnrolledClassDetail } from './EnrolledClassDetail';

interface EnrolledClassesProps {
  onJoinClick: () => void;
  onStartTest: (testId: string) => void;
}

export const EnrolledClasses: React.FC<EnrolledClassesProps> = ({ onJoinClick, onStartTest }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<any | null>(null);

  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*, classrooms(*)')
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false });

        if (error) throw error;
        
        const unique = data ? Array.from(new Map(data.map((item: any) => [item.classroom_id, item])).values()) : [];
        setClasses(unique);
      } catch (err) {
        console.error('Error fetching enrollments:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEnrollments();
  }, [user]);

  if (selectedClassroom) {
    return (
      <EnrolledClassDetail
        classroom={selectedClassroom}
        onBack={() => setSelectedClassroom(null)}
        onStartTest={onStartTest}
      />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-2">My Enrolled Classes</h2>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Active Learning Courses</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onJoinClick}
          className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-purple-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-purple-500/30 hover:bg-purple-500 transition-colors"
        >
          <Plus size={16} />
          Join Class
        </motion.button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl space-y-4">
          <BookOpen size={48} className="text-slate-300 dark:text-white/20" />
          <div className="text-center">
            <h3 className="text-lg font-bold">No Enrolled Classes</h3>
            <p className="text-slate-500 text-sm">Ask your instructor for a 6-character classroom code to get started.</p>
          </div>
          <button onClick={onJoinClick} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold uppercase tracking-widest text-xs shadow-md">
            Join Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((enrollment, index) => {
            const cls = enrollment.classrooms;
            if (!cls) return null;
            return (
              <motion.div
                key={enrollment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedClassroom(cls)}
                className="group cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[28px] p-6 hover:shadow-2xl hover:border-purple-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {cls.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                      Enrolled
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white group-hover:text-purple-500 transition-colors line-clamp-1">{cls.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">Code: {cls.code}</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500">{cls.students || 1} Classmates</span>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-purple-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Enter <ArrowRight size={14} />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
