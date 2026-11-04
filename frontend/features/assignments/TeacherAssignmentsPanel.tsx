import React, { lazy, Suspense, useState } from 'react';
import { ArrowLeft, Archive, CalendarClock, ClipboardList, Code2, Download, Eye, EyeOff, FileUp, Paperclip, Pencil, Plus, Rocket, Save, Square, Trash2, Undo2, FlaskConical } from 'lucide-react';
import { api, formatDateTime, fromLocalInput, openDownload, toLocalInput } from '../lms/api';
import type { Assignment, LanguageId, Submission, TestCase } from '../lms/types';
import { AVAILABILITY_BADGE, Badge, Button, Card, EmptyState, ErrorNote, Field, inputClass, Modal, Spinner, Toggle, useAsync } from '../lms/ui';
import { ALL_LANGUAGES } from '../tests/QuestionEditor';
import { cn } from '../../lib/utils';
import { useConfirm } from '../../components/ui';

const CodingWorkspace = lazy(() => import('../coding/CodingWorkspace'));
const TYPES: Array<{ id: Assignment['assignmentType']; label: string; hint: string }> = [
  { id: 'text', label: 'Text', hint: 'Students type their answer' },
  { id: 'file', label: 'File upload', hint: 'Students upload files' },
  { id: 'document', label: 'Document', hint: 'PDF / Word report' },
  { id: 'coding', label: 'Programming', hint: 'Uses the coding IDE' },
  { id: 'mixed', label: 'Mixed', hint: 'Text, files and code' },
];
const FILE_TYPES = ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'zip', 'py', 'java', 'c', 'cpp', 'js', 'ts', 'ipynb'];

