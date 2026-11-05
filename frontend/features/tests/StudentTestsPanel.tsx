import React, { lazy, Suspense, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, Code2, FileText, Lock, PlayCircle, ShieldCheck } from '../../components/ui/icons-compat';
import { api, formatDateTime } from '../lms/api';
import type { StudentTest } from '../lms/types';
import { Badge, Button, Card, EmptyState, ErrorNote, inputClass, Modal, Spinner, useAsync } from '../lms/ui';
import { cn } from '../../lib/utils';

const SecureExam = lazy(() => import('../exam/SecureExam'));

const STATUS: Record<StudentTest['myStatus'], { label: string; tone: 'slate' | 'blue' | 'green' | 'amber' | 'purple' | 'red' }> = {
  not_started: { label: 'Not started', tone: 'slate' },
  in_progress: { label: 'In progress', tone: 'blue' },
  submitted: { label: 'Submitted', tone: 'purple' },
  evaluated: { label: 'Evaluated', tone: 'purple' },
  results_published: { label: 'Results out', tone: 'green' },
  missed: { label: 'Missed', tone: 'red' },
};

/**
 * Student test list. With classroomId it shows that classroom; without it,
 * every classroom the student is enrolled in. The server only ever returns
 * published tests from the student's own classrooms.
 */
