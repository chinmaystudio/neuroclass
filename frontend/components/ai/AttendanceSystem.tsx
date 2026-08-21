import React, { useRef, useState, useEffect } from 'react';
import { Camera, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { CameraService } from '../../services/ml/CameraService';
import { EmailService } from '../../services/ml/EmailService';
import { supabase } from '../../database/supabase';
import { logEvent } from '../../database/analytics';
import { getApiUrl } from '../../config/apiConfig';
import { finalizeAttendanceSession, startAttendanceSession } from '../../services/api/attendance';

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
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [selectedStudentForReg, setSelectedStudentForReg] = useState<string>('');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [registrationSamples, setRegistrationSamples] = useState<Blob[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchStudents();
  }, [classId]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await (supabase.from('students') as any).select('id,name,email,face_registration_status').eq('classroom_id', classId).order('name');
      if (error) throw error;
      setStudents(data || []);
    } catch (e) {
      console.error('Failed to fetch students in attendance:', e);
    }
  };

  const openAttendanceSession = async (): Promise<any | null> => {
    setSessionBusy(true);
    setCameraError(null);
    setSessionNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before opening attendance.');
      const response = await fetch(getApiUrl('/api/attendance/session'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId: classId, title: `${className} attendance`, durationMinutes: 90 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not open an attendance session.');
      await startAttendanceSession(classId, payload.session.id);
      const nextSession = { ...payload.session, pin: payload.pin, challengeToken: payload.challengeToken };
      setActiveSession(nextSession);
      setSessionNotice(`Session PIN: ${payload.pin}. ${payload.warning || 'Session is ready.'}`);
      try {
        await startCamera();
        setSessionNotice(`Session PIN: ${payload.pin}. Camera is ready; click Scan Group to analyze the classroom.`);
      } catch (cameraStartError: any) {
        setCameraError(cameraStartError.message || 'Session opened, but camera access is still required.');
      }
      return nextSession;
    } catch (error: any) {
      setCameraError(error.message || 'Could not open an attendance session.');
      return null;
    } finally {
      setSessionBusy(false);
    }
  };

  const closeAttendanceSession = async () => {
    if (!activeSession) return;
    setSessionBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before closing attendance.');
      await finalizeAttendanceSession(activeSession.id);
      const response = await fetch(getApiUrl('/api/attendance/session'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not close an attendance session.');
      setActiveSession(null);
      setRegistrationSamples([]);
      setSessionNotice(null);
    } catch (error: any) {
      setCameraError(error.message || 'Could not close an attendance session.');
    } finally {
      setSessionBusy(false);
    }
  };

  const recordTeacherAttendance = async (student: any, confidence: number, modeName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !activeSession) throw new Error('Your authenticated teacher session or attendance session is missing.');
    const response = await fetch(getApiUrl('/api/attendance/teacher-mark'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classroomId: classId,
        sessionId: activeSession.id,
        studentId: student.id,
        studentName: student.name,
        confidence,
        mode: modeName,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to record attendance.');
    return payload.attendance;
  };

  const startCamera = async () => {
    if (streamRef.current) return;
    setCameraError(null);
    const stream = await CameraService.startCamera();
    const video = videoRef.current;
    if (!video) {
      CameraService.stopCamera(stream);
      throw new Error('Camera preview is not ready. Please try again.');
    }
    streamRef.current = stream;
    video.srcObject = stream;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      const onMetadata = () => {
        video.removeEventListener('loadedmetadata', onMetadata);
        resolve();
      };
      video.addEventListener('loadedmetadata', onMetadata, { once: true });
      window.setTimeout(resolve, 1500);
    });
    await video.play().catch(() => undefined);
    setIsCameraActive(true);
  };

  const toggleCamera = async () => {
    if (isCameraActive || streamRef.current) {
      CameraService.stopCamera(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraActive(false);
      setSessionNotice(activeSession ? 'Session is open. Activate the camera before scanning.' : null);
      return;
    }

    try {
      await startCamera();
      setSessionNotice(activeSession ? 'Camera is ready. Click Scan Group to analyze the classroom.' : 'Camera is ready. Open an attendance session before scanning.');
    } catch (err: any) {
      setCameraError(err.message || 'Could not access camera.');
    }
  };

  const waitForVideoFrame = async (video: HTMLVideoElement) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) return;
    await new Promise<void>((resolve) => {
      const onReady = () => {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        resolve();
      };
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      window.setTimeout(resolve, 1200);
    });
    if (video.videoWidth < 1 || video.videoHeight < 1) throw new Error('Camera is still warming up. Please wait one second and capture again.');
  };

  const captureFrameBlob = async (video: HTMLVideoElement): Promise<Blob | null> => {
    await waitForVideoFrame(video);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  };

  const processSingle = async () => {
    setIsAnalyzing(true);
    try {
      const sessionForScan = activeSession || await openAttendanceSession();
      if (!sessionForScan) return;
      if (!isCameraActive && !streamRef.current) await startCamera();
      if (!videoRef.current) throw new Error('Camera preview is not ready.');
      const blob = await captureFrameBlob(videoRef.current);
      if (!blob) throw new Error('Could not capture frame');
      
      const { sendAttendanceFrame } = await import('../../services/api/attendance');
      const result = await sendAttendanceFrame(classId, sessionForScan.id, blob);
      
      if (result.results && result.results.length > 0) {
        for (const match of result.results) {
          if (match.status === 'PRESENT' && match.student_id) {
            if (!identified.find(i => i.studentId === match.student_id)) {
              setIdentified(prev => [{ studentId: match.student_id, name: match.name, confidence: match.confidence === 'HIGH' ? 95 : 75 }, ...prev]);
              const student = students.find(s => s.id === match.student_id);
              if (student) {
                logEvent('Attendance', 'Student Identified', student.name);
                await EmailService.sendAttendanceEmail(student.email, student.name, className);
              }
            }
          }
        }
      }
    } catch (error: any) {
      setCameraError(error.message || 'Failed to record attendance via AI service.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const registerFace = async () => {
    setCameraError(null);
    if (!selectedStudentForReg) {
      setCameraError('Select a student before capturing face samples.');
      return;
    }
    setIsAnalyzing(true);
    try {
      if (!isCameraActive && !streamRef.current) await startCamera();
      if (!videoRef.current) throw new Error('Camera preview is not ready.');
      const blob = await captureFrameBlob(videoRef.current);
      if (!blob) throw new Error('Could not capture a camera frame.');

      const nextSamples = [...registrationSamples, blob].slice(-10);
      setRegistrationSamples(nextSamples);
      if (nextSamples.length < 5) {
        setSessionNotice(`Sample ${nextSamples.length}/5 captured. Change your angle slightly and capture another sample.`);
        return;
      }
      setSessionNotice('Uploading five face samples through the secure gateway…');
      const { uploadFaceSamples } = await import('../../services/api/faceRegistration');
      await uploadFaceSamples(selectedStudentForReg, classId, nextSamples);

      setSessionNotice(`Face registered successfully with ${nextSamples.length} samples.`);
      setRegistrationSamples([]);
      await fetchStudents();
    } catch (e: any) {
      console.error('Face registration failed:', e);
      setCameraError(e.message || 'Registration failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const captureAndProcessGroup = async () => {
    setIsAnalyzing(true);
    try {
      const sessionForScan = activeSession || await openAttendanceSession();
      if (!sessionForScan) return;
      if (!isCameraActive && !streamRef.current) await startCamera();
      if (!videoRef.current) throw new Error('Camera preview is not ready.');
      const blob = await captureFrameBlob(videoRef.current);
      if (!blob) throw new Error('Could not capture frame');
      
      const { sendAttendanceFrame } = await import('../../services/api/attendance');
      const result = await sendAttendanceFrame(classId, sessionForScan.id, blob);
      
      if (result.results && result.results.length > 0) {
        for (const match of result.results) {
          if (match.status === 'PRESENT' && match.student_id) {
            if (!identified.find(i => i.studentId === match.student_id)) {
              setIdentified(prev => [{ studentId: match.student_id, name: match.name, confidence: match.confidence === 'HIGH' ? 95 : 75 }, ...prev]);
              const student = students.find(s => s.id === match.student_id);
              if (student) {
                logEvent('Attendance', 'Student Identified', student.name);
                await EmailService.sendAttendanceEmail(student.email, student.name, className);
              }
            }
          }
        }
      }
    } catch (error: any) {
      setCameraError(error.message || 'Failed to record group attendance via AI service.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative z-20 pointer-events-auto grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800">
      <div className="space-y-6">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Teacher authorization</p>
            <p className="text-xs text-slate-500">{activeSession ? `Session open until ${new Date(activeSession.ends_at).toLocaleTimeString()}` : 'Open a session before any attendance can be recorded.'}</p>
          </div>
          {activeSession ? (
            <button onClick={closeAttendanceSession} disabled={sessionBusy} className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">{sessionBusy ? 'Closing…' : 'Close session'}</button>
          ) : (
            <button onClick={openAttendanceSession} disabled={sessionBusy} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">{sessionBusy ? 'Opening…' : 'Open session'}</button>
          )}
        </div>
        <div className="relative z-30 pointer-events-auto flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
          <button 
            type="button"
            onClick={() => setMode('single')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'single' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            One-by-One
          </button>
          <button 
            type="button"
            onClick={() => setMode('group')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'group' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Group Mode
          </button>
          <button 
            type="button"
            onClick={() => setMode('register')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Register Face
          </button>
        </div>

        <div className="relative aspect-video bg-black rounded-[24px] overflow-hidden group">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          
          {!isCameraActive && (
            <div className="absolute inset-0 z-20 pointer-events-auto flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md text-white gap-4 p-6 text-center">
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

          {sessionNotice && !isAnalyzing && (
            <div className="absolute left-4 right-4 bottom-4 z-25 rounded-xl bg-blue-950/85 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-blue-100">
              {sessionNotice}
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 text-white">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Local Neural Engine Active...</p>
              </div>
            </div>
          )}
        </div>

                  <div className="relative z-30 pointer-events-auto flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              {mode === 'register'
                ? (isCameraActive ? 'Registration ready: capture five samples. No attendance session is required.' : 'Next step: activate the camera.')
                : (activeSession ? (isCameraActive ? 'Ready: session and camera are active.' : 'Next step: activate the camera.') : 'Ready to start: click Scan Group to open a session and scan.')}
            </div>
            {cameraError && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-rose-600">{cameraError}</div>}

          {mode === 'register' ? (
            <div className="flex flex-col gap-3">
              <select 
                value={selectedStudentForReg} 
                onChange={(e) => setSelectedStudentForReg(e.target.value)}
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-bold font-sans"
              >
                <option value="">Select Student to Register</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.face_registration_status === 'REGISTERED' ? '(Registered)' : ''}</option>
                ))}
              </select>
              <button 
                type="button"
                disabled={!isCameraActive || !selectedStudentForReg || isAnalyzing}
                onClick={registerFace}
                className="w-full py-4 bg-emerald-600 text-white rounded-[20px] font-bold uppercase tracking-widest text-[10px]"
              >
                {registrationSamples.length < 5 ? `Capture Sample (${registrationSamples.length}/5)` : 'Upload Face Samples'}
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button 
                type="button"
                disabled={isAnalyzing}
                title={activeSession && isCameraActive ? 'Capture a frame and send it to the secure Vercel attendance gateway.' : 'Open a session and activate the camera before scanning.'}
                onClick={mode === 'single' ? processSingle : captureAndProcessGroup}
                className="flex-1 py-4 bg-blue-600 text-white rounded-[20px] font-bold uppercase tracking-widest text-[10px] disabled:cursor-wait disabled:opacity-60"
              >
                {mode === 'single' ? (activeSession ? 'Analyze Individual' : 'Start Session & Analyze') : (activeSession ? 'Scan Group (10-12 Photos recommended)' : 'Start Session & Scan Group')}
              </button>
              <button type="button" onClick={toggleCamera} className="px-6 py-4 bg-rose-500/10 text-rose-500 rounded-[20px]">
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
