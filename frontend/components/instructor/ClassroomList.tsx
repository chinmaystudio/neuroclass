import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, LayoutTemplate, X } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const ClassroomList: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClassrooms = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClassrooms(data || []);
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, [user]);

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !user) return;
    setIsCreating(true);
    setError(null);
    
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const classroomData = {
        name: newClassName.trim(),
        code: code,
        students: 0,
        attendance: '0%',
        status: 'Active',
        user_id: user.id
      };

      const { data, error } = await supabase.from('classrooms').insert(classroomData).select();
      
      if (error) throw error;
      
      setCreateModalOpen(false);
      setNewClassName('');
      fetchClassrooms();
    } catch (err: any) {
      setError(err.message || 'Failed to create classroom.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-2">My Classrooms</h2>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Active Instances</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-colors"
        >
          <Plus size={16} />
          Create Class
        </motion.button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl">
          <LayoutTemplate size={48} className="text-slate-300 dark:text-white/20 mb-4" />
          <h3 className="text-lg font-bold">No classrooms yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create your first instance to begin.</p>
          <button onClick={() => setCreateModalOpen(true)} className="text-blue-500 font-bold hover:underline">Create now</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((cls, index) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(cls.id)}
              className="group cursor-pointer bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[24px] p-6 hover:shadow-2xl hover:border-blue-500/30 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {cls.name.substring(0, 1).toUpperCase()}
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                  {cls.status || 'Active'}
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-blue-500 transition-colors">{cls.name}</h3>
              <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <span className="text-sm font-semibold">{cls.students || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Code:</span>
                  <code className="text-sm font-mono font-bold text-blue-500">{cls.code}</code>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-[#0a0a0a] rounded-[32px] border border-slate-200 dark:border-white/10 p-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-light tracking-tight text-slate-900 dark:text-white">New Classroom</h3>
                <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classroom Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Advanced AI Theory" 
                    className="w-full px-6 py-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
                </div>
                <button 
                  onClick={handleCreateClass}
                  disabled={isCreating}
                  className="w-full py-5 rounded-3xl bg-blue-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Instance'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