export const StudentTestsPanel: React.FC<{ classroomId?: string; onCountChange?: (n: number) => void }> = ({ classroomId, onCountChange }) => {
  const list = useAsync(async () => {
    const r = classroomId ? await api.get<{ tests: StudentTest[] }>(`classrooms/${classroomId}/tests`) : await api.get<{ tests: StudentTest[] }>('me/tests');
    onCountChange?.(r.tests.length);
    return r.tests;
  }, [classroomId]);
  const [taking, setTaking] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<string | null>(null);

  if (list.loading && !list.data) return <Spinner label="Loading tests…" />;
  const tests = list.data ?? [];
  const groups = [
    { title: 'Available now', items: tests.filter((t) => t.availability === 'active' && (t.canStart || t.openAttemptId)) },
    { title: 'Upcoming', items: tests.filter((t) => t.availability === 'scheduled') },
    { title: 'Completed & past', items: tests.filter((t) => !(t.availability === 'active' && (t.canStart || t.openAttemptId)) && t.availability !== 'scheduled') },
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      <ErrorNote message={list.error} onRetry={list.reload} />
      {tests.length === 0 ? <EmptyState icon={<FileText size={36} />} title="No tests yet" body="Tests your teacher publishes for your classroom will appear here." /> : groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h3 className="text-meta font-bold text-ink-2">{g.title}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {g.items.map((t) => (
              <Card key={t.id} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS[t.myStatus].tone}>{STATUS[t.myStatus].label}</Badge>{t.examMode === 'coding' && <Badge tone="purple"><Code2 size={11} /> Coding</Badge>}{t.proctored && <Badge tone="blue"><ShieldCheck size={11} /> Proctored</Badge>}</div>
                  <h4 className="text-lg font-bold">{t.title}</h4>
                  {t.classroomName && <p className="text-xs font-semibold text-primary">{t.classroomName}</p>}
                  {t.description && <p className="line-clamp-2 text-xs leading-relaxed text-ink-2">{t.description}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 border-y border-line py-3 text-xs text-ink-2 ">
                  <span className="flex items-center gap-1.5"><Clock3 size={12} /> {t.durationMinutes} min</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={12} /> {t.totalMarks} marks</span>
                  {t.scheduledStart && <span className="col-span-2 flex items-center gap-1.5"><CalendarClock size={12} /> Opens {formatDateTime(t.scheduledStart)}</span>}
                  {t.scheduledEnd && <span className="col-span-2 flex items-center gap-1.5"><CalendarClock size={12} /> Closes {formatDateTime(t.scheduledEnd)}</span>}
                  {t.attemptLimit > 1 && <span className="col-span-2">Attempts: {t.attemptsUsed}/{t.attemptLimit}</span>}
                  {(t.requirements.camera || t.requirements.identity) && <span className="col-span-2 text-meta">Needs: {[t.requirements.camera && 'camera', t.requirements.identity && 'Face ID', t.requirements.fullscreen && 'full screen'].filter(Boolean).join(', ')}</span>}
                </div>
                {t.result && <p className="text-sm font-bold">Score: {t.result.score} / {t.result.maxScore} <span className="font-normal text-ink-2">({t.result.percentage}%)</span></p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  {t.openAttemptId ? <Button variant="student" className="flex-1" onClick={() => setTaking(t.id)} icon={<PlayCircle size={14} />}>Resume</Button>
                    : t.canStart ? <Button variant="student" className="flex-1" onClick={() => setTaking(t.id)} icon={<PlayCircle size={14} />}>{t.attemptsUsed ? 'Start new attempt' : 'Start test'}</Button>
                    : t.availability === 'scheduled' ? <Button variant="secondary" className="flex-1" disabled icon={<Lock size={14} />}>Opens {formatDateTime(t.scheduledStart)}</Button> : null}
                  {t.lastAttemptId && <Button variant="secondary" onClick={() => setResultFor(t.lastAttemptId!)}>{t.result ? 'View result' : 'Status'}</Button>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
      {taking && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black text-sm text-white">Loading exam…</div>}>
          <SecureExam testId={taking} onExit={() => { setTaking(null); list.reload(); }} />
        </Suspense>
      )}
      {resultFor && <ResultModal attemptId={resultFor} onClose={() => setResultFor(null)} />}
    </div>
  );
};

export const ResultModal: React.FC<{ attemptId: string; onClose: () => void }> = ({ attemptId, onClose }) => {
  const result = useAsync(() => api.get<any>(`attempts/${attemptId}/result`), [attemptId]);
  const [appeal, setAppeal] = useState('');
  const [appealState, setAppealState] = useState<{ sending: boolean; message?: string; error?: string }>({ sending: false });
  const r = result.data;
  const sendAppeal = async () => {
    setAppealState({ sending: true });
    try { await api.post(`attempts/${attemptId}/appeal`, { reason: appeal }); setAppeal(''); setAppealState({ sending: false, message: 'Appeal sent. Your teacher will review it.' }); }
    catch (e) { setAppealState({ sending: false, error: (e as Error).message }); }
  };
  return (
    <Modal title={r?.test?.title ?? 'Result'} onClose={onClose} wide>
      {result.loading && !r ? <Spinner /> : result.error ? <ErrorNote message={result.error} /> : r && (
        <div className="space-y-5">
          {!r.resultsReleased ? <p className="rounded-card bg-primary-light p-4 text-sm text-primary-dark ">Your exam was submitted on {formatDateTime(r.submittedAt)}. Your teacher hasn’t released the results yet.</p> : (
            <>
              <div className="rounded-card bg-brand-gradient p-6 text-white"><p className="text-meta font-bold text-white">Your score</p><p className="text-4xl font-semibold">{r.score} <span className="text-xl text-white">/ {r.maxScore}</span></p><p className="text-sm text-white">{r.percentage}%{r.passingMarks !== null ? ` · ${r.score >= r.passingMarks ? 'Passed' : 'Below passing marks'}` : ''}</p></div>
              <div className="space-y-3">
                {r.breakdown?.map((q: any, i: number) => (
                  <div key={q.questionId} className="rounded-card border border-line p-4 text-sm ">
                    <div className="flex items-center gap-2"><span className="font-semibold">Q{i + 1}</span><span className="ml-auto font-bold">{q.awardedMarks ?? 0} / {q.marks}</span></div>
                    <p className="mt-1 whitespace-pre-wrap">{q.prompt}</p>
                    {q.options?.length > 0 && <ul className="mt-2 space-y-1">{q.options.map((o: any) => <li key={o.id} className={cn('rounded-lg px-2 py-1', q.response?.optionIds?.includes(o.id) && 'bg-primary-light font-semibold', q.correctOptionIds?.includes(o.id) && 'text-success-ink')}>{o.text}{q.correctOptionIds?.includes(o.id) ? ' ✓' : ''}</li>)}</ul>}
                    {q.response?.text && <p className="mt-2 whitespace-pre-wrap rounded-button bg-surface-2 p-2 ">{q.response.text}</p>}
                    {q.coding && <p className="mt-2 text-xs">{q.coding.passed}/{q.coding.total} test cases passed</p>}
                    {q.modelAnswer !== null && q.modelAnswer !== undefined && <p className="mt-2 text-xs text-success-ink">Answer: {String(q.modelAnswer)}</p>}
                    {q.explanation && <p className="mt-1 text-xs text-ink-2">{q.explanation}</p>}
                    {q.feedback && <p className="mt-2 rounded-button bg-primary-light p-2 text-xs text-primary-dark ">Teacher: {q.feedback}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="space-y-2 rounded-card border border-line p-4 ">
            <p className="text-sm font-bold">Disagree with a mark or a proctoring flag?</p>
            <textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} rows={3} className={inputClass} placeholder="Explain what you would like your teacher to review." />
            {appealState.message && <p className="text-xs text-success-ink">{appealState.message}</p>}
            <ErrorNote message={appealState.error} />
            <Button variant="student" size="sm" loading={appealState.sending} disabled={appeal.trim().length < 5} onClick={() => void sendAppeal()}>Send appeal</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
