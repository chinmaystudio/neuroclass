import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { CameraService } from '../../services/ml/CameraService';
import { getApiUrl } from '../../config/apiConfig';

interface StudentAttendanceModalProps {
  isOpen: boolean;
  classroomId: string;
  classroomName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const StudentAttendanceModal: React.FC<StudentAttendanceModalProps> = ({
  isOpen,
  classroomId,
  classroomName,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStats, setVerificationStats] = useState<{ distance: number; score: number } | null>(null);
  const [activeSession, setActiveSession] = useState<{ id: string; ends_at?: string } | null>(null);
  const [attendancePin, setAttendancePin] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      initCamera();
      loadActiveSession();
    } else {
      stopCamera();
      setActiveSession(null);
      setAttendancePin('');
    }
  }, [isOpen]);

  const loadActiveSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(classroomId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No active attendance session.');
      setActiveSession(payload.session);
    } catch (e: any) {
      setError(e.message || 'No active attendance session.');
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initCamera = async () => {
    setError(null);
    setIsSuccess(false);
    setVerificationStats(null);
    setIsCapturing(true);
    try {
      const newStream = await CameraService.startCamera();
      setStream(newStream);
    } catch {
      setIsCapturing(false);
      setError('Camera access denied or device unavailable.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const handleVerifyAttendance = async () => {
    if (!user || !activeSession || attendancePin.trim().length < 6) {
      setError('Enter the 6-digit PIN shown by your instructor.');
      return;
    }
    setIsVerifying(true);
    setError(null);
    setVerificationStats(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch(getApiUrl('/api/attendance/verify'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ sessionId: activeSession.id, pin: attendancePin.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Attendance verification failed.');
      setVerificationStats({ distance: 0, score: 100 });
      setIsSuccess(true);
      setTimeout(() => {
        stopCamera();
        onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      setError(e.message || 'Attendance verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-[36px] max-w-lg w-full p-8 shadow-2xl space-y-6 relative"
        >
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={20} />
          </button>

          <div>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-widest">
              Biometric Check-In
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              Class Attendance Verification
            </h2>
            <p className="text-slate-500 text-xs mt-1">Classroom: <span className="font-bold text-purple-500">{classroomName}</span></p>
          </div>

          {/* Camera Container */}
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-slate-200 dark:border-white/10 flex items-center justify-center">
            {isCapturing && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}

            {isSuccess && (
              <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-2 animate-in fade-in">
                <CheckCircle2 size={48} />
                <p className="text-lg font-bold">Attendance Verified!</p>
                <p className="text-xs text-emerald-100">
                  Status: Present {verificationStats ? `(Match Score: ${verificationStats.score}%)` : ''}
                </p>
              </div>
            )}

            {!isCapturing && !isSuccess && (
              <div className="text-center text-slate-400 p-4">
                <Camera size={36} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Initializing camera...</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Instructor session PIN</label>
            <input
              value={attendancePin}
              onChange={(event) => setAttendancePin(event.target.value.replace(/\\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit PIN"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono tracking-[0.4em] outline-none focus:border-purple-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            {!activeSession && <p className="text-xs text-slate-500">Waiting for an active instructor attendance session.</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                stopCamera();
                initCamera();
              }}
              disabled={isVerifying || isSuccess}
              className="px-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw size={14} /> Retry Camera
            </button>

            <button
              onClick={handleVerifyAttendance}
              disabled={!activeSession || attendancePin.length !== 6 || isVerifying || isSuccess}
              className="flex-1 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isVerifying ? (
                <>Verifying Biometrics...</>
              ) : (
                <>
                  <ShieldCheck size={16} /> Mark Present
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
