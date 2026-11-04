import React, { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, CheckCircle2, Eye, EyeOff, Radio, ShieldAlert, Users, Wifi, WifiOff } from 'lucide-react';
import { api, formatDateTime } from '../lms/api';
import { Badge, Button, Card, EmptyState, ErrorNote, Spinner, useAsync, AVAILABILITY_BADGE } from '../lms/ui';
import { AttemptReview } from './AttemptReview';
import { cn } from '../../lib/utils';

export const TestResults: React.FC<{ testId: string; onBack: () => void; initialView?: 'results' | 'monitor' }> = ({ testId, onBack, initialView = 'results' }) => {
  const [view, setView] = useState<'results' | 'monitor'>(initialView);
  const results = useAsync(() => api.get<any>(`tests/${testId}/results`), [testId]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = results.data;

  const release = async (released: boolean) => {
    setError(null);
    try { await api.post(`tests/${testId}/release-results`, { released }); results.reload(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Tests</Button>
        <h3 className="text-xl font-black">{data?.test?.title ?? 'Results'}</h3>
        {data?.test && <Badge tone={AVAILABILITY_BADGE[data.test.availability]?.tone}>{AVAILABILITY_BADGE[data.test.availability]?.label}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant={view === 'monitor' ? 'primary' : 'secondary'} onClick={() => setView('monitor')} icon={<Radio size={14} />}>Live monitor</Button>
          <Button variant={view === 'results' ? 'primary' : 'secondary'} onClick={() => { setView('results'); results.reload(); }} icon={<BarChart3 size={14} />}>Results</Button>
        </div>
      </div>
      <ErrorNote message={error || results.error} onRetry={results.error ? results.reload : undefined} />

      {view === 'monitor' ? <LiveMonitor testId={testId} onReview={setReviewing} /> : results.loading && !data ? <Spinner /> : data?.metrics && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Enrolled" value={data.metrics.enrolled} />
            <Metric label="Submitted" value={data.metrics.submitted} />
            <Metric label="In progress" value={data.metrics.inProgress} />
            <Metric label="Needs grading" value={data.metrics.pendingManualReview} tone={data.metrics.pendingManualReview ? 'amber' : undefined} />
            <Metric label="Average" value={`${data.metrics.average}%`} />
            <Metric label="Pass rate" value={data.metrics.passRate === null ? '—' : `${data.metrics.passRate}%`} />
          </div>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{data.test.resultsReleased ? 'Results are visible to students' : 'Results are hidden from students'}</p>
              <p className="text-xs text-slate-500">{data.metrics.pendingManualReview ? `Grade ${data.metrics.pendingManualReview} attempt(s) first — only fully evaluated attempts are shown to students.` : 'Students only see fully evaluated attempts.'}</p>
            </div>
            <Button variant={data.test.resultsReleased ? 'secondary' : 'primary'} onClick={() => void release(!data.test.resultsReleased)} icon={data.test.resultsReleased ? <EyeOff size={14} /> : <Eye size={14} />}>{data.test.resultsReleased ? 'Hide results' : 'Release results'}</Button>
          </Card>
          {data.attempts.length === 0 ? <EmptyState icon={<Users size={32} />} title="No attempts yet" body="Results appear here as students submit." /> : (
            <Card className="overflow-x-auto p-0 sm:p-0">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-slate-500"><tr className="border-b border-black/5 dark:border-white/10"><th className="px-5 py-3">Student</th><th>Status</th><th>Score</th><th>Integrity</th><th>Warnings</th><th>Identity</th><th>Submitted</th><th /></tr></thead>
                <tbody>
                  {data.attempts.map((a: any) => (
                    <tr key={a.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                      <td className="px-5 py-3"><p className="font-bold">{a.student.name}</p><p className="text-xs text-slate-500">{a.student.rollNumber ? `Roll ${a.student.rollNumber}` : a.student.email}</p></td>
                      <td><Badge tone={a.status === 'evaluated' ? 'green' : ['submitted', 'auto_submitted'].includes(a.status) ? 'amber' : 'blue'}>{a.status === 'submitted' || a.status === 'auto_submitted' ? 'needs grading' : a.status.replace('_', ' ')}</Badge></td>
                      <td className="font-bold">{a.score ?? '—'}{a.maxScore ? ` / ${a.maxScore}` : ''} <span className="text-xs font-normal text-slate-400">{a.percentage !== null ? `${a.percentage}%` : ''}</span></td>
                      <td><span className={cn('font-bold', (a.integrityScore ?? 100) < 60 ? 'text-rose-500' : (a.integrityScore ?? 100) < 85 ? 'text-amber-500' : 'text-emerald-500')}>{a.integrityScore ?? 100}</span></td>
                      <td>{a.warningCount}</td>
                      <td className="text-xs">{a.identityStatus.replace('_', ' ')}</td>
                      <td className="text-xs text-slate-500">{formatDateTime(a.submittedAt)}{a.submissionSource === 'timeout' ? ' · timed out' : ''}</td>
                      <td className="pr-5 text-right"><Button size="sm" variant="secondary" onClick={() => setReviewing(a.id)}>Review</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {data.perQuestion.length > 0 && data.metrics.submitted > 0 && (
            <Card className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Question performance</p>
              {data.perQuestion.map((q: any) => (
                <div key={q.questionId} className="grid grid-cols-[40px_1fr_120px] items-center gap-3 text-sm">
                  <span className="font-black text-slate-400">Q{q.position + 1}</span>
                  <span className="truncate" title={q.prompt}>{q.prompt}</span>
                  <div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className={cn('h-full rounded-full', q.averagePercent < 40 ? 'bg-rose-500' : q.averagePercent < 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, q.averagePercent)}%` }} /></div><span className="w-10 text-right text-xs font-bold">{q.averagePercent}%</span></div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      {reviewing && <AttemptReview attemptId={reviewing} onClose={(changed) => { setReviewing(null); if (changed) results.reload(); }} />}
    </div>
  );
};

/** Polls every 10 s. Shows only attempts for this teacher’s test (enforced server-side). */
const LiveMonitor: React.FC<{ testId: string; onReview: (attemptId: string) => void }> = ({ testId, onReview }) => {
  const monitor = useAsync(() => api.get<any>(`tests/${testId}/monitor`), [testId]);
  useEffect(() => {
    const t = window.setInterval(() => monitor.reload(), 10_000);
    return () => window.clearInterval(t);
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps
  const attempts = monitor.data?.attempts ?? [];
  const active = attempts.filter((a: any) => ['calibrating', 'in_progress'].includes(a.status));
  if (monitor.loading && !monitor.data) return <Spinner label="Connecting to live exam…" />;
  return (
    <div className="space-y-4">
      <ErrorNote message={monitor.error} onRetry={monitor.reload} />
      <p className="text-xs text-slate-500">{active.length} student(s) currently in the exam · refreshes every 10 seconds</p>
      {attempts.length === 0 ? <EmptyState icon={<Radio size={32} />} title="Nobody has started yet" /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {attempts.map((a: any) => (
            <Card key={a.id} className={cn('space-y-3', a.escalated && 'border-rose-500/40 bg-rose-500/5', a.riskLevel === 'high' && 'border-rose-500/40')}>
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-bold">{a.student.name}</p><p className="text-xs text-slate-500">{a.student.rollNumber ? `Roll ${a.student.rollNumber}` : ''}</p></div>
                {['calibrating', 'in_progress'].includes(a.status) ? (a.online ? <Badge tone="green"><Wifi size={11} /> online</Badge> : <Badge tone="amber"><WifiOff size={11} /> no signal</Badge>) : <Badge tone="slate"><CheckCircle2 size={11} /> {a.status.replace('_', ' ')}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span>Camera: <b className={a.cameraStatus === 'active' ? 'text-emerald-500' : a.cameraStatus === 'not_required' ? '' : 'text-rose-500'}>{a.cameraStatus.replace('_', ' ')}</b></span>
                <span>Identity: <b>{a.identityStatus.replace('_', ' ')}</b></span>
                <span>Warnings: <b className={a.warningCount ? 'text-amber-500' : ''}>{a.warningCount}</b></span>
                <span>Integrity: <b>{a.integrityScore ?? 100}</b></span>
                {a.remainingSeconds !== null && <span className="col-span-2">Time left: <b>{Math.floor(a.remainingSeconds / 60)}m {a.remainingSeconds % 60}s</b></span>}
              </div>
              {a.lastEvent && <p className="text-[11px] text-slate-500">Last signal: {a.lastEvent.event_type.replace(/_/g, ' ')} · {new Date(a.lastEvent.occurred_at).toLocaleTimeString()}</p>}
              {a.escalated && <p className="flex items-center gap-1 text-xs font-bold text-rose-500"><ShieldAlert size={13} /> Repeated warnings — review recommended</p>}
              <Button size="sm" variant="secondary" onClick={() => onReview(a.id)}>Open timeline</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: 'amber' }> = ({ label, value, tone }) => (
  <div className={cn('rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5', tone === 'amber' && 'border-amber-400/40')}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
);
