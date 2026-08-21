import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Sparkles, Save, Clock, Target, FileText, X, BrainCircuit, AlertCircle } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { cn } from '../../lib/utils';
import { AIGenerationModal } from './AIGenerationModal';

interface Question {
  id: string;
  type: 'mcq' | 'subjective';
  text: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
}

export const TestDesigner = () => {
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [testTitle, setTestTitle] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [duration, setDuration] = useState(60);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('classrooms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setClassrooms(data);
        if (data.length > 0) setSelectedClass(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching classrooms', error);
    }
  };

  const addQuestion = (type: 'mcq' | 'subjective') => {
    const newQ: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: '',
      points: 10,
      ...(type === 'mcq' ? { options: ['', '', '', ''], correctAnswer: '0' } : {})
    };
    setQuestions([...questions, newQ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleSaveTest = async () => {
    if (!testTitle || !selectedClass || questions.length === 0) {
      setMessage('Please fill in title, select a classroom, and add at least one question.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase
        .from('tests')
        .insert({
          classroom_id: selectedClass,
          title: testTitle,
          subject: testDescription || 'General',
          duration_mins: duration,
          total_marks: questions.reduce((sum, question) => sum + Math.max(0, Number(question.points) || 0), 0),
          questions,
          proctoring_enabled: true
        });
      
      if (error) throw error;
      
      setMessage('Test successfully deployed!');
      // Reset form
      setTestTitle('');
      setTestDescription('');
      setQuestions([]);
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setMessage(`Error saving test: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Target className="text-blue-500" size={32} />
            Test Designer
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Create standard assessments or use NeuroClass AI to generate them instantly.</p>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={() => setIsAiModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs hover:bg-blue-500/20 transition-all"
            title="Generate test with AI"
          >
            <Sparkles size={16} /> Auto-Generate with AI
          </button>
          <button 
            onClick={handleSaveTest}
            disabled={saving}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-all disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />} 
            Deploy Test
          </button>
        </div>
      </div>

      {message && (
        <div className={cn("p-4 rounded-xl text-sm font-semibold flex items-center gap-2", message.includes('Error') || message.includes('fill') ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")}>
          <AlertCircle size={16} /> {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Metadata */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Test Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Target Classroom</label>
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Select Classroom</option>
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Test Title</label>
                <input 
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="e.g. Midterm Physics"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Duration (Minutes)</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Description / Instructions</label>
                <textarea 
                  value={testDescription}
                  onChange={(e) => setTestDescription(e.target.value)}
                  placeholder="Instructions for students..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Questions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-4">
            <button 
              onClick={() => addQuestion('mcq')}
              className="flex-1 py-4 border border-dashed border-slate-300 dark:border-white/20 rounded-2xl text-slate-500 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <Plus size={16} /> Add Multiple Choice
            </button>
            <button 
              onClick={() => addQuestion('subjective')}
              className="flex-1 py-4 border border-dashed border-slate-300 dark:border-white/20 rounded-2xl text-slate-500 hover:text-purple-500 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <FileText size={16} /> Add Subjective
            </button>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {questions.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-3xl bg-slate-50/50 dark:bg-white/5">
                  <BrainCircuit size={48} className="mx-auto text-slate-300 dark:text-white/20 mb-4" />
                  <p className="text-slate-500 font-medium">No questions added yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Add a question manually to begin building the test.</p>
                </motion.div>
              )}
              {questions.map((q, index) => (
                <motion.div 
                  key={q.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm relative group"
                >
                  <button 
                    onClick={() => removeQuestion(q.id)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>

                  <div className="flex justify-between items-center mb-6 pr-10">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white flex items-center justify-center">{index + 1}</span>
                      {q.type === 'mcq' ? 'Multiple Choice' : 'Subjective Question'}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Points</label>
                      <input 
                        type="number" 
                        value={q.points}
                        onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 0 })}
                        className="w-16 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm text-center"
                      />
                    </div>
                  </div>

                  <textarea 
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                    placeholder="Enter question text here..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-blue-500 resize-none mb-4"
                  />

                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-3">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-3">
                          <button
                            onClick={() => updateQuestion(q.id, { correctAnswer: optIdx.toString() })}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              q.correctAnswer === optIdx.toString() ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 dark:border-white/20 hover:border-emerald-500/50"
                            )}
                          >
                            {q.correctAnswer === optIdx.toString() && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                          </button>
                          <input 
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...q.options!];
                              newOpts[optIdx] = e.target.value;
                              updateQuestion(q.id, { options: newOpts });
                            }}
                            placeholder={`Option ${optIdx + 1}`}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AIGenerationModal 
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onGenerate={(testData) => {
          setTestTitle(testData.title || '');
          setTestDescription(testData.instructions || '');
          setDuration(testData.durationMins || 60);
          
          if (testData.questions && Array.isArray(testData.questions)) {
            const mappedQuestions = testData.questions.map((q: any) => ({
              id: crypto.randomUUID(),
              text: q.text,
              type: q.type === 'mcq' ? 'mcq' : 'subjective',
              options: q.options ? q.options : ['', '', '', ''],
              correctAnswer: q.options && q.correctAnswer 
                ? q.options.indexOf(q.correctAnswer).toString() 
                : '0',
              points: Number(q.marks ?? q.points ?? 10) || 10
            }));
            setQuestions(mappedQuestions);
          }
        }}
      />
    </div>
  );
};
