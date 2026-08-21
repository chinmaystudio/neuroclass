import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { CameraService } from '../../services/ml/CameraService';
import { LocalMLService } from '../../services/ml/LocalMLService';

interface StudentAttendanceModalProps {
  isOpen: boolean;
  classroomId: string;
  classroomName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function parseFaceDescriptor(raw: any): number[] | null {
  if (!raw) return null;
  try {
    let arr = raw;
    if (typeof raw === 'string') {
      arr = JSON.parse(raw);
    }
    if (typeof arr === 'string') {
      arr = JSON.parse(arr);
    }
    if (arr && typeof arr === 'object' && !Array.isArray(arr) && 'descriptor' in arr) {
      arr = arr.descriptor;
    }
    if (Array.isArray(arr)) {
      return arr.map(Number);
    }
  } catch (e) {
    console.error('Error parsing face descriptor:', e);
  }
  return null;
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

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      initCamera();
    } else {
      stopCamera();
    }
  }, [isOpen]);

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
    if (!videoRef.current || !user) return;
    setIsVerifying(true);
    setError(null);
    setVerificationStats(null);

    try {
      await LocalMLService.loadModels();
      const currentDescriptor = await LocalMLService.getFaceDescriptor(videoRef.current);
      if (!currentDescriptor) {
        throw new Error('No face detected. Please position your face clearly in the camera frame.');
      }

      // Fetch student profile for this classroom
      const { data: studentProfile, error: profErr } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .eq('classroom_id', classroomId)
        .single();

      if (profErr || !studentProfile) {
        throw new Error('Enrollment profile not found for this class.');
      }

      if (!studentProfile.face_descriptor) {
        throw new Error('No biometric Face ID registered. Please update your profile settings first.');
      }

      // Parse stored descriptor vector
      const registeredVector = parseFaceDescriptor(studentProfile.face_descriptor);
      if (!registeredVector || registeredVector.length !== currentDescriptor.length) {
        throw new Error('Registered Face ID descriptor format is invalid. Please re-scan your Face ID in settings.');
      }

      // Compute Euclidean Distance between normalized Float32 vectors
      let sumSq = 0;
      for (let i = 0; i < currentDescriptor.length; i++) {
        const diff = Number(registeredVector[i]) - currentDescriptor[i];
        sumSq += diff * diff;
      }
      const distance = Math.sqrt(sumSq);
      const matchScore = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));

      setVerificationStats({ distance, score: matchScore });
      console.log(`[Face-ID Check] Distance: ${distance.toFixed(3)}, Match Score: ${matchScore}%`);

      // Strict Biometric Match Threshold: distance < 0.48
      // Face-API standard: <0.45 is strong match, 0.45-0.48 boundary, >=0.48 non-match
      if (distance >= 0.48) {
        throw new Error(`Biometric verification failed (Match Score: ${matchScore}%, Distance: ${distance.toFixed(2)}). Face does not match registered profile.`);
      }

      // Insert Attendance Record into Supabase
      const { error: attErr } = await supabase
        .from('attendance')
        .insert({
          classroom_id: classroomId,
          student_id: String(studentProfile.id),
          student_name: studentProfile.name || user.email?.split('@')[0] || 'Student',
          status: 'Present',
          verified_method: `Face-ID Biometric (Score ${matchScore}%)`,
          verified_at: new Date().toISOString(),
        });

      if (attErr) throw attErr;

      setIsSuccess(true);
      setTimeout(() => {
        stopCamera();
        onSuccess();
        onClose();
      }, 1500);

    } catch (e: any) {
      setError(e.message || 'Face ID verification failed.');
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
              disabled={!isCapturing || isVerifying || isSuccess}
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
