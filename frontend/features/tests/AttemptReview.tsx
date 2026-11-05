import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Code2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from '../../components/ui/icons-compat';
import { api, formatDateTime } from '../lms/api';
import { QUESTION_TYPE_LABELS } from '../lms/types';
import { Badge, Button, ErrorNote, inputClass, Modal, Spinner, useAsync } from '../lms/ui';
import { cn } from '../../lib/utils';

const EVENT_LABELS: Record<string, string> = {
  tab_hidden: 'Left the exam tab', window_blur: 'Window lost focus', fullscreen_exit: 'Exited full screen', clipboard_blocked: 'Copy/paste blocked', context_menu_blocked: 'Right-click blocked', drop_blocked: 'Drag-and-drop blocked',
  network_offline: 'Went offline', network_online: 'Back online', camera_disconnected: 'Camera disconnected', camera_reconnected: 'Camera reconnected', camera_obstructed: 'Camera covered or dark',
  face_absent: 'No face visible', multiple_faces: 'Multiple faces', looking_away: 'Looking away', head_turned: 'Head turned away', suspicious_object: 'Possible phone/device', vision_unavailable: 'On-device vision unavailable',
  identity_verified: 'Identity verified', identity_mismatch: 'Face did not match', identity_no_face: 'Verification: no face', identity_multiple_faces: 'Verification: multiple faces', identity_not_enrolled: 'Face ID not registered',
  identity_service_unavailable: 'Face service unavailable', identity_teacher_verified: 'Teacher approved identity', identity_teacher_failed: 'Teacher rejected identity', teacher_alert: 'Warning threshold reached', unknown_face: 'Unknown face', behavior_anomaly: 'Unusual behaviour vs. baseline',
};
const SEVERITY_TONE: Record<string, 'slate' | 'blue' | 'amber' | 'red'> = { info: 'slate', low: 'blue', medium: 'amber', high: 'red', critical: 'red' };