export const TeacherAssignmentsPanel: React.FC<{ classroomId: string; classroomName: string }> = ({ classroomId, classroomName }) => {
  const askConfirm = useConfirm();
  const list = useAsync(() => api.get<{ assignments: Assignment[] }>(`classrooms/${classroomId}/assignments`), [classroomId]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, confirm?: string) => {
    if (confirm && !(await askConfirm({ title: 'Are you sure?', body: confirm, confirmLabel: 'Continue', tone: /delete|archive/i.test(confirm) ? 'danger' : 'default' }))) return;
    setError(null);
    try { await fn(); list.reload(); } catch (e) { setError((e as Error).message); }
  };

  if (editing) return <AssignmentEditor classroomId={classroomId} assignmentId={editing === 'new' ? null : editing} onClose={() => { setEditing(null); list.reload(); }} />;
  if (reviewing) return <SubmissionsDashboard assignmentId={reviewing} onBack={() => { setReviewing(null); list.reload(); }} />;

  const items = list.data?.assignments ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-xl font-bold">Assignments</h3><p className="text-sm text-slate-500">Homework and projects for {classroomName}. Only enrolled students can see published assignments.</p></div>
        <Button onClick={() => setEditing('new')} icon={<Plus size={14} />}>New assignment</Button>
      </div>
      <ErrorNote message={error || list.error} onRetry={list.error ? list.reload : undefined} />
      {list.loading && !list.data ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon={<ClipboardList size={36} />} title="No assignments yet" body="Create text, file, document, programming or mixed assignments with deadlines and late policies." action={<Button onClick={() => setEditing('new')} icon={<Plus size={14} />}>Create assignment</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2"><Badge tone={AVAILABILITY_BADGE[a.status]?.tone}>{AVAILABILITY_BADGE[a.status]?.label ?? a.status}</Badge><Badge tone="purple">{TYPES.find((t) => t.id === a.assignmentType)?.label}</Badge></div>
              <h4 className="text-lg font-bold">{a.title}</h4>
              <p className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={12} /> {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No deadline'} · {a.totalMarks} marks</p>
              {a.stats && <div className="grid grid-cols-4 gap-1 text-center text-[11px]"><Mini label="Submitted" value={a.stats.submitted} /><Mini label="Pending" value={a.stats.pending} /><Mini label="Late" value={a.stats.late} /><Mini label="Graded" value={a.stats.evaluated} /></div>}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(a.id)} icon={<Pencil size={13} />}>Edit</Button>
                {a.status !== 'draft' && <Button size="sm" variant="secondary" onClick={() => setReviewing(a.id)} icon={<Eye size={13} />}>Submissions</Button>}
                {a.status === 'draft' && <Button size="sm" onClick={() => void act(() => api.post(`assignments/${a.id}/publish`))} icon={<Rocket size={13} />}>Publish</Button>}
                {a.status === 'published' && <Button size="sm" variant="ghost" onClick={() => void act(() => api.post(`assignments/${a.id}/close`), 'Close this assignment? Students will no longer be able to submit.')} icon={<Square size={13} />}>Close</Button>}
                {a.status === 'closed' && <Button size="sm" variant="ghost" onClick={() => void act(() => api.post(`assignments/${a.id}/reopen`))} icon={<Undo2 size={13} />}>Reopen</Button>}
                {a.status === 'draft' ? <Button size="sm" variant="ghost" onClick={() => void act(() => api.del(`assignments/${a.id}`), 'Delete this draft?')} icon={<Trash2 size={13} />}>Delete</Button> : <Button size="sm" variant="ghost" onClick={() => void act(() => api.post(`assignments/${a.id}/archive`), 'Archive this assignment?')} icon={<Archive size={13} />}>Archive</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const Mini: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-xl bg-slate-100 py-1.5 dark:bg-white/5"><p className="font-black">{value}</p><p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p></div>;

/* ------------------------------ Editor ------------------------------ */
type Form = { title: string; description: string; instructions: string; assignmentType: Assignment['assignmentType']; availableFrom: string; dueAt: string; totalMarks: number; latePolicy: Assignment['latePolicy']; acceptedFileTypes: string[]; maxFileSizeMb: number; maxFiles: number; allowResubmission: boolean; languages: LanguageId[]; testCases: TestCase[] };
const emptyForm: Form = { title: '', description: '', instructions: '', assignmentType: 'text', availableFrom: '', dueAt: '', totalMarks: 100, latePolicy: { allowLate: false, penaltyPercentPerDay: 10, maxLateDays: 3 }, acceptedFileTypes: ['pdf', 'docx', 'txt', 'png', 'jpg', 'zip'], maxFileSizeMb: 10, maxFiles: 5, allowResubmission: true, languages: ['python'], testCases: [] };

const AssignmentEditor: React.FC<{ classroomId: string; assignmentId: string | null; onClose: () => void }> = ({ classroomId, assignmentId, onClose }) => {
  const [id, setId] = useState(assignmentId);
  const [form, setForm] = useState<Form>(emptyForm);
  const [detail, setDetail] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(Boolean(assignmentId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hydrate = (a: Assignment) => {
    setDetail(a);
    setForm({ title: a.title, description: a.description ?? '', instructions: a.instructions ?? '', assignmentType: a.assignmentType, availableFrom: toLocalInput(a.availableFrom), dueAt: toLocalInput(a.dueAt), totalMarks: a.totalMarks, latePolicy: a.latePolicy, acceptedFileTypes: a.acceptedFileTypes, maxFileSizeMb: a.maxFileSizeMb, maxFiles: a.maxFiles, allowResubmission: a.allowResubmission, languages: a.coding?.languages ?? ['python'], testCases: (a.testCases ?? []).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput, isHidden: Boolean(t.isHidden), weight: t.weight ?? 1 })) });
  };
  React.useEffect(() => {
    if (!assignmentId) return;
    api.get<Assignment>(`assignments/${assignmentId}`).then(hydrate).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [assignmentId]);

  const coding = form.assignmentType === 'coding' || form.assignmentType === 'mixed';
  const files = ['file', 'document', 'mixed'].includes(form.assignmentType);
  const save = async (publish = false) => {
    setSaving(true); setError(null); setNotice(null);
    try {
      const payload = {
        title: form.title, description: form.description || null, instructions: form.instructions || null, assignmentType: form.assignmentType,
        availableFrom: fromLocalInput(form.availableFrom), dueAt: fromLocalInput(form.dueAt), totalMarks: Number(form.totalMarks), latePolicy: form.latePolicy,
        acceptedFileTypes: form.acceptedFileTypes, maxFileSizeMb: Number(form.maxFileSizeMb), maxFiles: files ? Number(form.maxFiles) : 0, allowResubmission: form.allowResubmission,
        coding: coding ? { languages: form.languages, starterCode: {}, timeLimitMs: 3000, memoryLimitMb: 256 } : null,
        testCases: coding ? form.testCases : [],
      };
      const saved = id ? await api.patch<Assignment>(`assignments/${id}`, payload) : await api.post<Assignment>(`classrooms/${classroomId}/assignments`, payload);
      setId(saved.id);
      hydrate(publish ? await api.post<Assignment>(`assignments/${saved.id}/publish`) : saved);
      setNotice(publish ? 'Published. Enrolled students can now see this assignment.' : 'Saved.');
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const upload = async (file: File) => {
    if (!id) return;
    setError(null);
    try { await api.upload(`assignments/${id}/attachments`, file, file.name); hydrate(await api.get<Assignment>(`assignments/${id}`)); } catch (e) { setError((e as Error).message); }
  };

  if (loading) return <Spinner />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" onClick={onClose} icon={<ArrowLeft size={14} />}>Assignments</Button><h3 className="text-xl font-black">{id ? form.title || 'Assignment' : 'New assignment'}</h3>{detail && <Badge tone={AVAILABILITY_BADGE[detail.status]?.tone}>{detail.status}</Badge>}</div>
      <ErrorNote message={error} />
      {notice && <p role="status" className="rounded-2xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600">{notice}</p>}
      <Card className="space-y-4">
        <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} maxLength={250} /></Field>
        <Field label="Short description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} /></Field>
        <Field label="Instructions"><textarea rows={6} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={inputClass} placeholder="What students must do, how it will be marked, resources to use…" /></Field>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Submission type</p>
          <div className="grid gap-2 sm:grid-cols-5">{TYPES.map((t) => <button key={t.id} type="button" onClick={() => setForm({ ...form, assignmentType: t.id })} className={cn('rounded-2xl border p-3 text-left', form.assignmentType === t.id ? 'border-blue-500 bg-blue-500/10' : 'border-black/10 dark:border-white/10')}><p className="text-sm font-bold">{t.label}</p><p className="text-[11px] text-slate-500">{t.hint}</p></button>)}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Available from" hint="Optional"><input type="datetime-local" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} className={inputClass} /></Field>
          <Field label="Due"><input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className={inputClass} /></Field>
          <Field label="Total marks"><input type="number" min={0} value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: Number(e.target.value) })} className={inputClass} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle checked={form.latePolicy.allowLate} onChange={(v) => setForm({ ...form, latePolicy: { ...form.latePolicy, allowLate: v } })} label="Accept late submissions" description="Marked as late; a penalty can be applied per day." />
          <Toggle checked={form.allowResubmission} onChange={(v) => setForm({ ...form, allowResubmission: v })} label="Allow resubmission before grading" />
          {form.latePolicy.allowLate && <>
            <Field label="Penalty per late day (%)"><input type="number" min={0} max={100} value={form.latePolicy.penaltyPercentPerDay} onChange={(e) => setForm({ ...form, latePolicy: { ...form.latePolicy, penaltyPercentPerDay: Number(e.target.value) } })} className={inputClass} /></Field>
            <Field label="Max late days" hint="0 = no limit"><input type="number" min={0} max={60} value={form.latePolicy.maxLateDays} onChange={(e) => setForm({ ...form, latePolicy: { ...form.latePolicy, maxLateDays: Number(e.target.value) } })} className={inputClass} /></Field>
          </>}
        </div>
        {files && (
          <div className="space-y-3 rounded-2xl border border-black/5 p-4 dark:border-white/10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Accepted files</p>
            <div className="flex flex-wrap gap-1.5">{FILE_TYPES.map((ext) => { const on = form.acceptedFileTypes.includes(ext); return <button key={ext} type="button" onClick={() => setForm({ ...form, acceptedFileTypes: on ? form.acceptedFileTypes.filter((x) => x !== ext) : [...form.acceptedFileTypes, ext] })} className={cn('rounded-full border px-2.5 py-1 font-mono text-[11px]', on ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-black/10 text-slate-500 dark:border-white/10')}>.{ext}</button>; })}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Max size per file (MB)"><input type="number" min={1} max={50} value={form.maxFileSizeMb} onChange={(e) => setForm({ ...form, maxFileSizeMb: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label="Max files"><input type="number" min={1} max={20} value={form.maxFiles} onChange={(e) => setForm({ ...form, maxFiles: Number(e.target.value) })} className={inputClass} /></Field>
            </div>
          </div>
        )}
        {coding && (
          <div className="space-y-3 rounded-2xl border border-black/5 p-4 dark:border-white/10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Languages</p>
            <div className="flex flex-wrap gap-2">{ALL_LANGUAGES.map((l) => { const on = form.languages.includes(l.id); return <button key={l.id} type="button" onClick={() => setForm({ ...form, languages: on ? form.languages.filter((x) => x !== l.id) : [...form.languages, l.id] })} className={cn('rounded-full border px-3 py-1 text-xs font-bold', on ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-black/10 text-slate-500 dark:border-white/10')}>{l.label}</button>; })}</div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Test cases <span className="normal-case tracking-normal text-slate-400">(samples are visible to students; hidden ones are used when you evaluate)</span></p>
            {form.testCases.map((tc, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <textarea rows={2} aria-label="Input" value={tc.input} onChange={(e) => setForm({ ...form, testCases: form.testCases.map((t, j) => (j === i ? { ...t, input: e.target.value } : t)) })} placeholder="stdin" className={cn(inputClass, 'font-mono text-xs')} />
                <textarea rows={2} aria-label="Expected output" value={tc.expectedOutput} onChange={(e) => setForm({ ...form, testCases: form.testCases.map((t, j) => (j === i ? { ...t, expectedOutput: e.target.value } : t)) })} placeholder="expected stdout" className={cn(inputClass, 'font-mono text-xs')} />
                <div className="flex gap-1">
                  <button type="button" onClick={() => setForm({ ...form, testCases: form.testCases.map((t, j) => (j === i ? { ...t, isHidden: !t.isHidden } : t)) })} className={cn('inline-flex items-center gap-1 rounded-lg px-2 text-[10px] font-bold uppercase', tc.isHidden ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'bg-emerald-500/15 text-emerald-600')}>{tc.isHidden ? <><EyeOff size={12} />Hidden</> : <><Eye size={12} />Sample</>}</button>
                  <button type="button" aria-label="Remove" onClick={() => setForm({ ...form, testCases: form.testCases.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setForm({ ...form, testCases: [...form.testCases, { input: '', expectedOutput: '', isHidden: true, weight: 1 }] })}>Add test case</Button>
          </div>
        )}
        {id && (
          <div className="space-y-2 rounded-2xl border border-black/5 p-4 dark:border-white/10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Attachments & resources</p>
            {(detail?.attachments ?? []).map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-sm"><Paperclip size={13} className="text-slate-400" /><span className="flex-1 truncate">{f.name}</span><span className="text-xs text-slate-400">{Math.round(f.size / 1024)} KB</span>
                <button type="button" onClick={() => void openDownload(`assignments/${id}/attachments/${f.id}/download`)} className="rounded p-1 text-slate-400 hover:text-blue-600" aria-label="Download"><Download size={14} /></button>
                <button type="button" onClick={async () => { await api.del(`assignments/${id}/attachments/${f.id}`); hydrate(await api.get<Assignment>(`assignments/${id}`)); }} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label="Remove"><Trash2 size={14} /></button>
              </div>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/20 px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/20"><FileUp size={14} /> Attach a file<input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} /></label>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" loading={saving} onClick={() => void save(false)} icon={<Save size={14} />}>{id ? 'Save' : 'Save draft'}</Button>
          {(!detail || detail.status === 'draft') && <Button loading={saving} onClick={() => void save(true)} icon={<Rocket size={14} />}>Save & publish</Button>}
        </div>
      </Card>
    </div>
  );
};

/* ------------------------------ Submissions ------------------------------ */
const STATUS_TONE: Record<string, 'slate' | 'blue' | 'amber' | 'green' | 'purple'> = { draft: 'slate', submitted: 'blue', late: 'amber', evaluated: 'purple', returned: 'green' };

const SubmissionsDashboard: React.FC<{ assignmentId: string; onBack: () => void }> = ({ assignmentId, onBack }) => {
  const data = useAsync(() => api.get<{ assignment: Assignment; students: Array<{ student: { id: string; name: string; email: string | null; rollNumber: string | null }; submission: Submission | null }> }>(`assignments/${assignmentId}/submissions`), [assignmentId]);
  const [grading, setGrading] = useState<{ submission: Submission; student: { name: string } } | null>(null);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'pending' | 'late' | 'graded'>('all');
  if (data.loading && !data.data) return <Spinner />;
  const rows = data.data?.students ?? [];
  const filtered = rows.filter((r) => filter === 'all' || (filter === 'pending' ? !r.submission || r.submission.status === 'draft' : filter === 'late' ? r.submission?.isLate : filter === 'graded' ? ['evaluated', 'returned'].includes(r.submission?.status ?? '') : ['submitted', 'late'].includes(r.submission?.status ?? '')));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>Assignments</Button><h3 className="text-xl font-black">{data.data?.assignment.title}</h3><span className="text-xs text-slate-500">{data.data?.assignment.dueAt ? `Due ${formatDateTime(data.data.assignment.dueAt)}` : ''}</span></div>
      <ErrorNote message={data.error} onRetry={data.reload} />
      <div className="flex flex-wrap gap-2">{(['all', 'submitted', 'pending', 'late', 'graded'] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest', filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5')}>{f}</button>)}</div>
      {rows.length === 0 ? <EmptyState icon={<ClipboardList size={32} />} title="No students enrolled" /> : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-slate-500"><tr className="border-b border-black/5 dark:border-white/10"><th className="px-5 py-3">Student</th><th>Status</th><th>Submitted</th><th>Files</th><th>Marks</th><th /></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.student.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-5 py-3"><p className="font-bold">{r.student.name}</p><p className="text-xs text-slate-500">{r.student.rollNumber ? `Roll ${r.student.rollNumber}` : r.student.email}</p></td>
                  <td>{r.submission && r.submission.status !== 'draft' ? <Badge tone={STATUS_TONE[r.submission.status]}>{r.submission.status}</Badge> : <Badge tone="slate">{r.submission ? 'working' : 'not started'}</Badge>}</td>
                  <td className="text-xs text-slate-500">{r.submission?.submittedAt ? formatDateTime(r.submission.submittedAt) : '—'}{r.submission?.isLate ? ` · ${r.submission.lateDays}d late` : ''}</td>
                  <td>{r.submission?.files.length ?? 0}</td>
                  <td className="font-bold">{r.submission?.finalScore ?? '—'}</td>
                  <td className="pr-5 text-right">{r.submission && r.submission.status !== 'draft' && <Button size="sm" variant="secondary" onClick={() => setGrading({ submission: r.submission!, student: r.student })}>{['evaluated', 'returned'].includes(r.submission.status) ? 'View' : 'Grade'}</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {grading && data.data && <GradeModal assignment={data.data.assignment} submissionId={grading.submission.id} studentName={grading.student.name} onClose={(changed) => { setGrading(null); if (changed) data.reload(); }} />}
    </div>
  );
};

const GradeModal: React.FC<{ assignment: Assignment; submissionId: string; studentName: string; onClose: (changed: boolean) => void }> = ({ assignment, submissionId, studentName, onClose }) => {
  const detail = useAsync(() => api.get<{ submission: Submission; history: any[] }>(`submissions/${submissionId}`), [submissionId]);
  const [score, setScore] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [waive, setWaive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const s = detail.data?.submission;
  React.useEffect(() => { if (s) { setScore(s.score === null || s.score === undefined ? '' : String(s.score)); setFeedback(s.feedback ?? ''); } }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const grade = async (returnToStudent: boolean) => {
    setBusy('grade'); setError(null);
    try { await api.post(`submissions/${submissionId}/grade`, { score: Number(score), feedback: feedback || null, returnToStudent, waiveLatePenalty: waive }); onClose(true); }
    catch (e) { setError((e as Error).message); setBusy(null); }
  };
  const evaluate = async () => {
    setBusy('eval'); setError(null);
    try { const r = await api.post<any>(`submissions/${submissionId}/evaluate-code`); setEvaluation(r); if (score === '') setScore(String(r.suggestedScore)); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <Modal title={`${studentName} — ${assignment.title}`} onClose={() => onClose(false)} wide>
      {detail.loading && !s ? <Spinner /> : s && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs"><Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge><span className="text-slate-500">Submitted {formatDateTime(s.submittedAt)} · revision {s.revision}</span>{s.isLate && <Badge tone="amber">{s.lateDays} day(s) late · −{s.penaltyPercent}%</Badge>}</div>
          {s.textResponse && <div><p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">Written answer</p><p className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-100 p-4 text-sm dark:bg-white/5">{s.textResponse}</p></div>}
          {s.files.length > 0 && <div className="space-y-1"><p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Files</p>{s.files.map((f) => <button key={f.id} type="button" onClick={() => void openDownload(`submissions/${submissionId}/files/${f.id}/download`)} className="flex w-full items-center gap-2 rounded-xl border border-black/5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><Download size={14} /> {f.name} <span className="ml-auto text-xs text-slate-400">{Math.round(f.size / 1024)} KB</span></button>)}</div>}
          {s.code?.source && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-widest text-slate-500"><Code2 size={12} className="inline" /> Source code ({s.code.language})</p><Button size="sm" variant="secondary" loading={busy === 'eval'} onClick={() => void evaluate()} icon={<FlaskConical size={13} />}>Run all test cases</Button></div>
              <div className="h-80"><Suspense fallback={<p className="text-xs">Loading…</p>}><CodingWorkspace mode="teacher" readOnly languages={[s.code.language]} value={s.code} onChange={() => undefined} runContext={{ contextType: 'teacher_assignment', contextId: assignment.id }} /></Suspense></div>
              {evaluation && <p className="text-sm font-bold">{evaluation.compileError ? 'Compilation failed' : `${evaluation.passed}/${evaluation.total} test cases passed`} · suggested {evaluation.suggestedScore}/{assignment.totalMarks}</p>}
            </div>
          )}
          <ErrorNote message={error} />
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Field label={`Marks / ${assignment.totalMarks}`}><input type="number" min={0} max={assignment.totalMarks} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} className={inputClass} /></Field>
            <Field label="Feedback"><textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputClass} /></Field>
          </div>
          {s.isLate && <Toggle checked={waive} onChange={setWaive} label="Waive late penalty" />}
          {detail.data?.history?.length ? <details className="text-xs"><summary className="cursor-pointer font-bold uppercase tracking-widest text-slate-500">History ({detail.data.history.length})</summary><ul className="mt-2 space-y-1">{detail.data.history.map((h, i) => <li key={i} className="text-slate-500">{formatDateTime(h.created_at)} · {h.action} (rev {h.revision})</li>)}</ul></details> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" loading={busy === 'grade'} disabled={score === ''} onClick={() => void grade(false)}>Save grade (hidden)</Button>
            <Button loading={busy === 'grade'} disabled={score === ''} onClick={() => void grade(true)}>Return to student</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
