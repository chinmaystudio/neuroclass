import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Users, ShieldCheck, BrainCircuit, FileText, BarChart3, Settings, Zap, UserCheck } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { AttendanceSystem } from '../ai/AttendanceSystem';
import { ProctoringSystem } from '../ai/ProctoringSystem';
import { ClassroomMaterialsPanel } from './ClassroomMaterialsPanel';
import { ClassroomLearningAnalytics } from './ClassroomLearningAnalytics';
import { getApiUrl } from '../../config/apiConfig';
import { useLocation } from 'react-router-dom';

interface ClassroomDetailProps {
  classroomId: string;
  onBack: () => void;
}

export const ClassroomDetail: React.FC<ClassroomDetailProps> = ({ classroomId, onBack }) => {
  const location = useLocation();
  const handoff = new URLSearchParams(location.search);
  const returnTo = handoff.get('return_to');
  const hasReturnToApp = returnTo?.startsWith('neuroclass://attendance-return') === true;
  const [classroom, setClassroom] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'tests' | 'materials' | 'attendance' | 'proctoring' | 'x402' | 'settings'>(() => handoff.get('attendance') === '1' ? 'attendance' : handoff.get('drive') ? 'materials' : 'students');
  const [testPortalSrc, setTestPortalSrc] = useState<string | null>(null);
  const [testPortalLoading, setTestPortalLoading] = useState(false);
  const [testPortalError, setTestPortalError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      const { data } = await supabase.from('classrooms').select('*').eq('id', classroomId).single();
      const { data: roster } = await (supabase.from('students') as any).select('id,name,email,roll_number,face_registration_status').eq('classroom_id', classroomId).order('name');
      if (data) setClassroom(data);
      setStudents(roster || []);
    };
    fetchDetails();
  }, [classroomId]);

  useEffect(() => {
    if (activeTab !== 'tests') return;
    let cancelled = false;
    setTestPortalLoading(true);
    setTestPortalError(null);
    setTestPortalSrc(null);
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Your NeuroClass session is missing. Please sign in again.');
      const response = await fetch(getApiUrl('/api/test-portal/handoff'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId }),
      });
      if (!response.ok) throw new Error('Unable to authorize the classroom test portal.');
      const result = await response.json() as { handoffToken: string };
      if (!cancelled) {
        const portalUrl = import.meta.env.VITE_TEST_PORTAL_URL || 'https://test-creation-qwlp.onrender.com';
        setTestPortalSrc(`${portalUrl}/api/auth/handoff?token=${encodeURIComponent(result.handoffToken)}&redirect=${encodeURIComponent(`/classroom/${classroomId}`)}`);
      }
    })().catch(error => {
      if (!cancelled) setTestPortalError(error instanceof Error ? error.message : 'Test portal authorization failed.');
    }).finally(() => {
      if (!cancelled) setTestPortalLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, classroomId]);

  if (!classroom) return <div className="p-8">Loading...</div>;

  const tabs = [
    { id: 'students', label: 'Students', icon: <Users size={16} /> },
    { id: 'tests', label: 'Test Designer', icon: <BrainCircuit size={16} /> },
    { id: 'materials', label: 'Materials', icon: <FileText size={16} /> },
    { id: 'attendance', label: 'Attendance', icon: <UserCheck size={16} /> },
    { id: 'proctoring', label: 'Proctoring', icon: <ShieldCheck size={16} /> },
    { id: 'x402', label: 'x402 Protocol', icon: <Zap size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex justify-between items-center z-10 sticky top-0">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="truncate text-xl sm:text-2xl font-black tracking-tight">{classroom.name}</h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Code: <code className="text-blue-500">{classroom.code}</code></span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="overflow-x-auto px-4 pt-3 sm:px-6 md:px-8 md:pt-4 border-b border-black/5 dark:border-white/10 flex gap-5 md:gap-8 sticky top-[73px] md:top-[89px] bg-slate-50/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md z-10 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex shrink-0 items-center gap-2 pb-3 md:pb-4 text-[11px] md:text-sm font-bold uppercase tracking-widest transition-colors relative ${
              activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeDetailTab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="min-h-full"
          >
            {activeTab === 'students' && (
              <div className="min-w-0 bg-white dark:bg-white/5 rounded-3xl p-5 sm:p-6 md:p-8 border border-black/5 dark:border-white/10 shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Enrolled Students</h3>
                    <p className="text-sm text-slate-500">Teacher-owned roster for {classroom.name}.</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600">{students.length} enrolled</span>
                </div>
                <div className="space-y-3">
                  {students.length === 0 ? <p className="text-sm text-slate-500">No students have joined with the classroom code yet.</p> : students.map((student) => (
                    <div key={student.id} className="flex flex-col gap-3 rounded-2xl border border-black/5 dark:border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="font-bold">{student.name}</p><p className="text-xs text-slate-500">{student.email || 'No email'} {student.roll_number ? `· Roll ${student.roll_number}` : ''}</p></div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${student.face_registration_status === 'REGISTERED' ? 'text-emerald-500' : 'text-amber-500'}`}>{student.face_registration_status === 'REGISTERED' ? 'Biometric ready' : 'Needs registration'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'tests' && (
              <div className="bg-white dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/10 shadow-xl overflow-hidden min-h-[560px] md:min-h-[720px] flex flex-col">
                <div className="flex flex-col items-start justify-between gap-3 p-4 sm:p-5 md:flex-row md:items-center border-b border-black/5 dark:border-white/10">
                  <div>
                    <h3 className="text-xl font-bold">Test Designer</h3>
                    <p className="text-sm text-slate-500">Create, publish, and monitor tests for {classroom.name}. Only enrolled students can access them.</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">Classroom secured</span>
                </div>
                <div className="flex-1 min-h-[520px] md:min-h-[640px] bg-slate-100 dark:bg-black/20">
                  {testPortalLoading && <div className="flex h-full min-h-[520px] md:min-h-[640px] items-center justify-center p-6 text-center text-sm font-semibold text-slate-500">Authorizing classroom test portal…</div>}
                  {testPortalError && <div className="flex h-full min-h-[520px] md:min-h-[640px] items-center justify-center p-6 text-center text-sm font-semibold text-red-500">{testPortalError}</div>}
                  {testPortalSrc && <iframe title={`${classroom.name} test designer`} src={testPortalSrc} className="h-full min-h-[520px] md:min-h-[640px] w-full border-0" allow="camera; fullscreen; autoplay" allowFullScreen />}
                </div>
              </div>
            )}

            {activeTab === 'materials' && (
              <div className="space-y-6"><ClassroomMaterialsPanel classroomId={classroom.id} /><ClassroomLearningAnalytics classroomId={classroom.id} /></div>
            )}

            {activeTab === 'attendance' && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6">
                  <h3 className="text-xl font-bold mb-2">Classroom Attendance</h3>
                  <p className="text-sm text-slate-500 mb-6">Open a teacher-authorized session, register student samples, and scan this classroom through the Render AI gateway.</p>
                  {hasReturnToApp && <a href={returnTo!} className="mb-5 inline-flex rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white dark:bg-white dark:text-slate-900">Return to NeuroClass app</a>}
                  <AttendanceSystem classId={classroom.id} className={classroom.name} />
                </div>
              </div>
            )}

            {activeTab === 'proctoring' && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-6">
                  <h3 className="text-xl font-bold mb-2">Exam Proctoring</h3>
                  <p className="text-sm text-slate-500 mb-6">Monitor exam integrity separately from classroom attendance.</p>
                  <ProctoringSystem />
                </div>
              </div>
            )}

            {activeTab === 'x402' && (
              <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-3xl p-8 border border-purple-500/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                  <Zap className="text-amber-400" />
                  x402 Protocol Settlement
                </h3>
                <p className="text-sm text-purple-200 mb-8 max-w-lg">
                  Automated Algorand smart contracts for instructor compensation and tokenized student rewards based on performance milestones.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                    <p className="text-xs uppercase tracking-widest text-purple-300 font-bold mb-2">Pending Settlement</p>
                    <p className="text-3xl font-mono text-white">450 <span className="text-sm text-purple-400">ALGO</span></p>
                  </div>
                  <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                    <p className="text-xs uppercase tracking-widest text-emerald-300 font-bold mb-2">Total Earned</p>
                    <p className="text-3xl font-mono text-white">2,100 <span className="text-sm text-emerald-400">ALGO</span></p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
