import React, { useRef, useState, useEffect } from 'react';
import { AlertCircle, Camera, Copy, Download, Loader2, LocateFixed } from '../ui/icons-compat';
import { Avatar, Badge, Button, Card, CardFooter, CardHeader, EmptyState, Field, InfoCard, Input, RadioGroup, Select, TabPanel, Tabs } from '../ui';
import { CameraService } from '../../services/ml/CameraService';
import { supabase } from '../../database/supabase';
import { logEvent } from '../../database/analytics';
import { getApiUrl } from '../../config/apiConfig';
import { getStableBrowserPosition } from '../../services/location/stablePosition';
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
      const position = await getStableBrowserPosition(3);
      const nextLocation = { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy };
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
      const nextSession = { ...payload.session, pin: payload.pin, sessionCode: payload.sessionCode, radiusMeters: payload.radiusMeters, challengeToken: payload.challengeToken, attendanceMode: mode === 'single' ? 'multi_level' : 'manual' };
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

      // Closing the Supabase session is authoritative. Multi-Level sessions do not
      // create a Render manual-scan session, so never let that auxiliary call block
      // the database state transition.
      const response = await fetch(getApiUrl('/api/attendance/session'), {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not close an attendance session.');

      let finalizationWarning = false;
      const usesRenderSession = activeSession.attendanceMode ? activeSession.attendanceMode === 'manual' : mode === 'group';
      if (usesRenderSession) {
        try {
          await Promise.race([
            finalizeAttendanceSession(activeSession.id),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Manual attendance finalization timed out.')), 8000)),
          ]);
        } catch (finalizationError) {
          finalizationWarning = true;
          console.warn('Manual attendance finalization did not complete after the session closed:', finalizationError);
        }
      }

      setActiveSession(null);
      setRegistrationSamples([]);
      setFinalReport(payload.report || null);
      const reportNotice = payload.report ? `Session closed. ${payload.report.presentCount} present out of ${payload.report.rosterCount}. Final report is ready.` : 'Session closed.';
      setSessionNotice(finalizationWarning ? `${reportNotice} Manual scan finalization was unavailable, but the attendance session is closed.` : reportNotice);
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

  const verifiedCount = verificationRows.filter((row) => row.verification_status === 'VERIFIED').length;
  const statusLine = mode === 'register'
    ? (isCameraActive ? 'Choose a student, then capture five samples. No attendance session is needed.' : 'Turn on the camera to register a student’s face.')
    : mode === 'group' && isLiveScanning
      ? 'Live preview is on. Students outlined in green are confirmed present.'
      : activeSession
        ? (mode === 'group' ? (isCameraActive ? 'Capture a photo or start the live preview to mark students present.' : 'Turn on the camera to scan the classroom.') : 'Waiting for students to confirm from their own devices.')
        : 'Start a session to begin taking attendance.';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card as="section" aria-labelledby="att-session">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="att-session" className="text-card text-ink">Attendance session</h2>
              <p className="text-support text-ink-2">{activeSession ? `Open until ${new Date(activeSession.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Students are notified automatically.` : 'Attendance can only be recorded while you have a session open.'}</p>
            </div>
            {activeSession ? (
              <Button variant="outline" loading={sessionBusy} onClick={() => void closeAttendanceSession()}>End session</Button>
            ) : (
              <Button loading={sessionBusy} onClick={() => void openAttendanceSession()}>Start session</Button>
            )}
          </div>

          {activeSession && (
            <>
              <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-control border border-line-2 bg-line-2">
                <div className="bg-surface px-3 py-2"><dt className="text-meta text-ink-2">Verified</dt><dd className="text-body font-semibold tabular-nums text-ink">{verifiedCount} of {students.length}</dd></div>
                <div className="bg-surface px-3 py-2"><dt className="text-meta text-ink-2">Pending</dt><dd className="text-body font-semibold tabular-nums text-ink">{Math.max(0, students.length - verifiedCount)}</dd></div>
                <div className="bg-surface px-3 py-2"><dt className="text-meta text-ink-2">Radius</dt><dd className="text-body font-semibold tabular-nums text-ink">{activeSession.radius_meters || activeSession.radiusMeters || radiusMeters} m</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-support text-ink-2">Session code <span className="font-mono font-semibold text-ink">{activeSession.session_code || activeSession.sessionCode || '—'}</span></p>
                <Button variant="text" size="sm" iconLeft={<Copy size={16} />} onClick={() => void copySessionCode()}>{copiedSessionCode ? 'Copied' : 'Copy code'}</Button>
              </div>
            </>
          )}
        </Card>

        <Tabs
          items={[{ id: 'single', label: 'Student devices' }, { id: 'group', label: 'Classroom camera' }, { id: 'register', label: 'Register faces' }]}
          value={mode}
          onChange={(id) => switchMode(id as 'single' | 'group' | 'register')}
          label="Attendance method"
          idPrefix="attmode"
        />

        <TabPanel tabId={mode} idPrefix="attmode" className="flex flex-col gap-4">
          {mode === 'single' && (
            <Card>
              <CardHeader title="Students confirm on their own devices" subtitle="Each student signs in, is checked against your classroom area, and confirms with Face ID and a liveness check. Your camera isn’t used." />
              {!activeSession && (
                <div className="mt-4 border-t border-line-2 pt-4">
                  <p className="text-body font-medium text-ink">Classroom area</p>
                  <p className="text-support text-ink-2">Your current location sets the centre of the area students must be inside.</p>
                  {teacherLocation ? (
                    <div className="mt-3 flex flex-col gap-4">
                      <p className="text-support text-ink-2">Location set, accurate to about {Math.round(teacherLocation.accuracy)} m. <button type="button" className="focus-ring rounded-control font-medium text-primary hover:underline" disabled={locationState === 'requesting' || sessionBusy} onClick={() => void requestTeacherLocation()}>{locationState === 'requesting' ? 'Updating…' : 'Update location'}</button></p>
                      <RadioGroup
                        inline
                        legend="Radius"
                        name="att-radius"
                        value={String([50, 100, 150, 250].includes(radiusMeters) ? radiusMeters : 'custom')}
                        onChange={(v) => setRadiusMeters(v === 'custom' ? 300 : Number(v))}
                        options={[...[50, 100, 150, 250].map((r) => ({ value: String(r), label: `${r} m` })), { value: 'custom', label: 'Custom' }]}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        {![50, 100, 150, 250].includes(radiusMeters) && (
                          <Field label="Custom radius" hint="Between 25 and 1000 metres.">
                            <Input type="number" min={25} max={1000} value={radiusMeters} onChange={(event) => setRadiusMeters(Math.max(25, Math.min(1000, Number(event.target.value) || 100)))} trailing={<span className="text-support text-ink-2">m</span>} />
                          </Field>
                        )}
                        <Field label="Session length">
                          <Select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                            {[10, 15, 20, 30].map((d) => <option key={d} value={d}>{d} minutes</option>)}
                          </Select>
                        </Field>
                      </div>
                    </div>
                  ) : (
                    <Button className="mt-3" variant="outline" iconLeft={<LocateFixed size={16} />} loading={locationState === 'requesting'} onClick={() => void requestTeacherLocation()}>Use my location</Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {mode !== 'single' && (
            <Card padding="none" className="overflow-hidden">
              <div className="relative aspect-video bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                {!isCameraActive && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                    {cameraError ? (
                      <><AlertCircle size={32} /><p className="text-body">The camera couldn’t be started.</p><Button variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10" onClick={() => void toggleCamera()}>Try again</Button></>
                    ) : (
                      <><Camera size={32} /><p className="text-body">Camera is off</p><Button onClick={() => void toggleCamera()}>Turn on camera</Button></>
                    )}
                  </div>
                )}
                {sessionNotice && !isAnalyzing && <p role="status" className="absolute inset-x-4 bottom-4 z-20 rounded-control bg-black/75 px-3 py-2 text-support text-white">{sessionNotice}</p>}
                {liveBoxes.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 z-20">
                    {liveBoxes.map((box) => {
                      const [x1, y1, x2, y2] = box.bbox;
                      const vw = Math.max(1, videoRef.current?.videoWidth || 1);
                      const vh = Math.max(1, videoRef.current?.videoHeight || 1);
                      return (
                        <div key={box.trackId} className="absolute border-2 border-[#34a853]" style={{ left: `${x1 / vw * 100}%`, top: `${y1 / vh * 100}%`, width: `${Math.max(0, x2 - x1) / vw * 100}%`, height: `${Math.max(0, y2 - y1) / vh * 100}%` }}>
                          <span className="absolute -top-6 left-0 whitespace-nowrap rounded-control bg-[#137333] px-2 py-0.5 text-meta font-medium text-white">{box.name} · {box.confidence.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
                    <Loader2 size={28} /><p className="text-body">Analysing…</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 p-4">
                <p className="text-support text-ink-2" role="status">{statusLine}</p>
                {cameraError && <InfoCard tone="danger">{cameraError}</InfoCard>}
                {mode === 'register' ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label="Student">
                      <Select value={selectedStudentForReg} onChange={(e) => setSelectedStudentForReg(e.target.value)} placeholder="Choose a student">
                        {students.map((st) => <option key={st.id} value={st.id}>{st.name}{st.face_registration_status === 'REGISTERED' ? ' (registered)' : ''}</option>)}
                      </Select>
                    </Field>
                    <Button disabled={!isCameraActive || !selectedStudentForReg || isAnalyzing} onClick={() => void registerFace()}>
                      {registrationSamples.length < 5 ? `Capture sample ${registrationSamples.length + 1} of 5` : 'Save face samples'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!activeSession || !isCameraActive || isAnalyzing} loading={isAnalyzing} onClick={() => void captureAndProcessGroupPhoto()}>Capture and check photo</Button>
                    <Button
                      variant="outline"
                      disabled={sessionBusy || !activeSession || !isCameraActive}
                      onClick={isLiveScanning ? () => stopLiveGroupScan('Live preview paused. Capture a photo when you’re ready.') : () => void startLiveGroupScan()}
                    >
                      {isLiveScanning ? 'Pause live preview' : 'Start live preview'}
                    </Button>
                    {isCameraActive && <Button variant="text" onClick={() => void toggleCamera()}>Turn off camera</Button>}
                  </div>
                )}
              </div>
            </Card>
          )}
          {mode === 'single' && <p className="text-support text-ink-2" role="status">{statusLine}</p>}
        </TabPanel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {finalReport && (
          <Card as="section" aria-labelledby="att-report">
            <CardHeader title={<span id="att-report">Session report</span>} />
            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-control border border-line-2 bg-line-2">
              <div className="bg-surface px-3 py-2"><dt className="text-meta text-ink-2">Present</dt><dd className="text-body font-semibold tabular-nums text-ink">{finalReport.presentCount}</dd></div>
              <div className="bg-surface px-3 py-2"><dt className="text-meta text-ink-2">Absent</dt><dd className="text-body font-semibold tabular-nums text-ink">{finalReport.absentCount}</dd></div>
              <div className="bg-surface px-3 py-2"><dt className="text-meta text-ink-2">Rate</dt><dd className="text-body font-semibold tabular-nums text-ink">{finalReport.attendanceRate}%</dd></div>
            </dl>
            <CardFooter>
              <Button variant="text" onClick={downloadFinalReport}>Download JSON</Button>
              <Button variant="outline" iconLeft={<Download size={16} />} onClick={downloadAttendanceCsv}>Download CSV</Button>
            </CardFooter>
          </Card>
        )}
        <Card as="section" padding="none" aria-labelledby="att-log" className="flex min-h-[320px] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-4">
            <h2 id="att-log" className="text-card text-ink">Present</h2>
            <Badge tone={identified.length ? 'success' : 'neutral'}>{identified.length} confirmed</Badge>
          </div>
          {identified.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-4"><EmptyState compact className="w-full" title="No one confirmed yet" body="Students appear here as they’re verified." /></div>
          ) : (
            <ul className="max-h-[480px] divide-y divide-line-2 overflow-y-auto">
              {identified.map((match, i) => (
                <li key={`${match.studentId}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="flex min-w-0 items-center gap-3"><Avatar name={match.name} size="sm" /><span className="truncate text-body text-ink">{match.name}</span></span>
                  <span className="shrink-0 text-meta tabular-nums text-ink-2">{match.confidence.toFixed(0)}% match</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
