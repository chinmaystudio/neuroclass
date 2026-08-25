import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, MapPin, LocateFixed } from 'lucide-react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { CameraService } from '../../services/ml/CameraService';
import { getApiUrl } from '../../config/apiConfig';
import { getStableBrowserPosition } from '../../services/location/stablePosition';

interface StudentAttendanceModalProps {
  isOpen: boolean;
  classroomId: string;
  classroomName: string;
  onClose: () => void;
  onSuccess: () => void;
  sessionId?: string;
  sessionCode?: string;
  radiusMeters?: number;
}

type LocationStatus =
  | 'LOCATION_VERIFIED'
  | 'LOCATION_UNCERTAIN'
  | 'OUTSIDE_RADIUS'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE';

type LocationCheck = {
  status: LocationStatus;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  distanceMeters?: number | null;
  radiusMeters?: number;
  capturedAt?: number;
};

export const StudentAttendanceModal: React.FC<StudentAttendanceModalProps> = ({
  isOpen,
  classroomId,
  classroomName,
  onClose,
  onSuccess,
  sessionId: initialSessionId,
  sessionCode: initialSessionCode,
  radiusMeters: initialRadiusMeters,
}) => {
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStats, setVerificationStats] = useState<{ distance: number | null; accuracy: number | null; score: number } | null>(null);
  const [faceBox, setFaceBox] = useState<[number, number, number, number] | null>(null);
  const [faceMatchPercent, setFaceMatchPercent] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<{ id: string; ends_at?: string; session_code?: string; radius_meters?: number } | null>(null);
  const [attendancePin, setAttendancePin] = useState('');
  const [locationCheck, setLocationCheck] = useState<LocationCheck | null>(null);
  const [useMultiLevel, setUseMultiLevel] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const locationTapLockRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSessionId) {
        setActiveSession({ id: initialSessionId, session_code: initialSessionCode, radius_meters: initialRadiusMeters });
        setError(null);
      } else {
        void loadActiveSession();
      }
    } else {
      stopCamera();
      setActiveSession(null);
      setAttendancePin('');
      setLocationCheck(null);
      setError(null);
      setVerificationStats(null);
      setFaceBox(null);
      setFaceMatchPercent(null);
      setIsSuccess(false);
      setUseMultiLevel(true);
    }
  }, [isOpen, initialSessionId, initialSessionCode, initialRadiusMeters]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  const loadActiveSession = async () => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(classroomId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.session) throw new Error(payload.error || 'No active attendance session.');
      setActiveSession(payload.session);
    } catch (e: any) {
      setError(e.message || 'No active attendance session.');
    }
  };

  const initCamera = async () => {
    if (stream) return;
    try {
      const newStream = await CameraService.startCamera();
      setStream(newStream);
      setIsCapturing(true);
    } catch {
      setIsCapturing(false);
      setError('Camera access denied or device unavailable.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const waitForVideoReady = async (video: HTMLVideoElement): Promise<boolean> => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) return true;
    void video.play().catch(() => undefined);
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('canplay', finish);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = window.setTimeout(finish, 8000);
      video.addEventListener('loadeddata', finish, { once: true });
      video.addEventListener('canplay', finish, { once: true });
    });
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
  };

  const captureFrameBlob = async (video: HTMLVideoElement): Promise<Blob | null> => {
    if (!(await waitForVideoReady(video))) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  };

  const captureFaceSequence = async (video: HTMLVideoElement): Promise<Blob[]> => {
    const frames: Blob[] = [];
    for (let index = 0; index < 3; index += 1) {
      const frame = await captureFrameBlob(video);
      if (frame) frames.push(frame);
      if (index < 2) await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
    }
    return frames;
  };

  const locationErrorToStatus = (positionError: GeolocationPositionError): LocationStatus => {
    if (positionError.code === 1) return 'LOCATION_PERMISSION_DENIED';
    return 'LOCATION_UNAVAILABLE';
  };

  const locationErrorMessage = (positionError: GeolocationPositionError) => {
    if (positionError.code === 1) return 'Location permission is blocked for this site. Allow location for neuroclass.pages.dev in your mobile browser settings, then reload.';
    if (positionError.code === 2) return 'Your phone has location enabled, but no location fix was returned. Turn on precise location/GPS, move near a window, and try again.';
    if (positionError.code === 3) return 'The location request timed out. Turn on precise location/GPS and try again.';
    return 'Your location could not be determined. Try again with device location enabled.';
  };

  const handleLocationAction = () => {
    if (locationTapLockRef.current || isCheckingLocation || isVerifying || isSuccess) return;
    locationTapLockRef.current = true;
    void requestLocation().finally(() => {
      window.setTimeout(() => { locationTapLockRef.current = false; }, 450);
    });
  };

  const requestLocation = async () => {
    if (!activeSession) {
      setError('No active attendance session was found.');
      return false;
    }
    if (!navigator.geolocation) {
      setLocationCheck({ status: 'LOCATION_UNAVAILABLE', radiusMeters: activeSession.radius_meters });
      setError('This device does not provide browser location services.');
      return false;
    }

    setIsCheckingLocation(true);
    setError(null);
    try {
      const position = await getStableBrowserPosition(3);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before verifying your location.');
      const response = await fetch(getApiUrl('/api/attendance/location'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: activeSession.id,
          studentLatitude: position.latitude,
          studentLongitude: position.longitude,
          locationAccuracy: position.accuracy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      const nextLocation: LocationCheck = {
        status: payload.locationStatus || (response.ok ? 'LOCATION_VERIFIED' : 'LOCATION_UNAVAILABLE'),
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: payload.accuracyMeters ?? position.accuracy,
        distanceMeters: payload.distanceMeters ?? null,
        radiusMeters: payload.radiusMeters ?? activeSession.radius_meters,
        capturedAt: Number.isFinite(position.timestamp) && position.timestamp > 0 ? position.timestamp : Date.now(),
      };
      setLocationCheck(nextLocation);
      if (!response.ok || nextLocation.status !== 'LOCATION_VERIFIED') {
        throw new Error(payload.error || (nextLocation.status === 'OUTSIDE_RADIUS' ? 'You are outside the attendance zone.' : nextLocation.status === 'LOCATION_UNCERTAIN' ? 'Your location is too uncertain to verify automatically.' : 'Your location could not be verified.'));
      }
      await initCamera();
      return true;
    } catch (e: any) {
      if (e?.code) {
        const status = locationErrorToStatus(e as GeolocationPositionError);
        setLocationCheck({ status, radiusMeters: activeSession.radius_meters });
        setError(locationErrorMessage(e as GeolocationPositionError));
      } else {
        setError(e.message || 'Location verification failed.');
      }
      return false;
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const handleVerifyAttendance = async () => {
    if (!user || !activeSession) {
      setError('Session unavailable.');
      return;
    }

    const locationIsStale = !locationCheck?.capturedAt || Date.now() - locationCheck.capturedAt > 30_000;
    if (useMultiLevel && (locationCheck?.status !== 'LOCATION_VERIFIED' || locationIsStale)) {
      await requestLocation();
      return;
    }
    if (!useMultiLevel && attendancePin.trim().length !== 6) {
      setError('Enter the 6-digit PIN shown by your instructor.');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationStats(null);
    setFaceBox(null);
    setFaceMatchPercent(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');

      let response: Response;
      if (useMultiLevel) {
        if (!videoRef.current || !isCapturing || !locationCheck) throw new Error('Complete location verification before opening Face ID.');
        const frames = await captureFaceSequence(videoRef.current);
        if (frames.length < 1) throw new Error('The mobile camera did not provide a frame. Keep the Face ID view open, keep your face visible, and try again.');
        const form = new FormData();
        form.append('sessionId', activeSession.id);
        form.append('studentLatitude', String(locationCheck.latitude));
        form.append('studentLongitude', String(locationCheck.longitude));
        form.append('locationAccuracy', String(locationCheck.accuracyMeters ?? 0));
        frames.forEach((frame, index) => form.append('file', frame, `student-face-${index + 1}.jpg`));
        response = await fetch(getApiUrl('/api/attendance/student-face'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: form,
        });
      } else {
        response = await fetch(getApiUrl('/api/attendance/verify'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({ sessionId: activeSession.id, pin: attendancePin.trim() }),
        });
      }

      const payload = await response.json().catch(() => ({}));
      const returnedFaceBox = Array.isArray(payload.faceBox) && payload.faceBox.length === 4
        ? payload.faceBox.map((value: unknown) => Number(value)) as [number, number, number, number]
        : null;
      setFaceBox(returnedFaceBox);
      const returnedMatchPercent = Number(payload.matchPercent ?? payload.stats?.matchPercent ?? payload.stats?.faceMatchScore);
      setFaceMatchPercent(Number.isFinite(returnedMatchPercent) ? Math.max(0, Math.min(100, returnedMatchPercent)) : null);
      if (!response.ok) {
        if (payload.locationStatus) {
          setLocationCheck((previous) => ({
            ...(previous || {}),
            status: payload.locationStatus,
            distanceMeters: payload.distanceMeters ?? previous?.distanceMeters,
            accuracyMeters: payload.accuracyMeters ?? previous?.accuracyMeters,
            radiusMeters: payload.radiusMeters ?? previous?.radiusMeters,
          }));
        }
        throw new Error(payload.error || 'Attendance verification failed.');
      }
      setVerificationStats({
        distance: payload.stats?.distanceMeters ?? locationCheck?.distanceMeters ?? null,
        accuracy: payload.stats?.accuracyMeters ?? locationCheck?.accuracyMeters ?? null,
        score: payload.stats?.faceMatchScore ?? payload.stats?.matchPercent ?? 0,
      });
      setIsSuccess(true);
      window.setTimeout(() => {
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

  const formatMeters = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value)} m`;
  const locationVerified = locationCheck?.status === 'LOCATION_VERIFIED';
  const locationMessage = locationCheck?.status === 'OUTSIDE_RADIUS'
    ? 'You are outside the attendance zone. Move closer to the classroom and recheck your location.'
    : locationCheck?.status === 'LOCATION_UNCERTAIN'
      ? 'Your location overlaps the zone boundary. Move to a clearer location and recheck.'
      : locationCheck?.status === 'LOCATION_PERMISSION_DENIED'
        ? 'Allow location permission in your browser settings to continue.'
        : locationCheck?.status === 'LOCATION_UNAVAILABLE'
          ? 'Location is unavailable. Try again with device location enabled.'
          : null;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-[36px] max-w-lg w-full p-8 shadow-2xl space-y-6 relative max-h-[calc(100vh-2rem)] overflow-y-auto"
        >
          <button onClick={() => { stopCamera(); onClose(); }} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X size={20} />
          </button>

          <div>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-widest">NeuroClass</span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-3">Multi-Level Attendance</h2>
            <p className="text-slate-500 text-xs mt-1">Classroom: <span className="font-bold text-purple-500">{classroomName}</span></p>
            {activeSession?.session_code && <p className="text-slate-400 text-[10px] mt-2 font-mono uppercase tracking-widest">Session: {activeSession.session_code}</p>}
          </div>

          <div className="rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/70 dark:bg-purple-500/5 px-4 py-3 text-xs text-purple-800 dark:text-purple-200">
            <p className="font-bold uppercase tracking-widest">Step {locationVerified ? '2' : '1'} of 3</p>
            <p className="mt-1">{locationVerified ? 'Location verified. Hold your face in view while the camera captures your face match.' : 'Checking your location before Face ID.'}</p>
          </div>

          <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-slate-200 dark:border-white/10 flex items-center justify-center">
            {isCapturing && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />}
            {faceBox && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div
                  className="absolute border-4 border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]"
                  style={{
                    left: `${100 - (faceBox[2] / Math.max(1, videoRef.current?.videoWidth || 1)) * 100}%`,
                    top: `${(faceBox[1] / Math.max(1, videoRef.current?.videoHeight || 1)) * 100}%`,
                    width: `${((faceBox[2] - faceBox[0]) / Math.max(1, videoRef.current?.videoWidth || 1)) * 100}%`,
                    height: `${((faceBox[3] - faceBox[1]) / Math.max(1, videoRef.current?.videoHeight || 1)) * 100}%`,
                  }}
                >
                  <span className="absolute -top-8 left-0 whitespace-nowrap rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                    Face detected{faceMatchPercent !== null ? ` · ${faceMatchPercent.toFixed(0)}% match` : ''}
                  </span>
                </div>
              </div>
            )}
            {isSuccess && (
              <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-2">
                <CheckCircle2 size={48} />
                <p className="text-lg font-bold">Attendance Verified!</p>
                <p className="text-xs text-emerald-100">Present · Face match and location confirmed</p>
              </div>
            )}
            {!isCapturing && !isSuccess && (
              <div className="text-center text-slate-400 p-4">
                <MapPin size={36} className="mx-auto mb-2 opacity-60" />
                <p className="text-xs">Allow location before the camera opens.</p>
              </div>
            )}
            {isVerifying && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-3">
                <RefreshCw size={28} className="animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Verifying Face Match…</p>
              </div>
            )}
          </div>

          {faceMatchPercent !== null && !isSuccess && (
            <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 px-4 py-3 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300">
              Face match detected: {faceMatchPercent.toFixed(0)}%. Keep your face centered while the server verifies your identity.
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {useMultiLevel ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Location Verification</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div><p className="font-bold text-slate-500">Teacher zone</p><p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">{formatMeters(locationCheck?.radiusMeters ?? activeSession?.radius_meters)}</p></div>
                  <div><p className="font-bold text-slate-500">Your distance</p><p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">{formatMeters(locationCheck?.distanceMeters)}</p></div>
                  <div><p className="font-bold text-slate-500">Accuracy</p><p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">{formatMeters(locationCheck?.accuracyMeters)}</p></div>
                </div>
                <div className={`mt-4 rounded-xl px-3 py-3 text-xs font-bold flex items-center gap-2 ${locationVerified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                  {locationVerified ? <CheckCircle2 size={16} /> : <LocateFixed size={16} />}
                  {locationVerified ? 'WITHIN ATTENDANCE ZONE' : locationCheck ? locationCheck.status.replaceAll('_', ' ') : 'LOCATION CHECK REQUIRED'}
                </div>
                {locationMessage && <p className="mt-3 text-xs leading-5 text-rose-500">{locationMessage}</p>}
              </div>
              <button
                type="button"
                onPointerUp={handleLocationAction}
                onClick={handleLocationAction}
                disabled={isCheckingLocation || isVerifying || isSuccess}
                aria-label={locationVerified ? 'Recheck location' : 'Allow location'}
                className="relative z-50 pointer-events-auto min-h-[48px] w-full touch-manipulation select-none rounded-2xl bg-purple-600 py-3.5 text-white font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isCheckingLocation ? <><RefreshCw size={15} className="animate-spin" /> Checking Location…</> : locationVerified ? <><RefreshCw size={15} /> Recheck Location</> : <><LocateFixed size={15} /> Allow Location</>}
              </button>
              <p className="text-[10px] leading-4 text-slate-400">Your exact teacher coordinates are never shown. The server compares your location with the protected classroom zone.</p>
              <button type="button" onClick={() => { stopCamera(); setUseMultiLevel(false); }} className="text-purple-500 hover:text-purple-600 text-xs font-semibold">Use Manual PIN instead</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Instructor session PIN</label>
                <button type="button" onClick={() => setUseMultiLevel(true)} className="text-xs text-purple-500 hover:text-purple-600 font-semibold">Use Multi-Level Attendance</button>
              </div>
              <input value={attendancePin} onChange={(event) => setAttendancePin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Enter 6-digit PIN" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono tracking-[0.4em] outline-none focus:border-purple-500 dark:border-white/10 dark:bg-white/5 dark:text-white" />
            </div>
          )}

          <div className="flex gap-3">
            {!useMultiLevel && <button onClick={() => { stopCamera(); setUseMultiLevel(true); }} disabled={isVerifying || isSuccess} className="px-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-widest">Back</button>}
            <button onClick={() => void handleVerifyAttendance()} disabled={!activeSession || isCheckingLocation || (useMultiLevel && !locationVerified) || (!useMultiLevel && attendancePin.length !== 6) || isVerifying || isSuccess} className="flex-1 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {isVerifying ? 'Verifying…' : <><ShieldCheck size={16} /> {useMultiLevel ? 'Verify Face ID' : 'Mark Present'}</>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
