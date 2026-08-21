import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocalMLService } from '../../services/ml/LocalMLService';
import { CameraService } from '../../services/ml/CameraService';
import { 
  Clock, 
  Shield, 
  ShieldAlert, 
  Monitor, 
  X, 
  Maximize, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Camera,
  CameraOff,
  UserCheck,
  EyeOff,
  Eye,
  Terminal
} from 'lucide-react';
import { Test, Question, QuestionType, LayoutModuleType } from '../../types';
import { supabase } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';

interface ExamPortalProps {
  test: Test;
  attemptId: string;
  onExit: () => void;
  isDemo?: boolean;
}

export default function ExamPortal({ test, attemptId, onExit, isDemo = false }: ExamPortalProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(test.settings.duration * 60);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState<{ type: string, time: string }[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverScore, setServerScore] = useState<{ earned: number; total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const getContrastColor = (hex: string) => {
    if (!hex || hex.length < 7) return '#0f172a';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#0f172a' : '#ffffff';
  };

  const getSecondaryColor = (hex: string) => {
    if (!hex || hex.length < 7) return '#64748b';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#475569' : '#cbd5e1';
  };

  const contrastColor = getContrastColor(test.appearance.canvasBg);
  const secondaryColor = getSecondaryColor(test.appearance.canvasBg);
  
  // Camera & AI State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [isModelLoading, setIsModelLoading] = useState(true);
  const detectionIntervalRef = useRef<any>(null);
  
  const [aiStatus, setAiStatus] = useState<{ face: boolean, phone: boolean, lookingAway: boolean, talking: boolean }>({ 
    face: false, 
    phone: false, 
    lookingAway: false,
    talking: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentSection = test.sections[currentSectionIndex];
  const questions = currentSection?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Initialize AI System
  useEffect(() => {
    const initAI = async () => {
      try {
        await LocalMLService.loadModels();
        setIsModelLoading(false);
      } catch (err) {
        console.error("AI Systems failed to initialize:", err);
        setIsModelLoading(false);
      }
    };
    initAI();
  }, []);

  // Timer logic
  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) {
      if (timeLeft <= 0 && !isSubmitted) {
        handleSubmit();
      }
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  // Fullscreen enforcement
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && test.proctoring.enabled) {
        addViolation('Fullscreen Exit');
        setWarning('Warning: Fullscreen is mandatory for this exam. Please return to fullscreen immediately.');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [test.proctoring.enabled]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && test.proctoring.enabled && test.proctoring.tabSwitchDetection) {
        addViolation('Tab Switch Detected');
        setWarning('Security Alert: Tab switching is strictly prohibited. This incident has been logged.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [test.proctoring.enabled, test.proctoring.tabSwitchDetection]);

  // Camera Initialization
  useEffect(() => {
    if ((test.proctoring.enabled || test.proctoring.faceDetection) && !isSubmitted) {
      startCamera();
    }
    return () => stopCamera();
  }, [isSubmitted]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setCameraError(null);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access is required for proctoring. Please enable it in your browser settings.");
      addViolation("Camera Access Denied");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  // Real-time AI Proctoring Engine
  useEffect(() => {
    if (!cameraActive || isSubmitted || isModelLoading) return;

    let incidentBuffer: Record<string, number> = {};
    const GET_THRESHOLD = (type: string) => {
      switch (type) {
        case 'GAZE': return 5;
        case 'TALKING': return 6;
        case 'ABSENCE': return 10;
        case 'OBJECT': return 2;
        case 'MULTI_FACE': return 2;
        default: return 3;
      }
    };
    
    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          const result = await LocalMLService.detectMalpractice(videoRef.current);
          
          setAiStatus({
            face: result.type !== 'ABSENCE',
            phone: result.type === 'OBJECT' && result.reason.includes('PHONE'),
            lookingAway: result.type === 'GAZE',
            talking: result.type === 'TALKING'
          });

          if (result.isMalpractice) {
            incidentBuffer[result.type] = (incidentBuffer[result.type] || 0) + 1;
            
            if (incidentBuffer[result.type] >= GET_THRESHOLD(result.type)) {
               addViolation(`AI Flag: ${result.reason}`);
               setWarning(`Security Alert: ${result.reason}. Please adhere to exam protocols.`);
               incidentBuffer[result.type] = 0; // Reset after logging
            }
          } else {
             // Gradual decay
             Object.keys(incidentBuffer).forEach(k => {
               if (incidentBuffer[k] > 0) incidentBuffer[k]--;
             });
          }
        } catch (e) {
          console.error("AI Inference Error:", e);
        }
      }
    }, 1000); // Higher frequency check enabled by LocalMLService optimizations

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [cameraActive, isSubmitted, isModelLoading, test.proctoring]);

  const addViolation = async (type: string) => {
    const time = new Date().toLocaleTimeString();
    
    let screenshot = '';
    if (videoRef.current && cameraActive) {
      screenshot = CameraService.captureFrame(videoRef.current);
    }

    const newViolation = { 
      type, 
      time, 
      timestamp: new Date().toISOString(),
      screenshot: screenshot ? `data:image/jpeg;base64,${screenshot}` : null
    };
    
    setViolations(prev => [...prev, newViolation]);
    
    if (!isDemo && attemptId) {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session?.access_token) return;
        await fetch(getApiUrl('/api/exams/attempt/violation'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
          body: JSON.stringify({ attemptId, type, screenshot: newViolation.screenshot })
        });
      } catch (err) {
        console.error('Failed to log violation to server:', err);
      }
    }
  };

  const enterFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (optionId: string) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === QuestionType.MultipleSelect) {
      const current = answers[currentQuestion.id] || [];
      const updated = current.includes(optionId) 
        ? current.filter((id: string) => id !== optionId)
        : [...current, optionId];
      setAnswers({ ...answers, [currentQuestion.id]: updated });
    } else {
      setAnswers({ ...answers, [currentQuestion.id]: [optionId] });
    }
  };

  const calculateScore = () => {
    let totalMarks = 0;
    let earnedMarks = 0;

    test.sections.forEach(section => {
      section.questions.forEach(q => {
        totalMarks += q.marks;
        const studentAnswer = answers[q.id];
        
        if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') return;

        if (q.type === QuestionType.SingleChoice || q.type === QuestionType.MultipleSelect || q.type === QuestionType.TrueFalse) {
          const correctOptionIds = q.options.filter(o => o.isCorrect).map(o => o.id);
          
          if (q.type === QuestionType.SingleChoice || q.type === QuestionType.TrueFalse) {
            // studentAnswer is string[] of size 1 (or at least we expect it to be)
            const answerArray = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
            if (answerArray.length > 0 && correctOptionIds.includes(answerArray[0])) {
              earnedMarks += q.marks;
            } else if (answerArray.length > 0) {
              earnedMarks -= q.negativeMarks;
            }
          } else { // MultipleSelect
            // Check if arrays match
            const answerArray = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
            const sortedStudent = [...answerArray].sort();
            const sortedCorrect = [...correctOptionIds].sort();
            if (sortedStudent.length > 0 && JSON.stringify(sortedStudent) === JSON.stringify(sortedCorrect)) {
              earnedMarks += q.marks;
            } else if (sortedStudent.length > 0) {
              earnedMarks -= q.negativeMarks;
            }
          }
        } else if (q.type === QuestionType.ShortAnswer || q.type === QuestionType.FillInBlank) {
          // studentAnswer is a string
          const studentText = String(studentAnswer).trim().toLowerCase();
          const correctAnswers = q.options.map(o => o.text.trim().toLowerCase());
          if (correctAnswers.includes(studentText)) {
            earnedMarks += q.marks;
          } else if (studentText !== '') {
            earnedMarks -= q.negativeMarks;
          }
        }
        // Essay questions still require manual grading
      });
    });

    return { earned: earnedMarks, total: totalMarks };
  };

  const handleExitPortal = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error(err));
    }
    onExit();
  };

  const handleSubmit = async () => {
    if (isDemo || isSubmitting || isSubmitted) {
      if (isDemo) setIsSubmitted(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('Your signed-in session has expired.');
      const response = await fetch(getApiUrl('/api/exams/attempt/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
        body: JSON.stringify({ attemptId, answers, violations })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.submitted) throw new Error(payload.error || 'Unable to submit the exam.');
      if (typeof payload.score === 'number' && typeof payload.total === 'number') setServerScore({ earned: payload.score, total: payload.total });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Failed to submit exam attempt:', err);
      alert('CRITICAL ERROR: Failed to submit your exam to the server. Please check your internet connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    const score = serverScore || { earned: 0, total: 0 };
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-10 text-center font-sans">
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full space-y-8"
        >
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} />
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">Submission Successful</h2>
            
            <div className="py-8 border-y border-slate-100 space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Final Score</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-6xl font-black text-slate-900">{score.earned}</span>
                <span className="text-2xl font-bold text-slate-300">/ {score.total}</span>
              </div>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-2">
                {score.total > 0 ? `${((score.earned / score.total) * 100).toFixed(1)}% Accuracy` : 'Score recorded'}
              </p>
            </div>

            <p className="text-slate-500 font-medium leading-relaxed">
                Your examination has been securely submitted and stored in our neural database.
                {test.settings.showResultImmediately ? " Your score is displayed above." : " Results will be reviewed by your institution."}
            </p>
            
            <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest justify-center">
              <Shield size={16} />
              Session Verified & Securely Stored
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                    <span>Security Status</span>
                    <span className={violations.length > 0 ? "text-rose-500" : "text-emerald-500"}>
                        {violations.length > 0 ? `${violations.length} Critical Events` : "Pristine Integrity"}
                    </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        className={violations.length > 0 ? "h-full bg-rose-500" : "h-full bg-emerald-500"}
                    />
                </div>
            </div>
            <button 
                onClick={handleExitPortal}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 transition-all"
            >
                Return to Dashboard
            </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 z-[200] bg-slate-50 flex flex-col font-sans select-none"
        style={{ fontFamily: test.appearance.fontFamily }}
    >
      {/* Immersive Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 border-r border-slate-100 pr-6 mr-6">
             <img src={test.settings.logoUrl || '/logo.png'} alt="Orynex Logo" className="h-10 w-auto object-contain" />
             <div>
                <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{test.settings.institutionName}</h1>
                <p className="text-sm font-bold text-slate-900 tracking-tight">{test.settings.title}</p>
             </div>
          </div>
          
          {/* Camera Monitor (Mini) */}
          {(test.proctoring.enabled || test.proctoring.faceDetection) && (
             <div className="relative w-24 h-14 bg-black rounded-lg overflow-hidden border-2 border-indigo-500/20 group shadow-lg">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover grayscale brightness-110"
                />
                <canvas ref={canvasRef} className="hidden" width="32" height="24" />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-rose-500/90 text-white">
                    <CameraOff size={16} />
                  </div>
                )}
                 <div className="absolute top-1 right-1 flex flex-col gap-1">
                   <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                   {cameraActive && !isModelLoading && (
                      <>
                        <div className={`w-2 h-2 rounded-full ${aiStatus.face ? 'bg-blue-400' : 'bg-rose-400 animate-ping'}`} />
                        {aiStatus.lookingAway && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Looking Away" />}
                        {aiStatus.talking && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" title="Talking Detected" />}
                        {aiStatus.phone && <div className="w-2 h-2 rounded-full bg-rose-600 animate-bounce" title="Malpractice Detected" />}
                      </>
                   )}
                </div>
                <div className="absolute bottom-1 left-1 flex items-center gap-1">
                   {aiStatus.face && <div className="px-1 bg-blue-500/80 text-[6px] font-black text-white rounded">SECURE</div>}
                   {aiStatus.lookingAway && <div className="px-1 bg-amber-500/80 text-[6px] font-black text-white rounded">GAZE</div>}
                   {aiStatus.talking && <div className="px-1 bg-indigo-500/80 text-[6px] font-black text-white rounded">AUDIO</div>}
                   {aiStatus.phone && <div className="px-1 bg-rose-600/80 text-[6px] font-black text-white rounded">VIOLATION</div>}
                </div>
                <div className="absolute inset-0 bg-transparent group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                   <span className="text-[8px] font-black text-white uppercase tracking-widest">LIVE PROCTOR</span>
                </div>
             </div>
          )}

          {isModelLoading && (test.proctoring.enabled || test.proctoring.faceDetection) && (
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full animate-pulse">
               <div className="w-2 h-2 rounded-full bg-indigo-500" />
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Initializing AI Proctor...</span>
            </div>
          )}

          <div className="hidden lg:flex gap-2">
            {test.sections.map((s, idx) => (
              <button
                key={`section-nav-item-${s.id}`}
                onClick={() => {
                    setCurrentSectionIndex(idx);
                    setCurrentQuestionIndex(0);
                }}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    currentSectionIndex === idx ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 bg-slate-50'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

           <div className="flex items-center gap-8">
              <button 
                  onClick={() => {
                      if (window.confirm("Are you sure you want to finish and submit your exam? You cannot make any more changes after this.")) {
                          handleSubmit();
                      }
                  }}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-100 transition-all flex items-center gap-2"
              >
                  <Shield size={14} /> Submit Final
              </button>

              <div className={`flex items-center gap-3 px-6 py-2.5 rounded-2xl transition-all ${timeLeft < 300 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-900 text-white'}`}>
             <Clock size={20} className={timeLeft < 300 ? 'text-rose-600' : 'text-indigo-400'} />
             <span className="text-2xl font-black font-mono tracking-tighter">{formatTime(timeLeft)}</span>
           </div>
           
           <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                <Shield size={20} />
              </div>
              <div className="hidden md:block">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none">Security</p>
                <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase">Active</p>
              </div>
           </div>
        </div>
      </header>

      {/* Warning Overlay */}
      <AnimatePresence>
        {warning && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[300] w-full max-w-xl px-4"
          >
            <div className="bg-rose-500 text-white p-5 rounded-[32px] shadow-2xl flex items-start gap-4 border-4 border-white/20 backdrop-blur-2xl">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="animate-bounce" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-black uppercase tracking-widest text-[10px] opacity-80 mb-1">Security System Alert</h4>
                <p className="font-bold text-sm leading-relaxed">{warning}</p>
                <div className="mt-4 flex gap-2">
                   <button 
                    onClick={() => setWarning(null)}
                    className="text-[10px] font-black uppercase tracking-widest bg-white text-rose-500 px-4 py-2 rounded-xl hover:bg-white/90 transition-all shadow-lg"
                   >
                    Acknowledge
                   </button>
                   {!isFullscreen && (
                     <button 
                      onClick={enterFullscreen}
                      className="text-[10px] font-black uppercase tracking-widest bg-black/20 text-white px-4 py-2 rounded-xl hover:bg-black/30 transition-all"
                     >
                      Fix Fullscreen
                     </button>
                   )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Body with Layout Engine */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Dynamic Canvas Container */}
        <div 
          className="absolute inset-0 overflow-auto scroll-smooth"
          style={{ backgroundColor: test.appearance.canvasBg }}
        >
            {/* Grid Helper */}
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{ 
                backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }} />

            {/* Static Content Blocks (Instructional Text, Images) mapped from layout */}
            {test.layout.filter(m => m.type !== LayoutModuleType.QuestionBox).map(module => (
                <div 
                    key={`layout-mod-${module.id}`}
                    className="absolute p-4"
                    style={{
                        left: module.position.x,
                        top: module.position.y,
                        width: module.size.width,
                        height: module.size.height,
                        zIndex: 10
                    }}
                >
                    {module.type === LayoutModuleType.Heading && (
                        <h2 
                            style={{ 
                                color: module.style?.textColor || contrastColor,
                                fontSize: module.style?.fontSize,
                                textAlign: module.style?.textAlign
                            }}
                            className="text-3xl font-black tracking-tight"
                        >
                            {module.content}
                        </h2>
                    )}
                    {module.type === LayoutModuleType.Text && (
                        <p 
                            style={{ 
                                color: module.style?.textColor || secondaryColor,
                                fontSize: module.style?.fontSize,
                                textAlign: module.style?.textAlign
                            }}
                            className="text-sm leading-relaxed font-medium"
                        >
                            {module.content}
                        </p>
                    )}
                    {module.type === LayoutModuleType.Image && (
                        <img src={module.url} alt="Reference" className="rounded-2xl shadow-xl w-full h-full object-cover" />
                    )}
                    {module.type === LayoutModuleType.Divider && <div className="h-0.5 bg-slate-200/50 w-full" />}
                    
                    {module.type === LayoutModuleType.Alert && (
                      <div 
                        style={{ 
                          backgroundColor: module.style?.backgroundColor || 'rgb(255 251 235)',
                          borderColor: module.style?.backgroundColor ? 'transparent' : 'rgb(251 191 36 / 0.2)'
                        }}
                        className="flex items-start gap-3 p-3 border rounded-xl h-full overflow-hidden shadow-sm"
                      >
                         <AlertTriangle className="text-amber-600 shrink-0" size={16} />
                         <p 
                           style={{ 
                             color: module.style?.textColor || 'rgb(180 83 9)',
                             fontSize: module.style?.fontSize || '10px',
                             textAlign: module.style?.textAlign
                           }}
                           className="leading-tight font-bold"
                         >
                           {module.content || 'Alert Message'}
                         </p>
                      </div>
                    )}

                    {module.type === LayoutModuleType.Timer && (
                      <div className="w-full h-full flex items-center justify-center gap-3 bg-slate-900 rounded-xl text-white shadow-xl px-4 border border-white/10">
                         <Clock size={16} className="text-indigo-400" />
                         <div className="text-lg font-black font-mono tracking-tighter">{formatTime(timeLeft)}</div>
                      </div>
                    )}

                    {module.type === LayoutModuleType.StatsBox && (
                      <div className="w-full h-full grid grid-cols-2 bg-white border border-slate-200 rounded-xl shadow-sm dark:bg-slate-800 dark:border-slate-700 overflow-hidden">
                         <div className="flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                            <span className="text-lg font-black text-indigo-600">
                              {Object.keys(answers).length}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Done</span>
                         </div>
                         <div className="flex flex-col items-center justify-center">
                            <span className="text-lg font-black text-slate-400">
                              {test.sections.reduce((acc, s) => acc + s.questions.length, 0) - Object.keys(answers).length}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Left</span>
                         </div>
                      </div>
                    )}

                    {module.type === LayoutModuleType.Progress && (
                      <div className="space-y-1 w-full flex flex-col justify-center h-full">
                         <div className="flex justify-between items-center px-1">
                            <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400">Section Progress</span>
                            <span className="text-[8px] font-black text-indigo-600">
                              {Math.round((Object.keys(answers).length / test.sections.reduce((acc, s) => acc + s.questions.length, 0)) * 100)}%
                            </span>
                         </div>
                         <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 rounded-full shadow-sm transition-all duration-500" 
                              style={{ width: `${(Object.keys(answers).length / test.sections.reduce((acc, s) => acc + s.questions.length, 0)) * 100}%` }}
                            />
                         </div>
                      </div>
                    )}

                    {module.type === LayoutModuleType.SectionNav && (
                      <div className="flex gap-2 h-full items-center">
                        {test.sections.map((s, idx) => (
                          <button
                            key={`section-nav-mod-${s.id}`}
                            onClick={() => {
                              setCurrentSectionIndex(idx);
                              setCurrentQuestionIndex(0);
                            }}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm ${
                              currentSectionIndex === idx ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:text-indigo-600'
                            }`}
                          >
                             S{idx + 1}
                          </button>
                        ))}
                      </div>
                    )}

                    {module.type === LayoutModuleType.SystemLog && (
                      <div className="bg-slate-900 rounded-xl p-3 font-mono text-[8px] text-emerald-400 border border-slate-800 h-full overflow-hidden shadow-lg">
                         <div className="opacity-40 mb-1 flex items-center gap-1 border-b border-white/5 pb-1"><Terminal size={10}/> NEURAL ACCESS</div>
                         <div className="truncate">&gt; CID: {attemptId.slice(0, 8)}</div>
                         {violations.length > 0 && <div className="truncate text-rose-400">&gt; WARN: Integrity flags detected</div>}
                         <div className="truncate">&gt; Monitoring...</div>
                      </div>
                    )}

                    {module.type === LayoutModuleType.QuestionSwitcher && (
                      <div className="flex flex-wrap gap-2 p-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 w-full h-full overflow-y-auto custom-scrollbar pointer-events-auto shadow-sm">
                        {questions.map((_, idx) => (
                          <button
                            key={`q-switch-${idx}`}
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all flex items-center justify-center ${
                              currentQuestionIndex === idx 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                                : 'bg-white text-slate-600 hover:bg-white hover:text-indigo-600 border border-slate-100'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
            ))}

            {/* The Active Question Box - Injected into the Designer's QuestionBox location */}
            {test.layout.filter(m => m.type === LayoutModuleType.QuestionBox).map(module => (
                <div 
                    key={`qbox-mod-${module.id}`}
                    className="absolute bg-white rounded-3xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden"
                    style={{
                        left: module.position.x,
                        top: module.position.y,
                        width: module.size.width,
                        height: module.size.height,
                    }}
                >
                    {/* Inner Scrolling Question Area */}
                    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {currentQuestion ? (
                                <motion.div
                                    key={currentQuestion.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-10"
                                >
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600">
                                                Section {currentSectionIndex + 1} &bull; Question {currentQuestionIndex + 1}/{questions.length}
                                            </span>
                                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                                                <ShieldAlert size={12} className="text-slate-400" />
                                                <span className="text-[9px] font-bold text-slate-400">VALUE: {currentQuestion.marks} PTS</span>
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                                            {currentQuestion.title}
                                        </h3>
                                        {currentQuestion.description && (
                                            <p className="text-slate-500 font-medium leading-relaxed">{currentQuestion.description}</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {currentQuestion.options.map((opt) => {
                                            const isSelected = (answers[currentQuestion.id] || []).includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleOptionSelect(opt.id)}
                                                    className={`group w-full flex items-center gap-6 p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${
                                                        isSelected 
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' 
                                                            : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                        isSelected ? 'bg-white/20 border-white/40 text-white' : 'bg-slate-50 border-slate-100 text-slate-300 group-hover:border-indigo-200'
                                                    }`}>
                                                        <span className="text-xs font-black">{String.fromCharCode(65 + currentQuestion.options.indexOf(opt))}</span>
                                                    </div>
                                                    <span className="text-base font-bold flex-1">{opt.text}</span>
                                                    {isSelected && <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-bl-full flex items-center justify-center"><CheckCircle2 size={16} /></div>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {(currentQuestion.type === QuestionType.ShortAnswer || currentQuestion.type === QuestionType.Essay) && (
                                        <textarea
                                            value={answers[currentQuestion.id] || ''}
                                            onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                                            className="w-full h-48 bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all font-medium italic"
                                            placeholder="Neural input required. Type your response here..."
                                        />
                                    )}
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <AlertTriangle className="text-slate-200" size={64} />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest">No questions in this section</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Navigation Bar */}
                    <div className="h-24 bg-slate-50/50 border-t border-slate-100 px-12 flex items-center justify-between shrink-0">
                        <button 
                            disabled={currentQuestionIndex === 0}
                            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                            className="flex items-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[10px] disabled:opacity-30 hover:text-indigo-600 transition-colors"
                        >
                            <ChevronLeft size={16} /> Previous Question
                        </button>

                        <div className="flex gap-2">
                             {questions.map((_, idx) => (
                                <div 
                                    key={`q-indicator-dot-${idx}`} 
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                        currentQuestionIndex === idx ? 'bg-indigo-600 w-6' : 'bg-slate-200'
                                    }`} 
                                />
                             ))}
                        </div>

                        {currentQuestionIndex === questions.length - 1 ? (
                            <button 
                                onClick={handleSubmit}
                                className="px-10 h-12 bg-slate-900 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl hover:bg-black transition-all"
                            >
                                Submit Exam
                            </button>
                        ) : (
                            <button 
                                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                className="px-10 h-12 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                                Next Question <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </main>

      {/* Overlay Warnings */}
      <AnimatePresence>
        {!isFullscreen && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center"
            >
                <div className="w-24 h-24 bg-rose-500/20 text-rose-500 rounded-3xl flex items-center justify-center mb-8 animate-bounce">
                    <Lock size={48} />
                </div>
                <h2 className="text-4xl font-black tracking-tight text-white mb-4 uppercase tracking-[0.1em]">Security Engagement Required</h2>
                <p className="text-slate-400 max-w-lg mb-10 text-lg font-medium leading-relaxed">
                    This examination atmosphere is proctored. You must engage Fullscreen Mode to access the questions. Failure to maintain fullscreen will be logged as an integrity violation.
                </p>
                <button 
                    onClick={enterFullscreen}
                    className="px-12 py-5 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl flex items-center gap-4 hover:scale-105 transition-all"
                >
                    <Maximize size={20} /> Engage Neural Lockdown
                </button>
            </motion.div>
        )}

        {warning && (
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-rose-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-rose-400/50"
            >
                <AlertTriangle size={24} />
                <span className="text-xs font-black uppercase tracking-widest">{warning}</span>
                <button 
                    onClick={() => setWarning(null)}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
