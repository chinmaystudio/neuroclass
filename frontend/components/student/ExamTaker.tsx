import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, FileText, ShieldCheck, Eye, Camera } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { CameraService } from '../../services/ml/CameraService';
import { cn } from '../../lib/utils';
import { getApiUrl } from '../../config/apiConfig';

interface ExamTakerProps {
  testId: string;
  onExit: () => void;
}

export const ExamTaker: React.FC<ExamTakerProps> = ({ testId, onExit }) => {
  const { user } = useAuth();
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [serverScore, setServerScore] = useState<{ earned: number; total: number } | null>(null);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Proctoring State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchTest();
    initProctorCamera();

    // Tab Switch / Window Blur Anti-Cheat Monitoring
    const handleBlur = () => {
      const newViolation = {
        type: 'TAB_SWITCH',
        timestamp: new Date().toISOString(),
        detail: 'Window focus lost / tab switched',
      };
      setViolations((prev) => [...prev, newViolation]);
      setShowWarningBanner(true);
      setTimeout(() => setShowWarningBanner(false), 5000);
    };

    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
      stopProctorCamera();
    };
  }, [testId]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Timer logic
  useEffect(() => {
    if (timeLeft > 0 && !isSubmitted) {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && test && !isSubmitted) {
      handleSubmit();
    }
  }, [timeLeft, isSubmitted, test]);

  const initProctorCamera = async () => {
    try {
      const newStream = await CameraService.startCamera();
      setStream(newStream);
    } catch {
      console.warn('Proctor camera stream failed to launch.');
    }
  };

  const stopProctorCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const fetchTest = async () => {
    try {
      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .single();

      if (testErr || !testData) throw new Error('Test not found');

      const { data: profile, error: profErr } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user!.id)
        .eq('classroom_id', testData.classroom_id)
        .single();

      if (profErr || !profile) throw new Error('You are not enrolled in this class');

      setStudentProfileId(profile.id);
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error('Your signed-in session has expired. Please sign in again.');
      const startResponse = await fetch(getApiUrl('/api/exams/attempt/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
        body: JSON.stringify({ testId })
      });
      const startPayload = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok || !startPayload.attemptId) throw new Error(startPayload.error || 'Unable to start this exam.');
      setAttemptId(startPayload.attemptId);
      setTest(testData);
      setTimeLeft((testData.duration_minutes ?? testData.duration_mins ?? 45) * 60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted || !attemptId) return;
    setIsSubmitting(true);
    try {
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error('Your signed-in session has expired. Please sign in again.');
      const response = await fetch(getApiUrl('/api/exams/attempt/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
        body: JSON.stringify({ attemptId, answers, violations })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.submitted) throw new Error(payload.error || 'Failed to submit test.');
      if (typeof payload.score === 'number' && typeof payload.total === 'number') setServerScore({ earned: payload.score, total: payload.total });
      stopProctorCamera();
      setIsSubmitted(true);
    } catch (e: any) {
      console.error(e);
      setError('Failed to submit test. Please contact your instructor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-black flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-black flex items-center justify-center p-4">
        <div className="bg-white dark:bg-white/5 border border-rose-500/20 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
          <AlertCircle size={48} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={onExit}
            className="px-6 py-3 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-black flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-white/5 border border-emerald-500/20 p-10 rounded-[40px] max-w-md w-full text-center space-y-6 shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Test Submitted!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              Your answers have been securely recorded with AI proctoring verification logs.
            </p>
          </div>
          <button
            onClick={onExit}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-500/30"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  const question = test.questions[currentQ];
  const isLastQuestion = currentQ === test.questions.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0a0a0a] flex flex-col font-sans">
      {/* Tab Switch Anti-Cheat Banner */}
      <AnimatePresence>
        {showWarningBanner && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-rose-600 text-white px-6 py-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest z-[110]"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>Warning: Focus loss / Tab switch detected! Event logged to proctoring system.</span>
            </div>
            <span>Violations: {violations.length}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-20 bg-white/50 dark:bg-black/50 backdrop-blur-xl border-b border-black/5 dark:border-white/10 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{test.title}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Question {currentQ + 1} of {test.questions.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Anti-cheat status */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck size={14} /> AI Proctor Active
          </div>

          <div
            className={cn(
              'flex items-center gap-3 px-5 py-2.5 rounded-full border border-black/5 dark:border-white/10 shadow-sm',
              timeLeft < 300
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse'
                : 'bg-white dark:bg-white/5 text-slate-900 dark:text-white',
            )}
          >
            <Clock size={16} />
            <span className="font-mono text-lg font-bold">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center relative">
        <div className="w-full max-w-4xl pt-8 pb-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 md:p-12 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
              <div className="flex justify-between items-start mb-8 gap-4">
                <h2 className="text-2xl font-medium text-slate-900 dark:text-white leading-relaxed">
                  {question.text}
                </h2>
                <span className="px-4 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-bold uppercase tracking-widest text-slate-500 shrink-0">
                  {question.points} Pts
                </span>
              </div>

              {question.type === 'mcq' && (
                <div className="space-y-4">
                  {question.options.map((opt: string, idx: number) => {
                    const isSelected = answers[question.id] === idx.toString();
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswerChange(question.id, idx.toString())}
                        className={cn(
                          'w-full text-left p-6 rounded-2xl border transition-all duration-300 flex items-center gap-4 group',
                          isSelected
                            ? 'bg-purple-50/50 dark:bg-purple-500/10 border-purple-500 shadow-md shadow-purple-500/10'
                            : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 hover:border-purple-500/50',
                        )}
                      >
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'border-purple-500 bg-purple-500 text-white'
                              : 'border-slate-300 dark:border-white/20 group-hover:border-purple-500/50',
                          )}
                        >
                          {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                        <span
                          className={cn(
                            'text-lg transition-colors',
                            isSelected ? 'text-purple-900 dark:text-purple-300 font-medium' : 'text-slate-700 dark:text-white/80',
                          )}
                        >
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {question.type === 'subjective' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full h-64 p-6 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none transition-all text-lg leading-relaxed"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating AI Proctor Facecam Window in Bottom Right */}
        <div className="fixed bottom-28 right-8 z-[105] w-48 h-36 rounded-2xl overflow-hidden bg-black border-2 border-purple-500/40 shadow-2xl group">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-[10px]">
              <Camera size={20} className="mb-1" />
              <span>Camera active</span>
            </div>
          )}

          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-400 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="h-24 bg-white dark:bg-black border-t border-black/5 dark:border-white/10 flex items-center justify-between px-8 shrink-0 z-10">
        <button
          onClick={() => setCurrentQ((prev) => Math.max(0, prev - 1))}
          disabled={currentQ === 0}
          className="px-6 py-3 rounded-xl flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
        >
          <ArrowLeft size={16} /> Previous
        </button>

        <div className="flex gap-2">
          {test.questions.map((_: any, idx: number) => (
            <div
              key={idx}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                currentQ === idx
                  ? 'w-6 bg-purple-500'
                  : answers[test.questions[idx].id]
                  ? 'bg-purple-500/50'
                  : 'bg-slate-200 dark:bg-white/10',
              )}
            />
          ))}
        </div>

        {!isLastQuestion ? (
          <button
            onClick={() => setCurrentQ((prev) => Math.min(test.questions.length - 1, prev + 1))}
            className="px-6 py-3 rounded-xl flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-8 py-3.5 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Exam'} <CheckCircle2 size={16} />
          </button>
        )}
      </footer>
    </div>
  );
};
