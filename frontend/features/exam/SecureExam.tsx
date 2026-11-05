import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Expand, Flag, Loader2, LogOut, Send, ShieldCheck, Wifi, WifiOff, XCircle } from '../../components/ui/icons-compat';
import { api, ApiRequestError } from '../lms/api';
import type { AttemptState } from '../lms/types';
import { Button, ErrorNote } from '../lms/ui';
import { useExamProctoring } from './useExamProctoring';
import { LIVENESS_MESSAGES, runLivenessCheck, type LivenessProgress, type LivenessResult } from './liveness';
import { useAnswerQueue } from './useAnswerQueue';
import { QuestionView } from './QuestionView';
import { cn } from '../../lib/utils';

/**
 * Full-screen examination environment.
 *
 * Flow: instructions → monitoring consent → camera → identity verification →
 * full screen → server starts the timer → exam → submit.
 * The browser never decides time, marks or eligibility: the server does.
 */
type Phase = 'loading' | 'instructions' | 'setup' | 'exam' | 'submitting' | 'done' | 'error';
type Props = { testId: string; onExit: () => void };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const SecureExam: React.FC<Props> = ({ testId, onExit }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [state, setState] = useState<AttemptState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [identity, setIdentity] = useState<{ status: 'idle' | 'checking' | 'ok' | 'failed'; message?: string; canProceed?: boolean }>({ status: 'idle' });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { response: unknown; markedForReview: boolean }>>({});
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [reverify, setReverify] = useState(false);
  const [liveness, setLiveness] = useState<LivenessProgress | null>(null);
  const [result, setResult] = useState<any>(null);
  const submittingRef = useRef(false);

  const attemptId = state?.attempt.id ?? null;
  const security = state?.test.security;
  const needsCamera = Boolean(security?.requireCamera || security?.liveProctoring || security?.requireIdentityVerification);

  const proctor = useExamProctoring({
    attemptId: attemptId ?? 'pending',
    security: security ?? ({ thresholds: { lookAwaySeconds: 4, headYawDegrees: 35, headPitchDegrees: 25, faceAbsentSeconds: 5, multiFaceSeconds: 2, cooldownSeconds: 20 } } as any),
    enabled: Boolean(attemptId) && (phase === 'exam' || phase === 'setup'),
    phase: phase === 'exam' ? 'exam' : 'calibrate',
    onReverify: () => setReverify(true),
  });

  const finishedRef = useRef(false);
  const onTimeUp = useCallback(() => { if (!finishedRef.current) void submit('timeout'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = useAnswerQueue(attemptId, useMemo(() => Object.fromEntries(Object.entries(state?.answers ?? {}).map(([k, v]) => [k, v.revision])), [state?.attempt.id]), onTimeUp); // eslint-disable-line react-hooks/exhaustive-deps

  const applyState = useCallback((s: AttemptState) => {
    setState(s);
    setOffset(new Date(s.serverTime).getTime() - Date.now());
    if (['submitted', 'auto_submitted', 'evaluated', 'flagged'].includes(s.attempt.status)) { finishedRef.current = true; setPhase('done'); return; }
    if (s.attempt.status === 'in_progress') {
      setPhase('exam');
      const merged: Record<string, { response: unknown; markedForReview: boolean }> = {};
      for (const q of s.questions) {
        const server = s.answers[q.id];
        merged[q.id] = { response: server?.response ?? null, markedForReview: server?.markedForReview ?? false };
      }
      setAnswers((prev) => ({ ...merged, ...prev }));
    } else {
      setPhase((p) => (p === 'loading' ? 'instructions' : p));
      setConsent(Boolean(s.attempt.consentAt));
      if (s.attempt.identityStatus === 'verified') setIdentity({ status: 'ok', message: 'Identity verified.' });
    }
  }, []);

  /* ---------------------------- Start / resume ---------------------------- */
  useEffect(() => {
    let cancelled = false;
    api.post<AttemptState>(`tests/${testId}/attempts`).then((s) => { if (!cancelled) applyState(s); }).catch((err: Error) => { if (!cancelled) { setError(err.message); setPhase('error'); } });
    return () => { cancelled = true; };
  }, [applyState, testId]);

  // Locally queued (unsent) answers win over the server copy after a refresh.
  useEffect(() => {
    if (phase !== 'exam' || !state) return;
    setAnswers((prev) => {
      const next = { ...prev };
      for (const q of state.questions) { const local = queue.localValue(q.id); if (local) next[q.id] = { response: local.response, markedForReview: local.markedForReview }; }
      return next;
    });
    void queue.flush();
  }, [phase, state?.attempt.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------- Clock / heartbeat ---------------------------- */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const expiresAt = state?.attempt.expiresAt ? new Date(state.attempt.expiresAt).getTime() : null;
  const remaining = expiresAt ? expiresAt - (now + offset) : null;

  useEffect(() => {
    if (phase === 'exam' && remaining !== null && remaining <= 0 && !finishedRef.current) void submit('timeout');
  }, [phase, remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!attemptId || (phase !== 'exam' && phase !== 'setup')) return;
    const beat = async () => {
      try {
        const res = await api.post<{ status: string; serverTime: string; expiresAt: string | null; identityStatus: string }>(`attempts/${attemptId}/heartbeat`, { cameraStatus: needsCamera ? (proctor.cameraStatus === 'active' ? 'active' : proctor.cameraStatus === 'blocked' ? 'blocked' : 'off') : 'not_required', fullscreen: Boolean(document.fullscreenElement), visible: !document.hidden });
        setOffset(new Date(res.serverTime).getTime() - Date.now());
        if (['auto_submitted', 'submitted', 'evaluated'].includes(res.status)) { finishedRef.current = true; queue.clear(); setPhase('done'); }
      } catch { /* offline: the local timer keeps running from the server deadline */ }
    };
    void beat();
    const t = window.setInterval(beat, 20_000);
    return () => window.clearInterval(t);
  }, [attemptId, phase, needsCamera, proctor.cameraStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------- Browser signals ---------------------------- */
  useEffect(() => {
    if (phase !== 'exam' || !security) return;
    const onVisibility = () => { if (document.hidden && security.tabSwitchDetection) proctor.record({ type: 'tab_hidden' }); };
    const onBlur = () => { if (!document.hidden && security.tabSwitchDetection) proctor.record({ type: 'window_blur' }, false); };
    const onFs = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs && security.requireFullscreen) proctor.record({ type: 'fullscreen_exit' });
    };
    const onOnline = () => { setOnline(true); proctor.record({ type: 'network_online' }, false); };
    const onOffline = () => { setOnline(false); proctor.record({ type: 'network_offline' }, false); };
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [phase, security, proctor.record]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the camera running across the setup → exam transition and after reconnects.
  useEffect(() => {
    if ((phase === 'setup' || phase === 'exam') && needsCamera && proctor.cameraStatus === 'off') void proctor.startCamera();
  }, [phase, needsCamera, proctor.cameraStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------- Actions ---------------------------- */
  const acceptConsent = async () => {
    if (!attemptId) return;
    try {
      if (needsCamera) await api.post(`attempts/${attemptId}/consent`);
      setPhase('setup');
    } catch (err) { setError((err as Error).message); }
  };

  const verifyIdentity = async () => {
    if (!attemptId) return;
    let report: LivenessResult | null = null;
    if (security?.livenessCheck !== false) {
      const video = proctor.videoRef.current;
      if (!video) { setIdentity({ status: 'failed', message: 'The camera is not ready yet. Wait a second and try again.' }); return; }
      setIdentity({ status: 'checking', message: 'Liveness check: follow the prompts on the camera preview.' });
      setLiveness({ step: 'turn', turnedA: false, turnedB: false, blinked: false, faces: 0 });
      report = await runLivenessCheck(video, setLiveness);
      setLiveness(null);
      if (!report.passed && report.reason !== 'unavailable') {
        setIdentity({ status: 'failed', message: LIVENESS_MESSAGES[report.reason ?? 'timeout'] });
        return;
      }
    }
    setIdentity({ status: 'checking', message: 'Checking your face against your registered Face ID…' });
    const frame = await proctor.captureFrame();
    if (!frame) { setIdentity({ status: 'failed', message: 'The camera is not ready yet. Wait a second and try again.' }); return; }
    try {
      const res = await api.upload<{ verified: boolean; message?: string; canProceed?: boolean; identityStatus: string }>(`attempts/${attemptId}/identity`, frame, 'identity.jpg', report ? { liveness: JSON.stringify(report) } : undefined);
      setIdentity(res.verified ? { status: 'ok', message: 'Identity verified.' } : { status: 'failed', message: res.message, canProceed: res.canProceed });
      if (res.verified || res.canProceed) setReverify(false);
    } catch (err) {
      setIdentity({ status: 'failed', message: err instanceof ApiRequestError ? err.message : 'Verification failed. Please try again.' });
    }
  };

  const enterFullscreen = async () => {
    try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); setIsFullscreen(true); return true; }
    catch { return false; }
  };

  const begin = async () => {
    if (!attemptId || !security) return;
    setError(null);
    if (security.requireFullscreen && !document.fullscreenElement) {
      const ok = await enterFullscreen();
      if (!ok) { setError('Full-screen mode could not be started. Allow full screen for this site and try again.'); return; }
    }
    try {
      const s = await api.post<AttemptState>(`attempts/${attemptId}/begin`);
      applyState(s);
    } catch (err) { setError((err as Error).message); }
  };

  const updateAnswer = (questionId: string, response: unknown, debounceMs?: number) => {
    setAnswers((prev) => {
      const markedForReview = prev[questionId]?.markedForReview ?? false;
      queue.save(questionId, response, markedForReview, debounceMs);
      return { ...prev, [questionId]: { response, markedForReview } };
    });
  };
  const toggleReview = (questionId: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? { response: null, markedForReview: false };
      queue.save(questionId, current.response, !current.markedForReview, 0);
      return { ...prev, [questionId]: { ...current, markedForReview: !current.markedForReview } };
    });
  };

  async function submit(source: 'student' | 'timeout') {
    if (!attemptId || submittingRef.current) return;
    submittingRef.current = true;
    finishedRef.current = true;
    setPhase('submitting');
    setConfirmSubmit(false);
    try {
      await queue.flush();
      await proctor.flush();
      const res = await api.post<any>(`attempts/${attemptId}/submit`);
      queue.clear();
      setResult(res);
    } catch (err) {
      // If time ran out the server has already auto-submitted the saved answers.
      if (err instanceof ApiRequestError && err.status === 409) setResult({ resultsReleased: false });
      else if (source === 'timeout') setResult({ resultsReleased: false, note: 'Time is up. Your saved answers were submitted by the server.' });
      else { submittingRef.current = false; finishedRef.current = false; setError(err instanceof Error ? err.message : 'Submission failed. Your answers are saved; try again.'); setPhase('exam'); return; }
    }
    proctor.stopCamera();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('done');
  }

  const exit = () => {
    proctor.stopCamera();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onExit();
  };

  /* ---------------------------- Rendering ---------------------------- */
  const questions = state?.questions ?? [];
  const current = questions[index];
  const answered = questions.filter((q) => { const r: any = answers[q.id]?.response; return r && (r.optionIds?.length || (r.text ?? '').trim() || (r.value ?? '') !== '' || (r.source ?? '').trim()); }).length;
  const flagged = questions.filter((q) => answers[q.id]?.markedForReview).length;
  const lowTime = remaining !== null && remaining < 5 * 60_000;
  const fullscreenBlocked = phase === 'exam' && security?.requireFullscreen && !isFullscreen;
  const cameraBlocked = phase === 'exam' && needsCamera && security?.cameraDisconnectPolicy === 'pause' && ['disconnected', 'blocked'].includes(proctor.cameraStatus);
  const identityReady = !security?.requireIdentityVerification || identity.status === 'ok' || identity.canProceed;
  const cameraReady = !needsCamera || proctor.cameraStatus === 'active';
  const blockClipboard = Boolean(security?.blockClipboard);
  const onViolation = useCallback((type: 'clipboard_blocked' | 'context_menu_blocked' | 'drop_blocked') => proctor.record({ type }, false), [proctor.record]); // eslint-disable-line react-hooks/exhaustive-deps

  // A render function (not a nested component) so the <video> element is not remounted every tick.
  const cameraPreview = (large = false) => (
    <div className={cn('relative overflow-hidden rounded-card bg-black', large ? 'aspect-video w-full max-w-md' : 'aspect-[4/3] w-40 sm:w-48')}>
      <video ref={proctor.attachVideo} muted playsInline autoPlay className="h-full w-full -scale-x-100 object-cover" aria-label="Your camera preview" />
      {/* Red boxes mark a detected event, not proven misconduct. */}
      {(proctor.activeWarning?.boxes?.length ? proctor.activeWarning.boxes : []).map((b, i) => (
        <div key={i} className="absolute border-2 border-danger shadow-[0_0_0_9999px_rgba(244,63,94,0.08)]" style={{ left: `${(1 - b.x - b.width) * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}>
          {b.label && <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-danger px-1 text-meta font-bold text-on-primary">{b.label}</span>}
        </div>
      ))}
      {!proctor.activeWarning?.boxes?.length && proctor.liveBoxes.slice(0, 1).map((b, i) => (
        <div key={i} className="absolute border border-success" style={{ left: `${(1 - b.x - b.width) * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }} />
      ))}
      <span className={cn('absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-meta font-bold ', proctor.cameraStatus === 'active' ? 'bg-success/90 text-white' : 'bg-danger/90 text-white')}>{proctor.cameraStatus === 'active' ? (security?.liveProctoring ? (proctor.visionStatus === 'ready' ? 'Monitoring' : proctor.visionStatus === 'loading' ? 'Starting' : 'Camera on') : 'Camera on') : proctor.cameraStatus}</span>
    </div>
  );

  if (phase === 'loading') return <Shell><div className="flex h-full items-center justify-center gap-3 text-sm text-ink-2"><Loader2 className="animate-spin" size={18} /> Preparing your exam…</div></Shell>;

  if (phase === 'error') return (
    <Shell><div className="mx-auto max-w-lg space-y-4 p-8 text-center"><XCircle className="mx-auto text-danger-ink" size={36} /><h1 className="text-xl font-semibold">This exam can’t be opened</h1><p className="text-sm text-ink-2">{error}</p><Button variant="secondary" onClick={exit}>Back to classroom</Button></div></Shell>
  );

  if (phase === 'instructions' && state) return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
        <p className="text-meta font-bold text-primary">Before you begin</p>
        <h1 className="text-3xl font-semibold tracking-tight">{state.test.title}</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <Info icon={<Clock3 size={16} />} label="Duration" value={`${state.test.durationMinutes} minutes`} />
          <Info icon={<CheckCircle2 size={16} />} label="Total marks" value={String(state.test.totalMarks)} />
          <Info icon={<ShieldCheck size={16} />} label="Mode" value={state.test.examMode === 'coding' ? 'Coding exam' : 'Standard'} />
        </div>
        {state.test.instructions && <div className="whitespace-pre-wrap rounded-card border border-line bg-surface-2 p-5 text-sm leading-6 text-ink-3">{state.test.instructions}</div>}
        <div className="space-y-3 rounded-card border border-primary-soft bg-primary-light p-5 text-sm leading-6 text-primary">
          <p className="font-bold">What is monitored during this exam</p>
          <ul className="list-disc space-y-1 pl-5 text-primary">
            <li>The timer is controlled by the server and keeps running if you refresh or lose connection. Answers are saved automatically.</li>
            {security?.requireFullscreen && <li>The exam runs in full-screen mode. Leaving full screen is recorded.</li>}
            {security?.tabSwitchDetection && <li>Switching tabs or windows is recorded.</li>}
            {security?.blockClipboard && <li>Copy, paste and drag-and-drop are disabled in answer fields.</li>}
            {needsCamera && <li>Your camera is used {security?.liveProctoring ? 'to check that you are present and facing the screen, using a face model that runs on your device; only numeric signals such as face count and head angle are sent to the server' : 'during the exam'}. Video is not recorded or uploaded.</li>}
            {security?.requireIdentityVerification && <li>A single photo is compared with your registered Face ID on our server{security.liveProctoring ? ', and re-checked periodically' : ''}. Face embeddings never leave the server.</li>}
          </ul>
          <p className="text-xs text-primary">Warnings are signals for your teacher to review. They are not proof of cheating and never fail you automatically. You can appeal any decision after the exam. Browser monitoring cannot see other devices.</p>
        </div>
        {needsCamera && (
          <label className="flex items-start gap-3 rounded-card border border-line p-4 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
            <span>I understand and agree to camera monitoring for this exam.</span>
          </label>
        )}
        <ErrorNote message={error} />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exit} icon={<LogOut size={14} />}>Not now</Button>
          <Button variant="student" disabled={needsCamera && !consent} onClick={() => void acceptConsent()} icon={<ChevronRight size={14} />}>Continue</Button>
        </div>
      </div>
    </Shell>
  );

  if (phase === 'setup' && state) return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
        <p className="text-meta font-bold text-primary">System check</p>
        <h1 className="text-2xl font-semibold">Get ready for {state.test.title}</h1>
        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            {needsCamera ? cameraPreview(true) : <div className="rounded-card border border-line p-6 text-sm text-ink-2">This exam does not use your camera.</div>}
            {liveness && <LivenessPrompt progress={liveness} />}
            {needsCamera && proctor.cameraStatus === 'blocked' && <ErrorNote message="Camera access was blocked. Allow the camera in your browser’s site settings, then press Retry." onRetry={() => void proctor.startCamera()} />}
          </div>
          <ol className="space-y-3 text-sm">
            <Step done={cameraReady} label="Camera" detail={needsCamera ? (cameraReady ? 'Camera is working.' : 'Allow camera access when your browser asks.') : 'Not required'} action={needsCamera && !cameraReady ? <Button size="sm" variant="secondary" onClick={() => void proctor.startCamera()} icon={<Camera size={13} />}>Enable</Button> : null} />
            {security?.requireIdentityVerification && (
              <Step done={identity.status === 'ok' || Boolean(identity.canProceed)} label="Identity" detail={identity.message ?? 'Look straight at the camera in good light, with only you in view.'} tone={identity.status === 'failed' && !identity.canProceed ? 'error' : undefined}
                action={identity.status !== 'ok' ? <Button size="sm" variant="secondary" loading={identity.status === 'checking'} disabled={!cameraReady} onClick={() => void verifyIdentity()} icon={<ShieldCheck size={13} />}>{identity.status === 'failed' ? 'Try again' : 'Verify'}</Button> : null} />
            )}
            <Step done={!security?.requireFullscreen || isFullscreen} label="Full screen" detail={security?.requireFullscreen ? 'The exam opens in full screen when you start.' : 'Not required'} />
            <Step done={online} label="Connection" detail={online ? 'Online' : 'You are offline. You can still start; answers are queued on this device.'} />
          </ol>
        </div>
        <ErrorNote message={error} />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exit} icon={<LogOut size={14} />}>Leave</Button>
          <Button variant="student" disabled={!cameraReady || !identityReady} onClick={() => void begin()} icon={security?.requireFullscreen ? <Expand size={14} /> : <ChevronRight size={14} />}>{security?.requireFullscreen ? 'Enter full screen & start' : 'Start exam'}</Button>
        </div>
        <p className="text-xs text-ink-2">The timer starts only when you press start.</p>
      </div>
    </Shell>
  );

  if ((phase === 'submitting' || phase === 'done') && state) return (
    <Shell>
      <div className="mx-auto max-w-lg space-y-5 p-8 text-center">
        {phase === 'submitting' ? <Loader2 className="mx-auto animate-spin text-primary" size={36} /> : <CheckCircle2 className="mx-auto text-success-ink" size={40} />}
        <h1 className="text-2xl font-semibold">{phase === 'submitting' ? 'Submitting your answers…' : 'Exam submitted'}</h1>
        {phase === 'done' && (result?.resultsReleased
          ? <p className="text-lg font-bold">Score: {result.score} / {result.maxScore} <span className="text-ink-2">({result.percentage}%)</span></p>
          : <p className="text-sm text-ink-2">{result?.note ?? 'Your answers are saved. Your teacher will release the results.'}</p>)}
        {phase === 'done' && <Button variant="student" onClick={exit}>Back to classroom</Button>}
      </div>
    </Shell>
  );

  if (!state || !current) return <Shell><div className="p-8 text-sm text-ink-2">No questions are available.</div></Shell>;

  return (
    <Shell>
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-[8rem] flex-1">
          <p className="line-clamp-2 text-sm font-semibold sm:truncate">{state.test.title}</p>
          <p className="text-meta text-ink-2">{answered}/{questions.length} answered{flagged ? ` · ${flagged} flagged` : ''}</p>
        </div>
        <span className={cn('order-last flex w-full items-center gap-1.5 text-meta font-bold sm:order-none sm:w-auto', queue.state === 'saved' ? 'text-success-ink' : queue.state === 'offline' ? 'text-warning-ink' : 'text-ink-2')} aria-live="polite">
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {queue.state === 'saving' ? 'Saving…' : queue.state === 'offline' || !online ? `Offline · ${queue.pendingCount} queued` : queue.state === 'error' ? 'Save failed — retrying' : 'All changes saved'}
        </span>
        {proctor.warningCount > 0 && <span className="flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-meta font-bold text-warning-ink"><AlertTriangle size={12} /> {proctor.warningCount} warning{proctor.warningCount === 1 ? '' : 's'}</span>}
        <span role="timer" aria-label="Time remaining" className={cn('rounded-button px-3 py-1.5 font-mono text-lg font-semibold tabular-nums', lowTime ? 'bg-danger-bg text-danger-ink' : 'bg-surface-2')}>{remaining === null ? '--:--' : fmt(remaining)}</span>
        <Button variant="student" size="sm" onClick={() => setConfirmSubmit(true)} icon={<Send size={13} />}>Submit</Button>
      </header>

      {proctor.activeWarning && (
        <div role="alert" className={cn('flex items-center gap-3 px-4 py-2 text-sm font-semibold', proctor.activeWarning.severity === 'high' ? 'bg-danger text-on-primary' : 'bg-warning text-ink')}>
          <AlertTriangle size={16} /> <span className="flex-1">{proctor.activeWarning.message}</span>
          <button type="button" onClick={proctor.dismissWarning} className="text-xs font-bold underline">OK</button>
        </div>
      )}
      <ErrorNote message={error} />

      <div className={cn('grid min-h-0 flex-1 gap-0', state.test.examMode === 'coding' ? 'lg:grid-cols-[220px_1fr]' : 'lg:grid-cols-[240px_1fr]')}>
        {/* Navigator + camera */}
        <aside className="flex items-start gap-3 border-b border-line p-3 sm:p-4 lg:block lg:space-y-4 lg:border-b-0 lg:border-r">
          {needsCamera && <div className="shrink-0 [&>div]:w-28 sm:[&>div]:w-40 lg:[&>div]:w-48">{cameraPreview()}</div>}
          <nav aria-label="Questions" className="grid flex-1 grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
            {questions.map((q, i) => {
              const r: any = answers[q.id]?.response;
              const has = r && (r.optionIds?.length || (r.text ?? '').trim() || (r.value ?? '') !== '' || (r.source ?? '').trim());
              const disabled = !state.test.allowBackNavigation && i < index;
              return (
                <button key={q.id} type="button" disabled={disabled} onClick={() => setIndex(i)} aria-current={i === index} aria-label={`Question ${i + 1}${has ? ', answered' : ''}${answers[q.id]?.markedForReview ? ', flagged' : ''}`}
                  className={cn('relative h-9 rounded-lg text-xs font-bold', i === index ? 'bg-primary text-on-primary' : has ? 'bg-success-bg text-success-ink' : 'bg-surface-2 text-ink-2', disabled && 'opacity-30')}>
                  {i + 1}{answers[q.id]?.markedForReview && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning" />}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-0 overflow-y-auto p-4 sm:p-8">
          <div className={cn('mx-auto', current.type === 'coding' ? 'max-w-none' : 'max-w-3xl')}>
            <QuestionView key={current.id} question={current} index={index} response={answers[current.id]?.response} onChange={(r, d) => updateAnswer(current.id, r, d)} attemptId={state.attempt.id} blockClipboard={blockClipboard} onViolation={onViolation} saveState={queue.state} />
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <Button variant="secondary" disabled={index === 0 || !state.test.allowBackNavigation} onClick={() => setIndex((i) => Math.max(0, i - 1))} icon={<ChevronLeft size={14} />}>Previous</Button>
              <Button variant="ghost" onClick={() => toggleReview(current.id)} icon={<Flag size={14} className={answers[current.id]?.markedForReview ? 'fill-warning text-warning-ink' : ''} />}>{answers[current.id]?.markedForReview ? 'Flagged' : 'Flag for review'}</Button>
              <div className="flex-1" />
              {index < questions.length - 1 ? <Button variant="student" onClick={() => setIndex((i) => i + 1)} icon={<ChevronRight size={14} />}>Next</Button> : <Button variant="student" onClick={() => setConfirmSubmit(true)} icon={<Send size={14} />}>Review & submit</Button>}
            </div>
          </div>
        </main>
      </div>

      {/* Blocking overlays */}
      {(fullscreenBlocked || cameraBlocked) && (
        <Overlay>
          <AlertTriangle className="mx-auto text-warning-ink" size={32} />
          <h2 className="text-xl font-semibold">{cameraBlocked ? 'Camera disconnected' : 'Return to full screen'}</h2>
          <p className="text-sm text-ink-2">{cameraBlocked ? 'Reconnect your camera to continue. The timer is still running.' : 'This exam must stay in full screen. Leaving it has been recorded. The timer is still running.'}</p>
          {cameraBlocked ? <Button variant="student" onClick={() => void proctor.startCamera()} icon={<Camera size={14} />}>Reconnect camera</Button> : <Button variant="student" onClick={() => void enterFullscreen()} icon={<Expand size={14} />}>Back to full screen</Button>}
        </Overlay>
      )}
      {reverify && (
        <Overlay>
          <ShieldCheck className="mx-auto text-danger-ink" size={32} />
          <h2 className="text-xl font-semibold">Verify your identity again</h2>
          <p className="text-sm text-ink-2">Your face did not match your registered Face ID. Look at the camera and verify to continue. Your teacher can review this.</p>
          <div className="mx-auto w-fit">{cameraPreview()}</div>
          {liveness && <LivenessPrompt progress={liveness} />}
          {identity.message && <p className="text-xs text-warning-ink">{identity.message}</p>}
          <Button variant="student" loading={identity.status === 'checking'} onClick={() => void verifyIdentity()}>Verify now</Button>
        </Overlay>
      )}
      {confirmSubmit && (
        <Overlay>
          <Send className="mx-auto text-primary" size={28} />
          <h2 className="text-xl font-semibold">Submit your exam?</h2>
          <p className="text-sm text-ink-2">You answered {answered} of {questions.length} questions{flagged ? ` and flagged ${flagged}` : ''}. You can’t change answers after submitting.</p>
          {queue.pendingCount > 0 && <p className="text-xs text-warning-ink">{queue.pendingCount} answer(s) are still being saved. They will be sent before submitting.</p>}
          <div className="flex justify-center gap-3"><Button variant="secondary" onClick={() => setConfirmSubmit(false)}>Keep working</Button><Button variant="student" onClick={() => void submit('student')} icon={<Send size={14} />}>Submit now</Button></div>
        </Overlay>
      )}
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  // Full-viewport, distraction-free surface above the dashboard.
  <div className="fixed inset-0 z-[200] flex flex-col bg-canvas text-ink">{children}</div>
);
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[210] flex items-center justify-center bg-overlay p-6 " role="alertdialog" aria-modal="true"><div className="max-w-md space-y-4 rounded-card border border-line bg-surface p-6 text-center">{children}</div></div>
);
const Info: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-card border border-line bg-surface-2 p-4"><p className="flex items-center gap-2 text-meta font-bold text-ink-2">{icon}{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>
);
const LivenessPrompt: React.FC<{ progress: LivenessProgress }> = ({ progress }) => {
  const text = progress.faces > 1 ? 'Only you should be in view.'
    : progress.faces === 0 ? 'Move so your whole face is in the frame.'
    : progress.step === 'turn' ? (progress.turnedA || progress.turnedB ? 'Good — now turn your head slowly to the other side.' : 'Turn your head slowly to one side.')
    : progress.step === 'blink' ? 'Now blink once.'
    : 'Look straight at the camera.';
  const pill = (done: boolean, label: string) => (
    <span className={cn('rounded-full px-2.5 py-1 text-meta font-bold', done ? 'bg-success-bg text-success-ink' : 'bg-surface-2 text-ink-2')}>{done ? '✓ ' : ''}{label}</span>
  );
  return (
    <div role="status" aria-live="polite" className="space-y-2 rounded-card border border-primary-soft bg-primary-light p-4 text-left">
      <p className="text-sm font-bold text-primary-dark">{text}</p>
      <div className="flex flex-wrap gap-2">
        {pill(progress.turnedA, 'One side')}
        {pill(progress.turnedB, 'Other side')}
        {pill(progress.blinked, 'Blink')}
        {pill(progress.step === 'done', 'Face camera')}
      </div>
    </div>
  );
};

const Step: React.FC<{ done: boolean; label: string; detail: string; action?: React.ReactNode; tone?: 'error' }> = ({ done, label, detail, action, tone }) => (
  <li className="flex items-start gap-3 rounded-card border border-line p-4">
    {done ? <CheckCircle2 className="mt-0.5 shrink-0 text-success-ink" size={18} /> : tone === 'error' ? <XCircle className="mt-0.5 shrink-0 text-danger-ink" size={18} /> : <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-line" />}
    <div className="min-w-0 flex-1"><p className="font-bold">{label}</p><p className={cn('text-xs', tone === 'error' ? 'text-danger-ink' : 'text-ink-2')}>{detail}</p></div>
    {action}
  </li>
);

export default SecureExam;
