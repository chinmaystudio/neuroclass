import React, { useRef, useState, useEffect } from 'react';
import { Camera, Users, CheckCircle2, AlertCircle, Loader2, MapPin, LocateFixed, Copy, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { CameraService } from '../../services/ml/CameraService';
import { EmailService } from '../../services/ml/EmailService';
import { supabase } from '../../database/supabase';
import { logEvent } from '../../database/analytics';
import { getApiUrl } from '../../config/apiConfig';
import { finalizeAttendanceSession, sendAttendanceFrame, startAttendanceSession } from '../../services/api/attendance';

interface AttendanceSystemProps {
  classId: string;
  className: string;
}

type TeacherLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type LiveAttendanceBox = {
  trackId: string;
  studentId: string | null;
  name: string;
  status: string;
  confidence: number;
  bbox: [number, number, number, number];
};

export const AttendanceSystem: React.FC<AttendanceSystemProps> = ({ classId, className }) => {
  const [mode, setMode] = useState<'single' | 'group' | 'register'>('single');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [identified, setIdentified] = useState<any[]>([]);
  const [finalReport, setFinalReport] = useState<any | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [selectedStudentForReg, setSelectedStudentForReg] = useState<string>('');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [registrationSamples, setRegistrationSamples] = useState<Blob[]>([]);
  const [liveBoxes, setLiveBoxes] = useState<LiveAttendanceBox[]>([]);
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [copiedSessionCode, setCopiedSessionCode] = useState(false);
  const [teacherLocation, setTeacherLocation] = useState<TeacherLocation | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [verificationRows, setVerificationRows] = useState<any[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveScanTimerRef = useRef<number | null>(null);
  const liveScanInFlightRef = useRef(false);
  const liveScanActiveRef = useRef(false);
  const identifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchStudents();
    return () => {
      liveScanActiveRef.current = false;
      if (liveScanTimerRef.current !== null) window.clearTimeout(liveScanTimerRef.current);
      CameraService.stopCamera(streamRef.current);
      streamRef.current = null;
    };
  }, [classId]);

  useEffect(() => {
    if (!activeSession?.id) {
      setVerificationRows([]);
      return;
    }
    let cancelled = false;
    const loadVerificationRows = async () => {
      const { data } = await (supabase.from('attendance_verifications') as any)
        .select('student_id,verification_status,location_status,distance_from_teacher,location_accuracy,overall_confidence')
        .eq('attendance_session_id', activeSession.id);
      if (!cancelled) setVerificationRows(data || []);
    };
    void loadVerificationRows();
    const channel = supabase
      .channel(`teacher-attendance-verifications-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_verifications', filter: `attendance_session_id=eq.${activeSession.id}` }, (payload) => {
        const nextRow: any = payload.new;
        setVerificationRows((previous) => {
          const index = previous.findIndex((row) => row.student_id === nextRow.student_id);
          if (index === -1) return [...previous, nextRow];
          return previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...nextRow } : row);
        });
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await (supabase.from('students') as any).select('id,name,email,face_registration_status').eq('classroom_id', classId).order('name');
      if (error) throw error;
      setStudents(data || []);
    } catch (e) {
      console.error('Failed to fetch students in attendance:', e);
    }
  };

  const requestTeacherLocation = async (): Promise<TeacherLocation | null> => {
    if (!navigator.geolocation) {
      setLocationState('unavailable');
      setCameraError('This device does not provide browser location services.');
      return null;
    }
    setLocationState('requesting');
    setCameraError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      setTeacherLocation(nextLocation);
      setLocationState('granted');
      return nextLocation;
    } catch (error: any) {
      setLocationState(error?.code === 1 ? 'denied' : 'unavailable');
      setCameraError(error?.code === 1 ? 'Location permission is required to establish the attendance zone.' : 'Unable to determine your location. Try again in an open area.');
      return null;
    }
  };

  const openAttendanceSession = async (): Promise<any | null> => {
    setSessionBusy(true);
    setCameraError(null);
    setSessionNotice(null);
    try {
      const teacherPoint = mode === 'single' ? (teacherLocation || await requestTeacherLocation()) : null;
      if (mode === 'single' && !teacherPoint) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before opening attendance.');
      const response = await fetch(getApiUrl('/api/attendance/session'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId: classId,
          title: `${className} attendance`,
          durationMinutes: mode === 'single' ? durationMinutes : 90,
          attendanceMode: mode === 'single' ? 'multi_level' : 'manual',
          teacherLatitude: teacherPoint?.latitude,
          teacherLongitude: teacherPoint?.longitude,
          teacherLocationAccuracy: teacherPoint?.accuracy,
          radiusMeters: mode === 'single' ? radiusMeters : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not open an attendance session.');
      if (mode !== 'single') await startAttendanceSession(classId, payload.session.id);
      const nextSession = { ...payload.session, pin: payload.pin, sessionCode: payload.sessionCode, radiusMeters: payload.radiusMeters, challengeToken: payload.challengeToken };
      identifiedIdsRef.current.clear();
      setIdentified([]);
      setFinalReport(null);
      setActiveSession(nextSession);
      setSessionNotice(`Session PIN: ${payload.pin}. ${payload.warning || 'Session is ready.'}`);
      if (mode === 'single') {
        setSessionNotice(`Multi-Level Attendance is active. Students have been notified and can verify from their own devices. Session code: ${payload.sessionCode}.`);
      } else {
        try {
          await startCamera();
          setSessionNotice(`Session PIN: ${payload.pin}. Camera is ready for Manual Mode.`);
        } catch (cameraStartError: any) {
          setCameraError(cameraStartError.message || 'Session opened, but camera access is still required.');
        }
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
    stopLiveGroupScan('Attendance session closed.');
    setLiveBoxes([]);
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
      setFinalReport(payload.report || null);
      setSessionNotice(payload.report ? `Session closed. ${payload.report.presentCount} present out of ${payload.report.rosterCount}. Final report is ready.` : 'Session closed.');
    } catch (error: any) {
      setCameraError(error.message || 'Could not close an attendance session.');
    } finally {
      setSessionBusy(false);
    }
  };

  const downloadFinalReport = () => {
    if (!finalReport) return;
    const blob = new Blob([JSON.stringify(finalReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `attendance-report-${finalReport.sessionId || 'session'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadAttendanceCsv = () => {
    if (!finalReport) return;
    const escapeCsv = (value: unknown) => {
      const text = value == null ? '' : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const headers = ['Session ID', 'Classroom ID', 'Student ID', 'Student Name', 'Roll Number', 'Email', 'Status', 'Verified Method', 'Verified At', 'Confidence (%)'];
    const rows = (Array.isArray(finalReport.entries) ? finalReport.entries : []).map((entry: any) => [
      finalReport.sessionId,
      finalReport.classroomId,
      entry.studentId,
      entry.studentName,
      entry.rollNumber,
      entry.email,
      entry.status,
      entry.verifiedMethod,
      entry.verifiedAt,
      entry.confidence,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `attendance-${finalReport.sessionId || 'session'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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

  const switchMode = (nextMode: 'single' | 'group' | 'register') => {
    if (nextMode === 'single') {
      liveScanActiveRef.current = false;
      if (liveScanTimerRef.current !== null) window.clearTimeout(liveScanTimerRef.current);
      CameraService.stopCamera(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraActive(false);
      setIsLiveScanning(false);
      setLiveBoxes([]);
      setSessionNotice(activeSession ? 'Multi-Level Attendance is active. Students use the face-ID portal from their own devices.' : null);
    }
    setMode(nextMode);
  };

  const copySessionCode = async () => {
    const code = activeSession?.session_code || activeSession?.sessionCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSessionCode(true);
      window.setTimeout(() => setCopiedSessionCode(false), 1600);
    } catch {
      setCameraError('Unable to copy the session code.');
    }
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
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  };

  const confidenceToPercent = (match: any) => {
    if (typeof match.similarity === 'number') return Math.max(0, Math.min(100, match.similarity * 100));
    if (typeof match.confidence === 'number') return Math.max(0, Math.min(100, match.confidence));
    return match.confidence === 'HIGH' ? 95 : match.confidence === 'MEDIUM' ? 75 : 50;
  };

  const addIdentifiedResults = (results: any[]) => {
    const newlyIdentified: any[] = [];
    for (const match of results) {
      if (match.status !== 'PRESENT' || !match.student_id || identifiedIdsRef.current.has(match.student_id)) continue;
      identifiedIdsRef.current.add(match.student_id);
      const student = students.find((item) => item.id === match.student_id);
      const entry = {
        studentId: match.student_id,
        name: match.name || student?.name || 'Present student',
        confidence: confidenceToPercent(match),
      };
      newlyIdentified.push(entry);
      logEvent('Attendance', 'Student Identified', entry.name);
      if (student?.email) void EmailService.sendAttendanceEmail(student.email, student.name, className).catch((error) => console.warn('Attendance email failed:', error));
    }
    if (newlyIdentified.length) setIdentified((previous) => [...newlyIdentified.reverse(), ...previous]);
  };

  const updateLiveBoxes = (results: any[]) => {
    const boxes = results
      .filter((match) => Array.isArray(match.bbox) && match.bbox.length === 4)
      .map((match) => ({
        trackId: String(match.track_id ?? `${match.student_id ?? 'unknown'}-${match.bbox.join('-')}`),
        studentId: match.student_id || null,
        name: match.name || (match.status === 'PRESENT' ? 'Present student' : 'Review'),
        status: String(match.status || 'UNKNOWN'),
        confidence: confidenceToPercent(match),
        bbox: [Number(match.bbox[0]), Number(match.bbox[1]), Number(match.bbox[2]), Number(match.bbox[3])] as [number, number, number, number],
      }))
      .filter((box) => box.bbox[2] > box.bbox[0] && box.bbox[3] > box.bbox[1]);
    setLiveBoxes(boxes);
  };

  const stopLiveGroupScan = (notice = 'Live group scan stopped.') => {
    liveScanActiveRef.current = false;
    setIsLiveScanning(false);
    if (liveScanTimerRef.current !== null) {
      window.clearTimeout(liveScanTimerRef.current);
      liveScanTimerRef.current = null;
    }
    if (notice) setSessionNotice(notice);
  };

  const runLiveGroupFrame = async (sessionForScan: any) => {
    if (!liveScanActiveRef.current || liveScanInFlightRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    liveScanInFlightRef.current = true;
    try {
      const blob = await captureFrameBlob(video);
      if (!blob) throw new Error('Could not capture a camera frame.');
      const result = await sendAttendanceFrame(classId, sessionForScan.id, blob);
      const results = Array.isArray(result.results) ? result.results : [];
      updateLiveBoxes(results);
      setSessionNotice(results.length ? `${results.length} face result${results.length === 1 ? '' : 's'} detected. Click Capture Photo & Analyze to record presence.` : 'Scanning live… no faces returned in this frame.');
    } catch (error: any) {
      setCameraError(error.message || 'Live group scan failed.');
      stopLiveGroupScan('Live group scan stopped because the frame request failed.');
      return;
    } finally {
      liveScanInFlightRef.current = false;
    }
    if (liveScanActiveRef.current) liveScanTimerRef.current = window.setTimeout(() => void runLiveGroupFrame(sessionForScan), 450);
  };

  const startLiveGroupScan = async () => {
    if (isLiveScanning) return;
    setCameraError(null);
    setLiveBoxes([]);
    const sessionForScan = activeSession || await openAttendanceSession();
    if (!sessionForScan) return;
    try {
      if (!streamRef.current) await startCamera();
      liveScanActiveRef.current = true;
      setIsLiveScanning(true);
      setSessionNotice('Live group scan is running. Move the camera slowly across the classroom.');
      void runLiveGroupFrame(sessionForScan);
    } catch (error: any) {
      setCameraError(error.message || 'Could not start live group scanning.');
    }
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
      
      const result = await sendAttendanceFrame(classId, sessionForScan.id, blob, 'manual');
      
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

  const captureAndProcessGroupPhoto = async () => {
    setIsAnalyzing(true);
    setCameraError(null);
    try {
      const sessionForScan = activeSession || await openAttendanceSession();
      if (!sessionForScan) return;
      if (!isCameraActive && !streamRef.current) await startCamera();
      if (!videoRef.current) throw new Error('Camera preview is not ready.');
      const blob = await captureFrameBlob(videoRef.current);
      if (!blob) throw new Error('Could not capture frame.');

      const result = await sendAttendanceFrame(classId, sessionForScan.id, blob, 'manual');
      const results = Array.isArray(result.results) ? result.results : [];
      updateLiveBoxes(results);
      const confirmed = results.filter((match) => match.status === 'PRESENT' && match.student_id && match.attendance_persisted !== false);
      addIdentifiedResults(confirmed);
      setSessionNotice(`Photo analyzed: ${confirmed.length} student${confirmed.length === 1 ? '' : 's'} recognized and persisted. Click again to capture another photo.`);
    } catch (error: any) {
      setCameraError(error.message || 'Failed to analyze and record the captured photo.');
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
            <p className="text-xs text-slate-500">{activeSession ? `Session open until ${new Date(activeSession.ends_at).toLocaleTimeString()}` : 'Initiate attendance before any attendance can be recorded.'}</p>
          </div>
          {activeSession ? (
            <button onClick={closeAttendanceSession} disabled={sessionBusy} className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">{sessionBusy ? 'Closing…' : 'Close session'}</button>
          ) : (
            <button onClick={openAttendanceSession} disabled={sessionBusy} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">{sessionBusy ? 'Initiating…' : 'Initiate Attendance'}</button>
          )}
        </div>
        <div className="relative z-30 pointer-events-auto flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
          <button 
            type="button"
            onClick={() => switchMode('single')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'single' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Multi-Level Attendance
          </button>
          <button 
            type="button"
            onClick={() => switchMode('group')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'group' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Manual Mode
          </button>
          <button 
            type="button"
            onClick={() => switchMode('register')}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-40'}`}
          >
            Register Face
          </button>
        </div>

        {mode === 'single' && !activeSession && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-slate-700 dark:text-slate-200">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="mt-0.5 shrink-0 text-blue-500" />
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Location Access</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">NeuroClass needs your location to establish the classroom attendance zone. No Wi-Fi, hotspot, BLE, or teacher camera is required.</p>
                {teacherLocation ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/60 p-3 text-[10px] dark:bg-black/10">
                      <div><p className="font-bold uppercase tracking-wide opacity-60">Latitude</p><p className="mt-1 font-mono">{teacherLocation.latitude.toFixed(6)}</p></div>
                      <div><p className="font-bold uppercase tracking-wide opacity-60">Longitude</p><p className="mt-1 font-mono">{teacherLocation.longitude.toFixed(6)}</p></div>
                      <div><p className="font-bold uppercase tracking-wide opacity-60">Accuracy</p><p className="mt-1 font-mono">±{Math.round(teacherLocation.accuracy)} m</p></div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-60">Attendance Radius</p>
                      <div className="grid grid-cols-5 gap-2">
                        {[50, 100, 150, 250].map((radius) => (
                          <button key={radius} type="button" onClick={() => setRadiusMeters(radius)} className={`rounded-lg border px-2 py-2 text-[10px] font-bold ${radiusMeters === radius ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-white/60 dark:border-white/10 dark:bg-white/5'}`}>{radius} m</button>
                        ))}
                        <input type="number" min={25} max={1000} value={![50, 100, 150, 250].includes(radiusMeters) ? radiusMeters : ''} placeholder="Custom" onChange={(event) => setRadiusMeters(Math.max(25, Math.min(1000, Number(event.target.value) || 100)))} className="w-full rounded-lg border border-slate-200 bg-white/60 px-2 py-2 text-center text-[10px] font-bold outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest opacity-60" htmlFor="attendance-duration">Attendance Duration</label>
                      <select id="attendance-duration" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-xs font-bold dark:border-white/10 dark:bg-white/5">
                        {[10, 15, 20, 30].map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => void requestTeacherLocation()} disabled={locationState === 'requesting' || sessionBusy} className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">{locationState === 'requesting' ? 'Updating location…' : 'Adjust location'}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => void requestTeacherLocation()} disabled={locationState === 'requesting'} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50">
                    <LocateFixed size={14} /> {locationState === 'requesting' ? 'Requesting location…' : 'Allow Location'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSession && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-emerald-700 dark:text-emerald-300">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest">AI Multi-Level Attendance</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">Students are notified automatically. Each student must pass authentication, classroom membership, session, geofence, Face ID, and liveness checks.</p>
              </div>
              <MapPin size={18} className="shrink-0" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="rounded-xl border border-emerald-500/20 bg-white/50 px-2 py-2 dark:bg-black/10"><p className="font-bold uppercase tracking-wide opacity-60">Radius</p><p className="mt-1 font-mono text-sm font-black">{activeSession.radius_meters || activeSession.radiusMeters || radiusMeters} m</p></div>
              <div className="rounded-xl border border-emerald-500/20 bg-white/50 px-2 py-2 dark:bg-black/10"><p className="font-bold uppercase tracking-wide opacity-60">Verified</p><p className="mt-1 font-mono text-sm font-black">{verificationRows.filter((row) => row.verification_status === 'VERIFIED').length} / {students.length}</p></div>
              <div className="rounded-xl border border-emerald-500/20 bg-white/50 px-2 py-2 dark:bg-black/10"><p className="font-bold uppercase tracking-wide opacity-60">Pending</p><p className="mt-1 font-mono text-sm font-black">{Math.max(0, students.length - verificationRows.filter((row) => row.verification_status === 'VERIFIED').length)}</p></div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-white/50 px-3 py-2 dark:bg-black/10">
              <div><p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Session code</p><p className="font-mono text-sm font-black tracking-widest">{activeSession.session_code || activeSession.sessionCode || 'Active'}</p></div>
              <button type="button" onClick={copySessionCode} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-white"><Copy size={13} /> {copiedSessionCode ? 'Copied' : 'Copy code'}</button>
            </div>
          </div>
        )}

        {mode === 'single' ? (
          <div className="relative aspect-video rounded-[24px] overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-900 to-blue-950 p-6 text-white">
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Teacher camera disabled</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight">Student Face-ID Portal</h3>
                  <p className="mt-2 max-w-md text-xs leading-5 text-slate-300">Multi-Level Attendance does not scan faces or request location from the teacher device after setup. Students verify themselves from their own devices.</p>
                </div>
                <MapPin size={28} className="shrink-0 text-emerald-300" />
              </div>
              <div className="grid gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-200 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="text-emerald-300">1.</span> Teacher location set</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="text-emerald-300">2.</span> Student popup opens</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="text-emerald-300">3.</span> Complete Face ID</div>
              </div>
            </div>
          </div>
        ) : (
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

            {liveBoxes.length > 0 && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                {liveBoxes.map((box) => {
                  const [x1, y1, x2, y2] = box.bbox;
                  const width = Math.max(0, x2 - x1);
                  const height = Math.max(0, y2 - y1);
                  return (
                    <div
                      key={box.trackId}
                      className="absolute border-2 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]"
                      style={{ left: `${x1 / Math.max(1, videoRef.current?.videoWidth || 1) * 100}%`, top: `${y1 / Math.max(1, videoRef.current?.videoHeight || 1) * 100}%`, width: `${width / Math.max(1, videoRef.current?.videoWidth || 1) * 100}%`, height: `${height / Math.max(1, videoRef.current?.videoHeight || 1) * 100}%` }}
                    >
                      <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-emerald-500 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
                        {box.name} · {box.confidence.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
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
        )}

                  <div className="relative z-30 pointer-events-auto flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
              {mode === 'register'
                ? (isCameraActive ? 'Registration ready: capture five samples. No attendance session is required.' : 'Next step: activate the camera.')
                : mode === 'group' && isLiveScanning
                  ? 'LIVE SCAN ACTIVE: green boxes are confirmed present students.'
                  : (activeSession ? (isCameraActive ? 'Ready: click Start Live Face Preview to continuously analyze the classroom.' : 'Next step: activate the camera.') : 'Ready to start: click Initiate Attendance to open a multi-level session.')}
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
          ) : mode === 'group' ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={!activeSession || !isCameraActive || isAnalyzing}
                  title="Capture one photo, send it to the secure ML service, and mark confirmed present students in the Attendance Log."
                  onClick={captureAndProcessGroupPhoto}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-[20px] font-bold uppercase tracking-widest text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAnalyzing ? 'Analyzing Photo…' : 'Capture Photo & Analyze'}
                </button>
                <button type="button" onClick={toggleCamera} className="px-6 py-4 bg-rose-500/10 text-rose-500 rounded-[20px]">
                  <Camera size={20} />
                </button>
              </div>
              <button
                type="button"
                disabled={sessionBusy || !activeSession || !isCameraActive}
                onClick={isLiveScanning ? () => stopLiveGroupScan('Live face preview paused. Capture a photo when ready.') : startLiveGroupScan}
                className={`w-full py-3 rounded-[18px] font-bold uppercase tracking-widest text-[9px] disabled:cursor-not-allowed disabled:opacity-50 ${isLiveScanning ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}
              >
                {isLiveScanning ? 'Pause Live Face Preview' : 'Start Live Face Preview'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-blue-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Waiting for student verifications</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">The teacher device does not capture faces in Multi-Level Attendance. Students complete Face ID from the student portal.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/40 rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
        {finalReport && (
          <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Final attendance report</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-bold text-emerald-600">{finalReport.presentCount}</p><p className="text-[8px] uppercase tracking-wide opacity-60">Present</p></div>
              <div><p className="text-lg font-bold">{finalReport.absentCount}</p><p className="text-[8px] uppercase tracking-wide opacity-60">Absent</p></div>
              <div><p className="text-lg font-bold">{finalReport.attendanceRate}%</p><p className="text-[8px] uppercase tracking-wide opacity-60">Rate</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={downloadAttendanceCsv} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-white"><Download size={12} /> Download CSV</button>
              <button type="button" onClick={downloadFinalReport} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Download JSON</button>
            </div>
          </div>
        )}
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
