import React, { useRef, useState, useEffect } from 'react';
import { Camera, Users, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LocalMLService } from '../services/ml/LocalMLService';
import { CameraService } from '../services/ml/CameraService';
import { EmailService } from '../services/ml/EmailService';
import { auth as firebaseAuth } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import * as faceapi from '@vladmandic/face-api';
import { logEvent } from '../lib/analytics';

interface AttendanceSystemProps {
  classId: string;
  className: string;
}

export const AttendanceSystem: React.FC<AttendanceSystemProps> = ({ classId, className }) => {
  const [mode, setMode] = useState<'single' | 'group' | 'register'>('single');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [identified, setIdentified] = useState<any[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedStudentForReg, setSelectedStudentForReg] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    LocalMLService.loadModels();
    fetchStudents();
  }, [classId]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await (supabase.from('students') as any).select('*').eq('classroom_id', classId);
      if (error) throw error;
      setStudents(data || []);
    } catch (e) {
      console.error('Failed to fetch students in attendance:', e);
    }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      CameraService.stopCamera(streamRef.current);
      setIsCameraActive(false);
      return;
    }

    try {
      setCameraError(null);
      const stream = await CameraService.startCamera();
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraActive(true);
    } catch (err: any) {
      setCameraError(err.message || "Could not access camera.");
    }
  };

  const processSingle = async () => {
    if (!videoRef.current || !isCameraActive) return;
    setIsAnalyzing(true);
    
    // Convert descriptors from strings back to Float32Array
    const enrolled = students
      .filter(s => s.face_descriptor)
      .map(s => ({
        id: s.id,
        name: s.name,
        descriptor: new Float32Array(JSON.parse(s.face_descriptor) as number[])
      }));

    const match = await LocalMLService.matchFace(videoRef.current, enrolled);
    
    if (match) {
      setIdentified(prev => [match, ...prev]);
      const currentUser = firebaseAuth.currentUser;
      
      const attendanceData: any = {
        student_id: match.studentId,
        classroom_id: classId,
        status: 'Present',
        user_id: currentUser?.uid || currentUser?.email || null,
        created_at: new Date().toISOString()
      };

      let { error } = await (supabase.from('attendance') as any).insert(attendanceData);
      
      const student = students.find(s => s.id === match.studentId);
      if (student) {
        logEvent('Attendance', 'Student Identified', student.name);
        await EmailService.sendAttendanceEmail(student.email, student.name, className);
      }
    }
    setIsAnalyzing(false);
  };

  const registerFace = async () => {
    if (!videoRef.current || !selectedStudentForReg) return;
    setIsAnalyzing(true);
    
    const descriptor = await LocalMLService.getFaceDescriptor(videoRef.current);
    
    if (descriptor) {
      try {
        const { error } = await (supabase.from('students') as any)
          .update({ face_descriptor: JSON.stringify(Array.from(descriptor)) })
          .eq('id', selectedStudentForReg);
        
        if (error) throw error;

        alert("Face registered successfully!");
        fetchStudents();
      } catch (e) {
        console.error('Face registration failed:', e);
        alert("Registration failed. Please try again.");
      }
    } else {
      alert("No face detected. Please look clearly at the camera.");
    }
    setIsAnalyzing(false);
  };

  const captureForGroup = () => {
    // In local mode, we can just process the current frame for faces
    if (!videoRef.current || !isCameraActive) return;
    captureAndProcessGroup();
  };

  const captureAndProcessGroup = async () => {
    if (!videoRef.current) return;
    setIsAnalyzing(true);
    
    const enrolled = students
      .filter(s => s.face_descriptor)
      .map(s => ({
        id: s.id,
        name: s.name,
        descriptor: new Float32Array(JSON.parse(s.face_descriptor) as number[])
      }));

    // Find all faces in the current frame
    const detections = await (faceapi as any).detectAllFaces(videoRef.current, new (faceapi as any).TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    const faceMatcher = new (faceapi as any).FaceMatcher(
      enrolled.map(d => new (faceapi as any).LabeledFaceDescriptors(d.id, [d.descriptor]))
    );

    const matches = detections.map((d: any) => faceMatcher.findBestMatch(d.descriptor));
    
    for (const match of matches) {
      if (match.label !== 'unknown' && match.distance < 0.6) {
        const student = students.find(s => s.id === match.label);
        if (student && !identified.find(i => i.studentId === student.id)) {
          setIdentified(prev => [{ studentId: student.id, name: student.name, confidence: (1 - match.distance) * 100 }, ...prev]);
          
          const currentUser = firebaseAuth.currentUser;
          const attendanceData: any = {
            student_id: student.id,
            classroom_id: classId,
            status: 'Present',
            user_id: currentUser?.uid || currentUser?.email || null,
            created_at: new Date().toISOString()
          };

          let { error } = await (supabase.from('attendance') as any).insert(attendanceData);
          
          if (error) {
             console.error('Failed to log attendance in group scan:', error);
          }

          await EmailService.sendAttendanceEmail(student.email, student.name, className);
        }
      }
    }

    setIsAnalyzing(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800">
      <div className="space-y-6">
        <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
          <button 
            onClick={() => setMode('single')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'single' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            One-by-One
          </button>
          <button 
            onClick={() => setMode('group')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'group' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Group Mode
          </button>
          <button 
            onClick={() => setMode('register')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Register Face
          </button>
        </div>

        <div className="relative aspect-video bg-black rounded-[24px] overflow-hidden group">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          
          {!isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md text-white gap-4 p-6 text-center">
              {cameraError ? (
                <>
                  <AlertCircle size={48} className="text-rose-500 mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Permission Error</p>
                  <button onClick={toggleCamera} className="mt-2 px-6 py-2 bg-white/10 rounded-full text-[8px]">Try Again</button>
                </>
              ) : (
                <>
                  <Camera size={48} className="opacity-20" />
                  <button onClick={toggleCamera} className="px-8 py-3 bg-blue-600 rounded-full text-[10px]">Activate Camera</button>
                </>
              )}
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 text-white">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Local Neural Engine Active...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {mode === 'register' ? (
            <div className="flex flex-col gap-3">
              <select 
                value={selectedStudentForReg} 
                onChange={(e) => setSelectedStudentForReg(e.target.value)}
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold font-sans"
              >
                <option value="">Select Student to Register</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.face_descriptor ? '(Registered)' : ''}</option>
                ))}
              </select>
              <button 
                disabled={!isCameraActive || !selectedStudentForReg || isAnalyzing}
                onClick={registerFace}
                className="w-full py-4 bg-emerald-600 text-white rounded-[20px] font-bold uppercase tracking-widest text-[10px]"
              >
                Capture & Save Biometrics
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button 
                disabled={!isCameraActive || isAnalyzing}
                onClick={mode === 'single' ? processSingle : captureAndProcessGroup}
                className="flex-1 py-4 bg-blue-600 text-white rounded-[20px] font-bold uppercase tracking-widest text-[10px]"
              >
                {mode === 'single' ? 'Analyze Individual' : 'Scan Group (10-12 Photos recommended)'}
              </button>
              <button onClick={toggleCamera} className="px-6 py-4 bg-rose-500/10 text-rose-500 rounded-[20px]">
                <Camera size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/40 rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">Attendance Log</h3>
          <span className="text-[10px] font-bold text-blue-500">{identified.length} Identified</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
          {identified.map((match, i) => (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              key={`${match.studentId}-${i}`}
              className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                  {match.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold">{match.name}</p>
                  <p className="text-[8px] opacity-40 uppercase tracking-widest">Conf: {match.confidence.toFixed(1)}%</p>
                </div>
              </div>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </motion.div>
          ))}
          {identified.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-10 gap-2">
              <Users size={32} />
              <p className="text-[10px] font-bold uppercase tracking-widest">No entries yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
