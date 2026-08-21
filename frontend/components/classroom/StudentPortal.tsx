import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, UserCheck, Shield, Users, User,
  Layout, Activity, Search, Plus, 
  BarChart3, Clock, Lock, Eye, FileText,
  CheckCircle2, ArrowRight, UserPlus, BrainCircuit,
  Phone, Hash, Mail, ClipboardList, Play, LogOut, Sparkles
} from 'lucide-react';
import { supabase } from '../../database/supabase';
import { CameraService } from '../../services/ml/CameraService';
import { LocalMLService } from '../../services/ml/LocalMLService';
import ExamPortal from '../exams/ExamPortal';
import { AssignmentEvaluator } from '../evaluation/AssignmentEvaluator';
import { getApiUrl } from '../../config/apiConfig';

import { ClassroomDetailViewStudent } from './ClassroomDetailViewStudent';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StudentPortalProps {
  user?: any;
  onClose?: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ user, onClose }) => {
  const currentUserId = user?.id || user?.uid;
  const [view, setView] = useState<'dashboard' | 'join' | 'grader'>('dashboard');
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoinModalOpen, setJoinModalOpen] = useState(false);
  const [joinStep, setJoinStep] = useState(1);
  
  // Registration data
  const [joinCode, setJoinCode] = useState('');
  const [studentDetails, setStudentDetails] = useState({
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
    rollNumber: '',
    phoneNumber: '',
    email: user?.email || '',
    faceSamples: [] as string[]
  });
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCapturing, joinStep]);

  const [activeTests, setActiveTests] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<any | null>(null);

  useEffect(() => {
    fetchEnrolledClasses();
    return () => {
      // Cleanup camera on unmount
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [user]);

  useEffect(() => {
    if (enrolledClasses.length > 0) {
      fetchTests();
    }
  }, [enrolledClasses]);

  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'attendance'>('details');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attemptsRecords, setAttemptsRecords] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const handleViewClassroomDetails = async (enrollment: any, tab: 'details' | 'attendance') => {
    setSelectedEnrollment(enrollment);
    setActiveDetailTab(tab);
    setDetailsLoading(true);
    try {
      // 1. Fetch real attendance records for this student in this classroom
      const { data: attData, error: attErr } = await (supabase
        .from('attendance') as any)
        .select('*')
        .eq('classroom_id', enrollment.classroom_id)
        .eq('student_id', enrollment.id);
      
      if (attErr) throw attErr;
      setAttendanceRecords(attData || []);

      // 2. Fetch real exam attempts & marks of this student
      const { data: attpData, error: attpErr } = await (supabase
        .from('attempts') as any)
        .select('*, tests(*)')
        .eq('student_id', enrollment.id);
      
      if (attpErr) throw attpErr;
      
      // Filter attempts belonging to this classroom's tests
      const classAttempts = attpData ? attpData.filter((a: any) => a.tests?.classroom_id === enrollment.classroom_id) : [];
      setAttemptsRecords(classAttempts);
    } catch (err) {
      console.error('Error fetching academic details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchEnrolledClasses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userEmail = user.email || user.user_metadata?.email || '';
      const { data, error } = await (supabase
        .from('students') as any)
        .select('*, classrooms(*)')
        .eq('email', userEmail);
      
      if (error) throw error;
      // Filter unique enrollments by classroom_id
      const uniqueEnrollments = data ? Array.from(new Map(data.map((item: any) => [item.classroom_id, item])).values()) : [];
      setEnrolledClasses(uniqueEnrollments);
    } catch (e) {
      console.error('Error fetching enrollments:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    try {
      const classIds = enrolledClasses.map(ec => ec.classroom_id);
      if (classIds.length === 0) return;

      const { data, error } = await (supabase
        .from('tests') as any)
        .select('*, classrooms(name)')
        .in('classroom_id', classIds)
        .eq('status', 'published');
      
      if (error) throw error;
      
      // Filter out duplicate tests if any (e.g. if a test somehow appears twice in results)
      const uniqueTests = data ? Array.from(new Map(data.map((item: any) => [item.id, item])).values()) : [];
      setActiveTests(uniqueTests);
    } catch (e) {
      console.error('Error fetching tests:', e);
    }
  };

  const handleJoinClassroom = async () => {
    if (studentDetails.faceSamples.length < 5) {
      alert('Please capture all 5 face samples first.');
      return;
    }

    setIsRegistering(true);
    console.log('[DEBUG] Attempting to join classroom with code:', joinCode);
    
    try {
      // 1. Verify classroom code (Trim and Uppercase for robustness)
      const sanitizedCode = joinCode.trim().toUpperCase();
      const { data: classroom, error: classErr } = await (supabase
        .from('classrooms') as any)
        .select('*')
        .eq('code', sanitizedCode)
        .single();
      
      if (classErr) {
        console.error('[DEBUG] Supabase Error during code lookup:', classErr);
        throw new Error('Classroom not found. Please double-check the 6-character code with your teacher.');
      }
      
      if (!classroom) {
        throw new Error('Invalid classroom code. Check with your teacher.');
      }

      console.log('[DEBUG] Classroom found:', classroom.name, 'ID:', classroom.id);
      const { error: enrollErr } = await (supabase
        .from('students') as any)
        .insert({
          classroom_id: classroom.id,
          name: studentDetails.name,
          roll_number: studentDetails.rollNumber,
          phone: studentDetails.phoneNumber,
          email: studentDetails.email,
          face_samples: studentDetails.faceSamples,
          joined_at: new Date().toISOString()
        });
      
      if (enrollErr) {
        if (enrollErr.message?.includes('unique')) {
           throw new Error('You are already enrolled in this classroom.');
        }
        throw enrollErr;
      }

      // 3. Update classroom student count
      await (supabase
        .from('classrooms') as any)
        .update({ students: (classroom.students || 0) + 1 })
        .eq('id', classroom.id);

      // Cleanup camera if active
      stopCapture();
      
      setJoinModalOpen(false);
      setJoinStep(1);
      fetchEnrolledClasses();
      alert('Welcome to ' + classroom.name + '! Registration complete.');
    } catch (e: any) {
      alert(e.message || 'Enrollment failed. Try a different code.');
    } finally {
      setIsRegistering(false);
    }
  };

  const startCapture = async () => {
    try {
      setIsCapturing(true); // Set capturing true first to render video element
      const newStream = await CameraService.startCamera();
      setStream(newStream);
    } catch (e) {
      setIsCapturing(false);
      alert('Camera access denied or failed to start');
    }
  };

  const captureSample = () => {
    if (videoRef.current && canvasRef.current) {
      const frame = CameraService.captureFrame(videoRef.current);
      if (!frame) return; // Silent failure if not ready
      
      setStudentDetails(prev => {
        const newSamples = [...prev.faceSamples, `data:image/jpeg;base64,${frame}`];
        // If we reached 5, maybe auto-stop? (optional)
        return {
          ...prev,
          faceSamples: newSamples.slice(-5)
        };
      });
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const [isStartingTest, setIsStartingTest] = useState(false);
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);

  const handleStartTest = async (test: any) => {
    setIsStartingTest(true);
    try {
      const enrollment = enrolledClasses.find(ec => ec.classroom_id === test.classroom_id);
      if (!enrollment) throw new Error("Enrollment not found for this class");

      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error('Your signed-in session has expired. Please sign in again.');
      const response = await fetch(getApiUrl('/api/exams/attempt/start'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.session.access_token}`
        },
        body: JSON.stringify({ testId: test.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.attemptId) throw new Error(payload.error || 'Failed to initialize test attempt.');
      setCurrentAttemptId(payload.attemptId);
      setSelectedTest(test);
    } catch (err: any) {
      console.error('Failed to start test attempt:', err);
      alert('Error: ' + (err.message || 'Failed to initialize test attempt.'));
    } finally {
      setIsStartingTest(false);
    }
  };

  if (selectedTest && currentAttemptId) {
    return (
      <ExamPortal 
        test={{ ...selectedTest.test_data, id: selectedTest.id, classroom_id: selectedTest.classroom_id }} 
        attemptId={currentAttemptId}
        onExit={() => {
          setSelectedTest(null);
          setCurrentAttemptId(null);
          fetchTests(); // Refresh to check if test is still live or results are needed
        }} 
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-[#000000] text-slate-900 dark:text-white flex flex-col font-sans overflow-hidden">
      {/* Student Top Bar */}
      <header className="h-20 border-b border-black/5 dark:border-white/5 px-8 flex items-center justify-between bg-white/80 dark:bg-black/40 backdrop-blur-3xl z-50">
        <div className="flex items-center gap-4">
          <img src="/logo-light.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain block dark:hidden drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
          <img src="/logo-dark.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">Student Portal</h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <button 
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem('neuroclass_role');
              window.location.reload();
            }}
            className="px-5 py-2 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-500 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-white/10 flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
          
          <button 
            onClick={() => setView(view === 'grader' ? 'dashboard' : 'grader')}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-2 shadow-sm cursor-pointer",
              view === 'grader' 
                ? "bg-purple-600 text-white border-purple-500/20" 
                : "bg-purple-600/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600/20 border-purple-500/20"
            )}
          >
            <Sparkles size={14} /> {view === 'grader' ? "Dashboard" : "AI Grader"}
          </button>

          <button 
            onClick={() => setJoinModalOpen(true)}
            className="px-6 py-2 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-blue-500/20 cursor-pointer"
          >
            Join Classroom
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-10 bg-slate-50 dark:bg-slate-950/20">
        <div className="max-w-7xl mx-auto space-y-16">
          
          {view === 'grader' ? (
            <div className="space-y-10">
              <div className="space-y-4 text-left border-b border-black/5 dark:border-white/5 pb-4">
                 <h2 className="text-4xl font-light tracking-tight">AI Assignment Grader Workspace</h2>
                 <p className="text-slate-500 dark:text-white/40 text-sm">Submit your homework drafts or uploaded handwritten answersheets for direct weighted criteria reviews, plagiarism checks, and detailed feedback summaries.</p>
              </div>
              <div className="w-full">
                <AssignmentEvaluator />
              </div>
            </div>
          ) : selectedEnrollment ? (
            <ClassroomDetailViewStudent 
              enrollment={selectedEnrollment}
              attendance={attendanceRecords}
              attempts={attemptsRecords}
              loading={detailsLoading}
              activeTab={activeDetailTab}
              setActiveTab={setActiveDetailTab}
              onBack={() => setSelectedEnrollment(null)}
            />
          ) : (
            <>
              <div className="space-y-2 text-left">
                 <h2 className="text-4xl font-light tracking-tight">Your Learning Space</h2>
                 <p className="text-slate-500 dark:text-white/40">Access your active examinations and track classroom performance.</p>
              </div>

          {/* Tests Section */}
          {activeTests.length > 0 && (
            <section className="space-y-8">
              <div className="flex items-end justify-between border-b border-black/5 dark:border-white/5 pb-4">
                 <div className="space-y-1">
                   <h3 className="text-2xl font-light tracking-tighter">Assigned Examinations</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Neural authentication active for these sessions</p>
                 </div>
                 <div className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] animate-pulse">Live Tracking Enabled</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {activeTests.map(test => {
                    const now = new Date();
                    const startTime = test.start_time ? new Date(test.start_time) : null;
                    const endTime = test.end_time ? new Date(test.end_time) : null;
                    
                    let status: 'upcoming' | 'live' | 'closed' = 'live';
                    if (startTime && now < startTime) status = 'upcoming';
                    else if (endTime && now > endTime) status = 'closed';

                    const isLive = status === 'live';

                    return (
                      <motion.div 
                        key={test.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -5 }}
                        className={cn(
                          "group p-8 rounded-[40px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 transition-all relative overflow-hidden shadow-sm hover:shadow-2xl",
                          !isLive && "opacity-60 grayscale-[0.5]"
                        )}
                      >
                         <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <BrainCircuit size={80} className="text-indigo-600" />
                         </div>
                         <div className="space-y-8 relative z-10 text-left">
                            <div className="flex justify-between items-start">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center overflow-hidden">
                                  {test.test_data.settings.logoUrl ? (
                                    <img src={test.test_data.settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                  ) : (
                                    <span className="text-xl">{test.test_data.settings.institutionIcon || <FileText size={24} />}</span>
                                  )}
                               </div>
                               <div className="flex flex-col items-end gap-2">
                                 <span className="text-[9px] font-black tracking-[0.2em] uppercase px-3 py-1.5 bg-slate-100 dark:bg-white/10 rounded-xl border border-black/5 dark:border-white/5">{test.classrooms?.name}</span>
                                 <span className={cn(
                                   "text-[8px] font-black tracking-[0.1em] uppercase px-2 py-1 rounded-md",
                                   status === 'live' ? "bg-emerald-500/10 text-emerald-500" : 
                                   status === 'upcoming' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                                 )}>
                                   {status}
                                 </span>
                               </div>
                            </div>
                            <div>
                               <h4 className="text-2xl font-bold mb-2 tracking-tight">{test.title}</h4>
                               <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2 text-slate-400">
                                     <Clock size={14} className="text-indigo-400" />
                                     <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{test.test_data.settings.duration} MINUTES</span>
                                  </div>
                                  {(startTime || endTime) && (
                                    <div className="text-[9px] text-slate-400 font-medium">
                                      {startTime && <div>Starts: {startTime.toLocaleString()}</div>}
                                      {endTime && <div>Ends: {endTime.toLocaleString()}</div>}
                                    </div>
                                  )}
                               </div>
                            </div>
                            <button 
                              disabled={!isLive || isStartingTest}
                              onClick={() => handleStartTest(test)}
                              className={cn(
                                "w-full py-5 text-white rounded-[24px] font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl transition-all flex items-center justify-center gap-3",
                                isLive ? "bg-indigo-600 shadow-indigo-500/20 hover:scale-[1.02] active:scale-95" : "bg-slate-300 dark:bg-white/10 cursor-not-allowed shadow-none"
                              )}
                            >
                               <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                                  <Play size={10} fill="currentColor" />
                               </div>
                               {isStartingTest ? 'Initializing...' : status === 'upcoming' ? 'Not Started' : status === 'closed' ? 'Exam Ended' : 'Begin Attempt'}
                            </button>
                         </div>
                      </motion.div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Classrooms Section */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-black/5 dark:border-white/5 pb-4">
               <div className="space-y-1 text-left">
                 <h3 className="text-2xl font-light tracking-tighter">Enrolled Classrooms</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Your academic environment</p>
               </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : enrolledClasses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {enrolledClasses.map((enrollment) => (
                  <motion.div
                    key={enrollment.id}
                    whileHover={{ y: -5 }}
                    className="p-8 rounded-[40px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 shadow-sm hover:shadow-2xl transition-all group text-left"
                  >
                    <div className="space-y-8">
                      <div className="flex justify-between items-start">
                        <div className="w-14 h-14 rounded-[20px] bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                          <Layout size={28} />
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-500">ACTIVE</div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-2 tracking-tight">{enrollment.classrooms?.name}</h3>
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 w-fit">
                           <Hash size={12} className="text-indigo-400" />
                           <span className="text-[10px] font-bold text-slate-500 dark:text-white/30 uppercase tracking-widest font-mono">{enrollment.classrooms?.code}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                         <button 
                           onClick={() => handleViewClassroomDetails(enrollment, 'details')}
                           className="flex-1 py-4 rounded-[20px] bg-slate-100 dark:bg-white/5 text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                         >
                           Details
                         </button>
                         <button 
                           onClick={() => handleViewClassroomDetails(enrollment, 'attendance')}
                           className="flex-1 py-4 rounded-[20px] bg-slate-900 dark:bg-white text-white dark:text-black text-[9px] font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:opacity-90 transition-opacity"
                         >
                           Attendance
                         </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
            <div className="text-center py-20 bg-white dark:bg-white/5 rounded-[40px] border border-dashed border-slate-200 dark:border-white/10">
               <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-6 text-slate-400">
                  <ClipboardList size={32} />
               </div>
               <h3 className="text-xl font-bold">No classrooms joined</h3>
               <p className="text-slate-400 mt-2">Join a classroom using the code provided by your teacher.</p>
               <button 
                 onClick={() => setJoinModalOpen(true)}
                 className="mt-8 px-10 py-4 bg-blue-600 text-white rounded-full font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20"
               >
                 Join Now
               </button>
            </div>
          )}
          </section>
          </>
          )}
        </div>
      </main>

      {/* Join Classroom Modal */}
      <AnimatePresence>
        {isJoinModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white dark:bg-[#0a0a0a] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="flex h-[600px]">
                {/* Left Side: Step Indicator */}
                <div className="w-1/3 bg-slate-50 dark:bg-white/5 border-r border-black/5 dark:border-white/5 p-10 flex flex-col justify-between">
                   <div className="space-y-12">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white"><UserPlus size={20} /></div>
                         <h3 className="text-lg font-bold">Enroll</h3>
                      </div>
                      <div className="space-y-8">
                         {[
                           { step: 1, label: 'Access Code' },
                           { step: 2, label: 'Personal Details' },
                           { step: 3, label: 'AI Enrollment' }
                         ].map(s => (
                           <div key={s.step} className={cn("flex items-center gap-4 transition-all", joinStep === s.step ? "opacity-100" : "opacity-30")}>
                             <div className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold", joinStep === s.step ? "border-blue-500 text-blue-500 scale-110" : "border-slate-300 dark:border-white/20")}>{s.step}</div>
                             <span className="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                   <button onClick={() => setJoinModalOpen(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-500 flex items-center gap-2">
                     <X size={14} /> Cancel Enrollment
                   </button>
                </div>

                {/* Right Side: Step Content */}
                <div className="flex-1 p-12 flex flex-col justify-center relative">
                   <AnimatePresence mode="wait">
                      {joinStep === 1 && (
                        <motion.div 
                          key="step1"
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-8"
                        >
                          <div className="space-y-4">
                            <h4 className="text-2xl font-bold">Enter Classroom Code</h4>
                            <p className="text-sm text-slate-500 dark:text-white/40">Enter the 6-character code provided by your instructor to begin.</p>
                          </div>
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="X Y Z 1 2 3"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            className="w-full text-center text-4xl font-mono tracking-[0.5em] font-bold border-b-2 border-blue-500/30 focus:border-blue-500 bg-transparent py-4 text-blue-500 outline-none"
                          />
                          <button 
                            onClick={() => joinCode.trim().length > 0 ? setJoinStep(2) : null}
                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20 disabled:opacity-50"
                            disabled={joinCode.trim().length === 0}
                          >
                            Validate Code
                          </button>
                        </motion.div>
                      )}

                      {joinStep === 2 && (
                        <motion.div 
                          key="step2"
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div className="space-y-2">
                            <h4 className="text-2xl font-bold">Your Identity</h4>
                            <p className="text-sm text-slate-500 dark:text-white/40">Confirm your details for the attendance records.</p>
                          </div>
                          <div className="space-y-4">
                             <div className="space-y-1">
                               <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">Full Name</label>
                               <div className="relative">
                                 <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                 <input type="text" value={studentDetails.name} onChange={(e) => setStudentDetails({...studentDetails, name: e.target.value})} className="w-full pl-12 pr-6 py-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none" />
                               </div>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1">
                                 <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">Roll Number</label>
                                 <div className="relative">
                                   <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                   <input type="text" value={studentDetails.rollNumber} onChange={(e) => setStudentDetails({...studentDetails, rollNumber: e.target.value})} className="w-full pl-12 pr-6 py-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none" />
                                 </div>
                               </div>
                               <div className="space-y-1">
                                 <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">Phone</label>
                                 <div className="relative">
                                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                   <input type="text" value={studentDetails.phoneNumber} onChange={(e) => setStudentDetails({...studentDetails, phoneNumber: e.target.value})} className="w-full pl-12 pr-6 py-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none" />
                                 </div>
                               </div>
                             </div>
                             <div className="space-y-1">
                               <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">Email (Autofilled)</label>
                               <div className="relative">
                                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                 <input type="email" readOnly value={studentDetails.email} className="w-full pl-12 pr-6 py-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 opacity-50 outline-none" />
                               </div>
                             </div>
                          </div>
                          <button 
                            onClick={() => setJoinStep(3)}
                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                          >
                            Continue to Bio-Link
                          </button>
                        </motion.div>
                      )}

                      {joinStep === 3 && (
                        <motion.div 
                          key="step3"
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div className="space-y-2 text-center">
                            <h4 className="text-2xl font-bold">Biometric Profile</h4>
                            <p className="text-sm text-slate-500 dark:text-white/40">AI needs 5 facial samples for Proctoring/Attendance.</p>
                          </div>
                          
                          <div className="relative aspect-square w-full max-w-[240px] mx-auto bg-black rounded-3xl overflow-hidden group">
                             {!isCapturing ? (
                               <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/40 cursor-pointer hover:bg-white/5 transition-all" onClick={startCapture}>
                                  <Camera size={48} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">
                                    {studentDetails.faceSamples.length > 0 ? 'Restart AI Mirror' : 'Enable AI Mirror'}
                                  </span>
                               </div>
                             ) : (
                               <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                             )}
                             <canvas ref={canvasRef} className="hidden" />
                             {isCapturing && (
                               <button 
                                 onClick={captureSample} 
                                 className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
                               >
                                  <div className="w-8 h-8 bg-rose-500 rounded-full animate-pulse" />
                               </button>
                             )}
                          </div>

                          <div className="flex justify-center gap-2">
                             {Array.from({ length: 5 }).map((_, i) => (
                               <div key={i} className={cn("w-10 h-14 rounded-lg bg-black/5 border-2 transition-all", studentDetails.faceSamples[i] ? "border-emerald-500 p-0.5 overflow-hidden" : "border-slate-300 dark:border-white/10")}>
                                  {studentDetails.faceSamples[i] ? <img src={studentDetails.faceSamples[i]} className="w-full h-full object-cover rounded" /> : null}
                               </div>
                             ))}
                          </div>

                          <button 
                            onClick={handleJoinClassroom}
                            disabled={studentDetails.faceSamples.length < 5 || isRegistering}
                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 transition-transform"
                          >
                            {isRegistering ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                              </>
                            ) : (
                              'Complete Registration'
                            )}
                          </button>
                        </motion.div>
                      )}
                   </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
