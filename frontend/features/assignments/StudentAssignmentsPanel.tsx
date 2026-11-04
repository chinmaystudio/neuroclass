import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Download, FileUp, Paperclip, Pencil, Send, Trash2 } from 'lucide-react';
import { api, formatDateTime, openDownload } from '../lms/api';
import type { Assignment, LanguageId, Submission } from '../lms/types';
import { Badge, Button, Card, EmptyState, ErrorNote, inputClass, Spinner, useAsync } from '../lms/ui';

const CodingWorkspace = lazy(() => import('../coding/CodingWorkspace'));
const STATUS: Record<string, { label: string; tone: 'slate' | 'blue' | 'amber' | 'green' | 'purple' | 'red' }> = {
  not_started: { label: 'To do', tone: 'slate' }, draft: { label: 'In progress', tone: 'blue' }, submitted: { label: 'Submitted', tone: 'purple' },
  late: { label: 'Submitted late', tone: 'amber' }, evaluated: { label: 'Being graded', tone: 'purple' }, returned: { label: 'Graded', tone: 'green' }, missing: { label: 'Missing', tone: 'red' },
};

export const StudentAssignmentsPanel: React.FC<{ classroomId: string }> = ({ classroomId }) => {
  const list = useAsync(() => api.get<{ assignments: Assignment[] }>(`classrooms/${classroomId}/assignments`), [classroomId]);
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <StudentAssignmentView assignmentId={open} onBack={() => { setOpen(null); list.reload(); }} />;
  if (list.loading && !list.data) return <Spinner />;
  const items = list.data?.assignments ?? [];
  return (
    <div className="space-y-4">
      <ErrorNote message={list.error} onRetry={list.reload} />
      {items.length === 0 ? <EmptyState icon={<ClipboardList size={36} />} title="No assignments yet" body="Assignments your teacher publishes for this classroom will appear here." /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => {
            const st = STATUS[a.myStatus ?? 'not_started'] ?? STATUS.not_started;
            return (
              <Card key={a.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge>{a.status === 'closed' && <Badge tone="slate">Closed</Badge>}</div>
                <h4 className="text-lg font-bold">{a.title}</h4>
                {a.description && <p className="line-clamp-2 text-xs text-slate-500">{a.description}</p>}
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={12} /> {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No deadline'} · {a.totalMarks} marks</p>
                {a.mySubmission?.finalScore !== null && a.mySubmission?.finalScore !== undefined && <p className="text-sm font-bold">Marks: {a.mySubmission.finalScore} / {a.totalMarks}</p>}
                <Button variant="student" className="mt-auto" onClick={() => setOpen(a.id)}>{a.mySubmission ? 'Open' : 'Start'}</Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StudentAssignmentView: React.FC<{ assignmentId: string; onBack: () => void }> = ({ assignmentId, onBack }) => {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [text, setText] = useState('');
  const [code, setCode] = useState<{ language: LanguageId; source: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    const [detail, mine] = await Promise.all([api.get<Assignment>(`assignments/${assignmentId}`), api.get<{ submission: Submission | null }>(`assignments/${assignmentId}/my-submission`)]);
    setAssignment(detail);
    setSubmission(mine.submission);
    setText(mine.submission?.textResponse ?? '');
    let working = mine.submission?.code ?? null;
    if (['coding', 'mixed'].includes(detail.assignmentType)) {
      // Multi-session coding: the working copy is restored from the server.
      const ws = await api.get<{ workspace: { language: LanguageId; source: string } | null }>(`code/workspace/${assignmentId}`).catch(() => ({ workspace: null }));
      if (ws.workspace && mine.submission?.status !== 'draft') working = { language: ws.workspace.language, source: ws.workspace.source };
    }
    setCode(working);
  }, [assignmentId]);

  useEffect(() => { load().catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, [load]);

  const editable = assignment?.status === 'published' && (!submission || submission.status === 'draft');
  const canReopen = assignment?.status === 'published' && assignment.allowResubmission && submission && ['submitted', 'late'].includes(submission.status);

  const autosave = (patch: { textResponse?: string; code?: { language: LanguageId; source: string } }) => {
    if (!assignment || assignment.status !== 'published') return;
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try { await api.put(`assignments/${assignmentId}/my-submission`, patch); setSaveState('saved'); }
      catch (e) { setSaveState('error'); setError((e as Error).message); }
    }, 900);
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const upload = (file: File) => run('upload', async () => { await api.upload(`assignments/${assignmentId}/my-submission/files`, file, file.name); await load(); });
  const submit = () => run('submit', async () => {
    window.clearTimeout(timer.current);
    await api.put(`assignments/${assignmentId}/my-submission`, { ...(text ? { textResponse: text } : {}), ...(code ? { code } : {}) });
    await api.post(`assignments/${assignmentId}/my-submission/submit`);
    await load();
  });

  if (loading) return <Spinner />;
  if (!assignment) return <ErrorNote message={error ?? 'Assignment not found.'} />;
  const type = assignment.assignmentType;
  const st = submission ? STATUS[submission.status] : STATUS.not_started;
  const overdue = assignment.dueAt && new Date(assignment.dueAt) < new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Assignments</Button><h3 className="text-xl font-black">{assignment.title}</h3><Badge tone={st.tone}>{st.label}</Badge></div>
      <Card className="space-y-3">
        <p className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><CalendarClock size={12} /> {assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt)}` : 'No deadline'}</span><span>{assignment.totalMarks} marks</span>{overdue && (assignment.latePolicy.allowLate ? <Badge tone="amber">Late work accepted · −{assignment.latePolicy.penaltyPercentPerDay}%/day</Badge> : <Badge tone="red">Deadline passed</Badge>)}</p>
        {assignment.instructions && <p className="whitespace-pre-wrap text-sm leading-6">{assignment.instructions}</p>}
        {(assignment.attachments ?? []).length > 0 && <div className="space-y-1">{assignment.attachments!.map((f) => <button key={f.id} type="button" onClick={() => void openDownload(`assignments/${assignmentId}/attachments/${f.id}/download`)} className="flex items-center gap-2 text-sm text-purple-600 hover:underline"><Paperclip size={13} /> {f.name}</button>)}</div>}
      </Card>

      {submission?.status === 'returned' && (
        <Card className="space-y-2 border-emerald-500/30 bg-emerald-500/5">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-600"><CheckCircle2 size={16} /> Graded: {submission.finalScore} / {assignment.totalMarks}{submission.penaltyPercent ? ` (late penalty −${submission.penaltyPercent}%)` : ''}</p>
          {submission.feedback && <p className="whitespace-pre-wrap text-sm">{submission.feedback}</p>}
        </Card>
      )}

      <ErrorNote message={error} />

      {['text', 'mixed', 'document'].includes(type) && (
        <Card className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{type === 'document' ? 'Notes for your teacher (optional)' : 'Your answer'}</p>
          <textarea rows={type === 'document' ? 3 : 10} disabled={!editable} value={text} onChange={(e) => { setText(e.target.value); autosave({ textResponse: e.target.value }); }} className={inputClass} placeholder="Write here. Your work saves automatically." />
        </Card>
      )}

      {['file', 'document', 'mixed'].includes(type) && (
        <Card className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Files · {assignment.acceptedFileTypes.map((e) => `.${e}`).join(', ')} · up to {assignment.maxFileSizeMb} MB each, {assignment.maxFiles} max</p>
          {(submission?.files ?? []).map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-black/5 px-3 py-2 text-sm dark:border-white/10"><Paperclip size={13} /><span className="flex-1 truncate">{f.name}</span><span className="text-xs text-slate-400">{Math.round(f.size / 1024)} KB</span>
              <button type="button" aria-label="Download" onClick={() => void openDownload(`assignments/${assignmentId}/my-submission/files/${f.id}/download`)} className="p-1 text-slate-400 hover:text-purple-600"><Download size={14} /></button>
              {editable && <button type="button" aria-label="Remove" onClick={() => void run('del', async () => { await api.del(`assignments/${assignmentId}/my-submission/files/${f.id}`); await load(); })} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
            </div>
          ))}
          {editable && (submission?.files.length ?? 0) < assignment.maxFiles && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/20 px-4 py-3 text-xs font-bold text-slate-500 dark:border-white/20">{busy === 'upload' ? 'Uploading…' : <><FileUp size={14} /> Upload a file</>}
              <input type="file" className="sr-only" accept={assignment.acceptedFileTypes.map((e) => `.${e}`).join(',')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            </label>
          )}
        </Card>
      )}

      {['coding', 'mixed'].includes(type) && assignment.coding && (
        <div className="h-[70vh] min-h-[520px]">
          <Suspense fallback={<Spinner label="Loading the coding workspace…" />}>
            <CodingWorkspace
              mode="assignment"
              languages={assignment.coding.languages}
              starterCode={assignment.coding.starterCode}
              value={code}
              onChange={(v) => { setCode(v); if (editable) autosave({ code: v }); else if (canReopen) { setSaveState('saving'); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { api.put('code/workspace', { assignmentId, ...v }).then(() => setSaveState('saved')).catch(() => setSaveState('error')); }, 900); } }}
              runContext={{ contextType: 'assignment', contextId: assignmentId }}
              sampleTestCases={(assignment.testCases ?? []).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput }))}
              readOnly={!editable && !canReopen}
              saveState={saveState}
            />
          </Suspense>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saveState !== 'idle' && editable && <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : 'Not saved'}</span>}
        {canReopen && <Button variant="secondary" loading={busy === 'reopen'} onClick={() => void run('reopen', async () => { await api.post(`assignments/${assignmentId}/my-submission/reopen`); await load(); })} icon={<Pencil size={14} />}>Edit submission</Button>}
        {editable && <Button variant="student" loading={busy === 'submit'} onClick={() => { if (window.confirm(assignment.allowResubmission ? 'Submit your work? You can edit it again until it is graded.' : 'Submit your work? You will not be able to change it.')) void submit(); }} icon={<Send size={14} />}>{submission?.revision ? 'Resubmit' : 'Submit'}</Button>}
      </div>
      {submission?.submittedAt && <p className="text-right text-xs text-slate-500">Last submitted {formatDateTime(submission.submittedAt)}{submission.isLate ? ' (late)' : ''}</p>}
    </div>
  );
};