export const AttemptReview: React.FC<{ attemptId: string; onClose: (changed: boolean) => void }> = ({ attemptId, onClose }) => {
  const review = useAsync(() => api.get<any>(`attempts/${attemptId}/review`), [attemptId]);
  const [grades, setGrades] = useState<Record<string, { manualScore: string; feedback: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [tab, setTab] = useState<'answers' | 'proctoring'>('answers');

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setError(null);
    try { await fn(); setChanged(true); review.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const data = review.data;
  const saveGrades = () => act('grade', () => api.post(`attempts/${attemptId}/grade`, {
    grades: Object.entries(grades).map(([questionId, g]) => ({ questionId, manualScore: g.manualScore === '' ? null : Number(g.manualScore), feedback: g.feedback || null })),
  }).then(() => setGrades({})));

  return (
    <Modal title={data ? `${data.student?.name ?? 'Student'} — ${data.test.title}` : 'Attempt review'} onClose={() => onClose(changed)} wide>
      {review.loading && !data ? <Spinner /> : review.error ? <ErrorNote message={review.error} onRetry={review.reload} /> : data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={data.attempt.status === 'evaluated' ? 'green' : 'amber'}>{data.attempt.status.replace('_', ' ')}</Badge>
            <span className="font-bold">Score {data.attempt.score ?? '—'} / {data.attempt.maxScore ?? data.test.totalMarks}</span>
            <span className="text-ink-2">· Integrity indicator {data.attempt.integrityScore ?? 100}/100</span>
            <span className="text-ink-2">· Identity: {data.attempt.identityStatus.replace('_', ' ')}</span>
            <span className="text-ink-2">· Submitted {formatDateTime(data.attempt.submittedAt)}{data.attempt.submissionSource === 'timeout' ? ' (time ran out)' : ''}</span>
          </div>
          <ErrorNote message={error} />
          <div className="flex gap-2">
            {(['answers', 'proctoring'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn('rounded-button px-4 py-2 text-meta font-bold ', tab === t ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2 ')}>{t === 'answers' ? 'Answers & grading' : `Proctoring (${data.proctoring.events.filter((e: any) => e.severity !== 'info').length})`}</button>)}
          </div>

          {tab === 'answers' && (
            <div className="space-y-4">
              {data.questions.map((q: any, i: number) => {
                const a = q.answer;
                const manual = a?.needsManualReview || ['long_answer', 'short_answer', 'fill_blank', 'coding'].includes(q.type);
                const g = grades[q.id] ?? { manualScore: a?.manualScore ?? '', feedback: a?.feedback ?? '' };
                const r = a?.response;
                return (
                  <div key={q.id} className={cn('space-y-3 rounded-card border p-4', a?.needsManualReview ? 'border-warning bg-warning-bg' : 'border-line ')}>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">Q{i + 1}</span><span className="text-meta font-bold text-ink-2">{QUESTION_TYPE_LABELS[q.type as keyof typeof QUESTION_TYPE_LABELS]}</span>{a?.needsManualReview && <Badge tone="amber">Needs your review</Badge>}<span className="ml-auto text-xs font-bold">{a?.awardedMarks ?? 0} / {q.marks}</span></div>
                    <p className="whitespace-pre-wrap text-sm font-semibold">{q.prompt}</p>
                    {q.options?.length > 0 && (
                      <ul className="space-y-1 text-sm">{q.options.map((o: any) => {
                        const chosen = r?.optionIds?.includes(o.id);
                        return <li key={o.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1', o.isCorrect && 'bg-success-bg', chosen && !o.isCorrect && 'bg-danger-bg')}>{chosen ? (o.isCorrect ? <CheckCircle2 size={14} className="text-success-ink" /> : <XCircle size={14} className="text-danger-ink" />) : <span className="w-3.5" />}{o.text}{o.isCorrect && <span className="text-meta font-bold text-success-ink">correct</span>}</li>;
                      })}</ul>
                    )}
                    {r?.text !== undefined && <p className="whitespace-pre-wrap rounded-button bg-surface-2 p-3 text-sm ">{r.text || <em className="text-ink-2">No answer</em>}</p>}
                    {r?.value !== undefined && <p className="font-mono text-sm">Answer: {String(r.value)} {q.numericAnswer !== null && <span className="text-ink-2">(key {q.numericAnswer} ± {q.numericTolerance})</span>}</p>}
                    {(q.acceptedAnswers?.length > 0 || q.modelAnswer) && <p className="text-xs text-ink-2">Expected: {q.acceptedAnswers?.join(' / ') || q.modelAnswer}</p>}
                    {q.type === 'coding' && (
                      <div className="space-y-2">
                        {r?.source ? <pre className="max-h-72 overflow-auto rounded-button bg-ink p-3 font-mono text-xs text-ink-3"><span className="text-ink-2">// {r.language}{'\n'}</span>{r.source}</pre> : <p className="text-sm text-ink-2">No code submitted.</p>}
                        {a?.evaluation && (
                          <div className="rounded-button border border-line p-3 text-xs ">
                            <p className="mb-2 flex items-center gap-2 font-bold"><Code2 size={13} /> {a.evaluation.status === 'runner_unavailable' || a.evaluation.status === 'runner_error' ? 'Sandbox was unavailable — re-run or grade manually' : `${a.evaluation.passed}/${a.evaluation.total} test cases passed`}</p>
                            {a.evaluation.compileError && <pre className="whitespace-pre-wrap rounded bg-warning-bg p-2 font-mono">{a.evaluation.compileError}</pre>}
                            <div className="grid gap-1">{(a.evaluation.results ?? []).map((t: any, k: number) => <div key={k} className={cn('flex items-center gap-2', t.passed ? 'text-success-ink' : 'text-danger-ink')}>{t.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />} Case {k + 1}{t.hidden ? ' (hidden)' : ''} · {t.status} {t.timeMs !== null ? `· ${t.timeMs} ms` : ''}</div>)}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {manual && data.attempt.status !== 'in_progress' && (
                      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                        <input type="number" aria-label="Marks awarded" step={0.5} min={-(q.negativeMarks ?? 0)} max={q.marks} placeholder={`Marks / ${q.marks}`} value={g.manualScore} onChange={(e) => setGrades({ ...grades, [q.id]: { ...g, manualScore: e.target.value } })} className={inputClass} />
                        <input aria-label="Feedback" placeholder="Feedback for the student (optional)" value={g.feedback} onChange={(e) => setGrades({ ...grades, [q.id]: { ...g, feedback: e.target.value } })} className={inputClass} />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-card bg-surface p-2 ">
                {data.questions.some((q: any) => q.type === 'coding') && <Button variant="secondary" loading={busy === 'rerun'} onClick={() => void act('rerun', () => api.post(`attempts/${attemptId}/reevaluate-coding`))} icon={<RefreshCw size={14} />}>Re-run code tests</Button>}
                <Button loading={busy === 'grade'} disabled={!Object.keys(grades).length} onClick={() => void saveGrades()}>Save grades</Button>
              </div>
            </div>
          )}

          {tab === 'proctoring' && (
            <div className="space-y-4">
              <p className="flex items-start gap-2 rounded-card bg-warning-bg p-3 text-xs leading-5 text-warning-ink "><AlertTriangle size={14} className="mt-0.5 shrink-0" />These are automated signals, not proof of misconduct. Review the context, dismiss false alarms, and decide yourself. Dismissed events no longer reduce the integrity indicator.</p>
              {data.attempt.identityStatus === 'manual_review' && (
                <div className="flex flex-wrap items-center gap-3 rounded-card border border-primary-soft p-3 text-sm"><ShieldAlert size={16} className="text-primary" /> Identity needs your review.
                  <Button size="sm" variant="secondary" loading={busy === 'idv'} onClick={() => void act('idv', () => api.post(`attempts/${attemptId}/identity-override`, { decision: 'verified' }))} icon={<ShieldCheck size={13} />}>Approve identity</Button>
                </div>
              )}
              {data.appeals?.length > 0 && data.appeals.map((ap: any) => (
                <div key={ap.id} className="space-y-2 rounded-card border border-primary-soft bg-primary-light p-3 text-sm">
                  <p className="font-bold">Student appeal · {ap.status}</p><p className="whitespace-pre-wrap text-ink-2 ">{ap.reason}</p>
                  {ap.status === 'open' && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void act('appeal', () => api.patch(`appeals/${ap.id}`, { status: 'accepted' }))}>Accept</Button><Button size="sm" variant="ghost" onClick={() => void act('appeal', () => api.patch(`appeals/${ap.id}`, { status: 'rejected' }))}>Reject</Button></div>}
                </div>
              ))}
              <ol className="relative space-y-2 border-l border-line pl-4 ">
                {data.proctoring.events.length === 0 && <li className="text-sm text-ink-2">No proctoring events were recorded.</li>}
                {data.proctoring.events.map((e: any) => (
                  <li key={e.id} className={cn('rounded-button border p-3 text-sm', e.review_status === 'dismissed' ? 'border-line opacity-50 ' : 'border-line ')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock3 size={12} className="text-ink-2" /><span className="font-mono text-meta text-ink-2">{new Date(e.occurred_at).toLocaleTimeString()}</span>
                      <Badge tone={SEVERITY_TONE[e.severity]}>{e.severity}</Badge>
                      <span className="font-bold">{EVENT_LABELS[e.event_type] ?? e.event_type.replace(/_/g, ' ')}</span>
                      <span className="text-meta text-ink-2">{e.source.replace('_', ' ')}{e.confidence !== null ? ` · ${Math.round(Number(e.confidence) * 100)}%` : ''}</span>
                      {e.severity !== 'info' && (
                        <div className="ml-auto flex gap-1">
                          <Button size="sm" variant={e.review_status === 'dismissed' ? 'secondary' : 'ghost'} onClick={() => void act(`ev-${e.id}`, () => api.patch(`proctoring-events/${e.id}`, { reviewStatus: e.review_status === 'dismissed' ? 'pending' : 'dismissed' }))}>{e.review_status === 'dismissed' ? 'Restore' : 'Dismiss'}</Button>
                          <Button size="sm" variant={e.review_status === 'concern' ? 'danger' : 'ghost'} onClick={() => void act(`ev-${e.id}`, () => api.patch(`proctoring-events/${e.id}`, { reviewStatus: e.review_status === 'concern' ? 'pending' : 'concern' }))}>Concern</Button>
                        </div>
                      )}
                    </div>
                    {e.details && Object.keys(e.details).filter((k) => e.details[k] !== null).length > 0 && <p className="mt-1 font-mono text-meta text-ink-2">{Object.entries(e.details).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
