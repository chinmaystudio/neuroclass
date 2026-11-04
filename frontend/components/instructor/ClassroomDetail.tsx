import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Users, ShieldCheck, BrainCircuit, FileText, Settings, UserCheck, ClipboardList, Radio } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { AttendanceSystem } from '../ai/AttendanceSystem';
import { ClassroomMaterialsPanel } from './ClassroomMaterialsPanel';
import { ClassroomLearningAnalytics } from './ClassroomLearningAnalytics';
import { useLocation } from 'react-router-dom';
import { TeacherTestsPanel } from '../../features/tests/TeacherTestsPanel';
import { TeacherAssignmentsPanel } from '../../features/assignments/TeacherAssignmentsPanel';

type Tab = 'students' | 'tests' | 'assignments' | 'materials' | 'attendance' | 'proctoring' | 'settings';

interface ClassroomDetailProps {
  classroomId: string;
  onBack: () => void;
  initialTab?: Tab;
}

export const ClassroomDetail: React.FC<ClassroomDetailProps> = ({ classroomId, onBack, initialTab }) => {
  const location = useLocation();
  const handoff = new URLSearchParams(location.search);
  const returnTo = handoff.get('return_to');
  const hasReturnToApp = returnTo?.startsWith('neuroclass://attendance-return') === true;
  const [classroom, setClassroom] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(() => initialTab ?? (handoff.get('attendance') === '1' ? 'attendance' : handoff.get('drive') ? 'materials' : 'students'));

  useEffect(() => {
    const fetchDetails = async () => {
      const { data } = await supabase.from('classrooms').select('*').eq('id', classroomId).single();
      const { data: roster } = await (supabase.from('students') as any).select('id,name,email,roll_number,face_registration_status').eq('classroom_id', classroomId).order('name');
      if (data) setClassroom(data);
      setStudents(roster || []);
    };
    fetchDetails();
  }, [classroomId]);

  if (!classroom) return <div className="p-8">Loading...</div>;

  // Tests and assignments are native NeuroClass modules (the separate
  // test_creation portal and its iframe handoff are no longer used).
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'students', label: 'Students', icon: <Users size={16} /> },
    { id: 'tests', label: 'Tests', icon: <BrainCircuit size={16} /> },
    { id: 'assignments', label: 'Assignments', icon: <ClipboardList size={16} /> },
    { id: 'materials', label: 'Materials', icon: <FileText size={16} /> },
    { id: 'attendance', label: 'Attendance', icon: <UserCheck size={16} /> },
    { id: 'proctoring', label: 'Proctoring', icon: <ShieldCheck size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ];
  const biometricReady = students.filter((s) => s.face_registration_status === 'REGISTERED').length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex justify-between items-center z-10 sticky top-0">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <button
            onClick={onBack}
            aria-label="Back to classrooms"
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
      <div role="tablist" className="overflow-x-auto px-4 pt-3 sm:px-6 md:px-8 md:pt-4 border-b border-black/5 dark:border-white/10 flex gap-5 md:gap-8 sticky top-[73px] md:top-[89px] bg-slate-50/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md z-10 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
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
            transition={{ duration: 0.15 }}
            className="min-h-full"
          >
            {activeTab === 'students' && (
              <div className="min-w-0 bg-white dark:bg-white/5 rounded-3xl p-5 sm:p-6 md:p-8 border border-black/5 dark:border-white/10 shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Enrolled Students</h3>
                    <p className="text-sm text-slate-500">Teacher-owned roster for {classroom.name}.</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600">{students.length} enrolled · {biometricReady} Face ID ready</span>
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

            {activeTab === 'tests' && <TeacherTestsPanel classroomId={classroom.id} classroomName={classroom.name} />}

            {activeTab === 'assignments' && <TeacherAssignmentsPanel classroomId={classroom.id} classroomName={classroom.name} />}

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
                <div className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-6 space-y-4">
                  <h3 className="text-xl font-bold">Exam proctoring</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Proctoring is set per test (Tests → a test → Security &amp; proctoring). During a live test, open <strong>Monitor</strong> on the test card to see who is in the exam, camera and identity status, warnings and alerts. After the exam, each attempt has a proctoring timeline you can review, dismiss or flag.</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                    <li>Identity is checked against each student’s registered Face ID ({biometricReady} of {students.length} students ready).</li>
                    <li>Face presence, head pose and gaze are analysed on the student’s device; only numeric signals reach the server.</li>
                    <li>Signals are review aids. Students are never failed automatically, and they can appeal.</li>
                  </ul>
                  <button type="button" onClick={() => setActiveTab('tests')} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white"><Radio size={14} /> Go to tests</button>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="rounded-3xl border border-black/5 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5">
                Classroom code <code className="font-bold text-blue-500">{classroom.code}</code>. Share it with students so they can join; tests and assignments are only visible to enrolled students.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
