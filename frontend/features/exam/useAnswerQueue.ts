import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../lms/api';

/**
 * Autosave with an on-device retry queue. Every change is written to
 * localStorage first, then sent to the server. Queue entries are removed only
 * after the server acknowledges them, so refreshes, crashes and network drops
 * do not lose answers. Revisions stop older offline edits from overwriting
 * newer ones.
 */
type Entry = { response: unknown; markedForReview: boolean; revision: number };
export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export function useAnswerQueue(attemptId: string | null, initialRevisions: Record<string, number>, onTimeUp: () => void) {
  const key = attemptId ? `neuroclass:exam-queue:${attemptId}` : null;
  const pending = useRef<Record<string, Entry>>({});
  const revisions = useRef<Record<string, number>>({ ...initialRevisions });
  const timers = useRef<Record<string, number>>({});
  const [state, setState] = useState<SaveState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const timeUp = useRef(onTimeUp);
  timeUp.current = onTimeUp;

  const persist = useCallback(() => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(pending.current)); } catch { /* storage may be full or blocked */ }
    setPendingCount(Object.keys(pending.current).length);
  }, [key]);

  useEffect(() => {
    if (!key) return;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, Entry>;
      pending.current = stored;
      for (const [q, e] of Object.entries(stored)) revisions.current[q] = Math.max(revisions.current[q] ?? 0, e.revision);
      setPendingCount(Object.keys(stored).length);
    } catch { pending.current = {}; }
  }, [key]);

  const sendOne = useCallback(async (questionId: string) => {
    const entry = pending.current[questionId];
    if (!entry || !attemptId) return true;
    try {
      await api.put(`attempts/${attemptId}/answers/${questionId}`, entry);
      if (pending.current[questionId]?.revision === entry.revision) delete pending.current[questionId];
      persist();
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) { timeUp.current(); return false; }
      if (error instanceof ApiRequestError && error.status === 400) { delete pending.current[questionId]; persist(); setState('error'); return false; }
      setState(error instanceof ApiRequestError && error.status === 0 ? 'offline' : 'error');
      return false;
    }
  }, [attemptId, persist]);

  const flush = useCallback(async () => {
    const ids = Object.keys(pending.current);
    if (!ids.length) { setState((s) => (s === 'saving' ? 'saved' : s)); return true; }
    setState('saving');
    let ok = true;
    for (const id of ids) ok = (await sendOne(id)) && ok;
    if (ok) setState('saved');
    return ok;
  }, [sendOne]);

  const save = useCallback((questionId: string, response: unknown, markedForReview: boolean, debounceMs = 600) => {
    const revision = (revisions.current[questionId] ?? 0) + 1;
    revisions.current[questionId] = revision;
    pending.current[questionId] = { response, markedForReview, revision };
    persist();
    setState('saving');
    window.clearTimeout(timers.current[questionId]);
    timers.current[questionId] = window.setTimeout(() => {
      void sendOne(questionId).then((ok) => { if (ok && !Object.keys(pending.current).length) setState('saved'); });
    }, debounceMs);
  }, [persist, sendOne]);

  useEffect(() => {
    const online = () => void flush();
    window.addEventListener('online', online);
    const retry = window.setInterval(() => { if (Object.keys(pending.current).length && navigator.onLine) void flush(); }, 10_000);
    return () => { window.removeEventListener('online', online); window.clearInterval(retry); };
  }, [flush]);

  const clear = useCallback(() => {
    pending.current = {};
    if (key) try { localStorage.removeItem(key); } catch { /* ignore */ }
    setPendingCount(0);
  }, [key]);

  /** Locally queued value takes precedence over the server copy after a refresh. */
  const localValue = useCallback((questionId: string) => pending.current[questionId], []);

  return { save, flush, clear, state, pendingCount, localValue };
}
