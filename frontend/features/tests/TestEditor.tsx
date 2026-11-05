import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, Code2, Eye, FileText, Lock, Plus, Rocket, Save, ShieldCheck, Sparkles } from '../../components/ui/icons-compat';
import { api, fromLocalInput, toLocalInput } from '../lms/api';
import { DEFAULT_CONFIG, DEFAULT_SECURITY, QUESTION_TYPE_LABELS, type EditableQuestion, type QuestionType, type TeacherTestDetail, type TestConfig, type SecurityConfig } from '../lms/types';
import { Badge, Button, Card, ErrorNote, Field, inputClass, Modal, Spinner, Toggle, AVAILABILITY_BADGE } from '../lms/ui';
import { QuestionEditor, blankQuestion, questionProblems } from './QuestionEditor';
import { QuestionView } from '../exam/QuestionView';
import { AIQuestionGenerator } from './AIQuestionGenerator';
import { cn } from '../../lib/utils';
import { useConfirm } from '../../components/ui';

type Props = { classroomId: string; testId: string | null; onClose: (changed: boolean) => void };
type Step = 'details' | 'questions' | 'security' | 'publish';

type Meta = { title: string; subject: string; description: string; instructions: string; durationMinutes: number; passingMarks: number | null; examMode: 'standard' | 'coding'; scheduledStart: string; scheduledEnd: string; config: TestConfig; security: SecurityConfig };
const emptyMeta: Meta = { title: '', subject: '', description: '', instructions: '', durationMinutes: 45, passingMarks: null, examMode: 'standard', scheduledStart: '', scheduledEnd: '', config: DEFAULT_CONFIG, security: DEFAULT_SECURITY };

export const TestEditor: React.FC<Props> = ({ classroomId, testId: initialId, onClose }) => {
  const askConfirm = useConfirm();
  const [testId, setTestId] = useState(initialId);
  const [detail, setDetail] = useState<TeacherTestDetail | null>(null);
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(Boolean(initialId));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirtyQuestions, setDirtyQuestions] = useState(false);
  const [changed, setChanged] = useState(false);
  const [preview, setPreview] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const load = (detailData: TeacherTestDetail) => {
    setDetail(detailData);
    setMeta({ title: detailData.title, subject: detailData.subject ?? '', description: detailData.description ?? '', instructions: detailData.instructions ?? '', durationMinutes: detailData.durationMinutes, passingMarks: detailData.passingMarks, examMode: detailData.examMode, scheduledStart: toLocalInput(detailData.scheduledStart), scheduledEnd: toLocalInput(detailData.scheduledEnd), config: { ...DEFAULT_CONFIG, ...detailData.config }, security: { ...DEFAULT_SECURITY, ...detailData.security, thresholds: { ...DEFAULT_SECURITY.thresholds, ...detailData.security?.thresholds } } });
    setQuestions(detailData.questions);
    setDirtyQuestions(false);
  };

  useEffect(() => {
    if (!initialId) return;
    api.get<TeacherTestDetail>(`tests/${initialId}`).then(load).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [initialId]);

  const locked = Boolean(detail?.questionsLocked);
  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (Number(q.marks) || 0), 0), [questions]);
  const problems = useMemo(() => questions.map(questionProblems), [questions]);
  const invalidCount = problems.filter((p) => p.length).length;

  const metaPayload = () => ({
    title: meta.title.trim(), subject: meta.subject.trim() || null, description: meta.description.trim() || null, instructions: meta.instructions.trim() || null,
    durationMinutes: Number(meta.durationMinutes), passingMarks: meta.passingMarks === null || Number.isNaN(meta.passingMarks) ? null : Number(meta.passingMarks), examMode: meta.examMode,
    scheduledStart: fromLocalInput(meta.scheduledStart), scheduledEnd: fromLocalInput(meta.scheduledEnd), config: meta.config, security: meta.security,
  });

  const run = async (label: string, fn: () => Promise<void>) => {
    setSaving(label); setError(null); setNotice(null);
    try { await fn(); setChanged(true); } catch (e) { setError((e as Error).message); } finally { setSaving(null); }
  };

  const saveDetails = (next?: Step) => run('details', async () => {
    if (meta.title.trim().length < 3) throw new Error('Give the test a title of at least 3 characters.');
    const payload = metaPayload();
    if (!testId) {
      const created = await api.post<{ id: string }>(`classrooms/${classroomId}/tests`, payload);
      setTestId(created.id);
      load(await api.get<TeacherTestDetail>(`tests/${created.id}`));
    } else {
      const { durationMinutes, config, examMode, ...safe } = payload;
      await api.patch(`tests/${testId}`, locked ? safe : payload);
      load(await api.get<TeacherTestDetail>(`tests/${testId}`));
    }
    setNotice('Saved.');
    if (next) setStep(next);
  });

  const saveQuestions = (next?: Step) => run('questions', async () => {
    if (!testId) throw new Error('Save the test details first.');
    if (invalidCount) throw new Error(`Fix ${invalidCount} question${invalidCount === 1 ? '' : 's'} before saving.`);
    const payload = questions.map((q) => ({ ...q, acceptedAnswers: q.acceptedAnswers.map((a) => a.trim()).filter(Boolean), options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })), explanation: q.explanation || null, modelAnswer: q.modelAnswer || null, numericAnswer: q.numericAnswer ?? null }));
    load(await api.put<TeacherTestDetail>(`tests/${testId}/questions`, payload));
    setNotice('Questions saved.');
    if (next) setStep(next);
  });

  const publish = () => run('publish', async () => {
    if (!testId) return;
    if (dirtyQuestions) throw new Error('Save your question changes before publishing.');
    await api.patch(`tests/${testId}`, locked ? { title: meta.title, instructions: meta.instructions || null, security: meta.security, scheduledStart: fromLocalInput(meta.scheduledStart), scheduledEnd: fromLocalInput(meta.scheduledEnd) } : metaPayload());
    await api.post(`tests/${testId}/publish`, { scheduledStart: fromLocalInput(meta.scheduledStart), scheduledEnd: fromLocalInput(meta.scheduledEnd) });
    load(await api.get<TeacherTestDetail>(`tests/${testId}`));
    setNotice(meta.scheduledStart && new Date(meta.scheduledStart) > new Date() ? 'Scheduled. Students will see it when it opens.' : 'Published. Enrolled students can now see this test.');
  });

  const updateQuestion = (i: number, q: EditableQuestion) => { setQuestions((list) => list.map((x, j) => (j === i ? q : x))); setDirtyQuestions(true); };
  const addQuestion = (type: QuestionType) => { setQuestions((list) => [...list, blankQuestion(type)]); setDirtyQuestions(true); };

  if (loading) return <Spinner label="Loading test…" />;

  const steps: Array<{ id: Step; label: string; icon: React.ReactNode }> = [
    { id: 'details', label: 'Details', icon: <FileText size={14} /> },
    { id: 'questions', label: `Questions (${questions.length})`, icon: <Code2 size={14} /> },
    { id: 'security', label: 'Security & proctoring', icon: <ShieldCheck size={14} /> },
    { id: 'publish', label: 'Review & publish', icon: <Rocket size={14} /> },
  ];
  const sec = meta.security;
  const setSec = (patch: Partial<SecurityConfig>) => setMeta((m) => ({ ...m, security: { ...m.security, ...patch } }));
  const setCfg = (patch: Partial<TestConfig>) => setMeta((m) => ({ ...m, config: { ...m.config, ...patch } }));
  const setThreshold = (key: keyof SecurityConfig['thresholds'], value: number) => setSec({ thresholds: { ...sec.thresholds, [key]: value } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => onClose(changed)} icon={<ArrowLeft size={14} />}>Tests</Button>
        <h3 className="text-xl font-semibold">{testId ? meta.title || 'Untitled test' : 'New test'}</h3>
        {detail && <Badge tone={AVAILABILITY_BADGE[detail.availability]?.tone}>{AVAILABILITY_BADGE[detail.availability]?.label}</Badge>}
        {locked && <Badge tone="amber"><Lock size={11} /> Questions locked — students have attempted</Badge>}
        <div className="ml-auto flex gap-2">
          {testId && questions.length > 0 && <Button variant="secondary" icon={<Eye size={14} />} onClick={() => setPreview(true)}>Preview</Button>}
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto" aria-label="Test editor steps">
        {steps.map((s) => <button key={s.id} type="button" disabled={!testId && s.id !== 'details'} onClick={() => setStep(s.id)} className={cn('flex shrink-0 items-center gap-2 rounded-button px-4 py-2 text-meta font-bold disabled:opacity-40', step === s.id ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2 ')}>{s.icon}{s.label}</button>)}
      </nav>

      <ErrorNote message={error} />
      {notice && <p role="status" className="rounded-card bg-success-bg p-3 text-xs font-semibold text-success-ink">{notice}</p>}

      {step === 'details' && (
        <Card className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title"><input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} className={inputClass} placeholder="e.g. Unit 3 — Kinematics" maxLength={250} /></Field>
            <Field label="Subject"><input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} className={inputClass} placeholder="Physics" /></Field>
          </div>
          <Field label="Description"><textarea rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className={inputClass} placeholder="What this test covers" /></Field>
          <Field label="Instructions for students"><textarea rows={4} value={meta.instructions} onChange={(e) => setMeta({ ...meta, instructions: e.target.value })} className={inputClass} placeholder="Rules, allowed materials, how answers are marked…" /></Field>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Duration (minutes)"><input type="number" min={1} max={600} disabled={locked} value={meta.durationMinutes} onChange={(e) => setMeta({ ...meta, durationMinutes: Number(e.target.value) })} className={inputClass} /></Field>
            <Field label="Total marks" hint="Calculated from questions"><input disabled value={totalMarks} className={inputClass} /></Field>
            <Field label="Passing marks"><input type="number" min={0} value={meta.passingMarks ?? ''} onChange={(e) => setMeta({ ...meta, passingMarks: e.target.value === '' ? null : Number(e.target.value) })} className={inputClass} placeholder="Optional" /></Field>
            <Field label="Exam mode"><select disabled={locked} value={meta.examMode} onChange={(e) => setMeta({ ...meta, examMode: e.target.value as Meta['examMode'] })} className={inputClass}><option value="standard">Standard</option><option value="coding">Coding (IDE layout)</option></select></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Opens at" hint="Leave empty to open as soon as you publish"><input type="datetime-local" value={meta.scheduledStart} onChange={(e) => setMeta({ ...meta, scheduledStart: e.target.value })} className={inputClass} /></Field>
            <Field label="Closes at" hint="Attempts end at this time even if their duration is longer"><input type="datetime-local" value={meta.scheduledEnd} onChange={(e) => setMeta({ ...meta, scheduledEnd: e.target.value })} className={inputClass} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Attempts allowed"><input type="number" min={1} max={10} disabled={locked} value={meta.config.attemptLimit} onChange={(e) => setCfg({ attemptLimit: Number(e.target.value) })} className={inputClass} /></Field>
            <Field label="Late network grace (seconds)" hint="Accepts answers already in flight when time runs out"><input type="number" min={0} max={120} disabled={locked} value={meta.config.submissionGraceSeconds} onChange={(e) => setCfg({ submissionGraceSeconds: Number(e.target.value) })} className={inputClass} /></Field>
            <Toggle disabled={locked} checked={meta.config.shuffleQuestions} onChange={(v) => setCfg({ shuffleQuestions: v })} label="Shuffle question order" description="Each student gets a different, stable order." />
            <Toggle disabled={locked} checked={meta.config.shuffleOptions} onChange={(v) => setCfg({ shuffleOptions: v })} label="Shuffle answer options" />
            <Toggle disabled={locked} checked={meta.config.negativeMarking} onChange={(v) => setCfg({ negativeMarking: v })} label="Negative marking" description="Deduct each question’s negative marks for wrong answers." />
            <Toggle disabled={locked} checked={meta.config.allowBackNavigation} onChange={(v) => setCfg({ allowBackNavigation: v })} label="Allow going back to earlier questions" />
            <Toggle checked={meta.config.releaseResultsImmediately} disabled={locked} onChange={(v) => setCfg({ releaseResultsImmediately: v })} label="Show score right after submission" description="Only when every question is auto-graded." />
            <Toggle checked={meta.config.showCorrectAnswers} disabled={locked} onChange={(v) => setCfg({ showCorrectAnswers: v })} label="Show correct answers with results" />
          </div>
          <div className="flex justify-end"><Button loading={saving === 'details'} onClick={() => void saveDetails('questions')} icon={<Save size={14} />}>{testId ? 'Save & continue' : 'Create draft & continue'}</Button></div>
        </Card>
      )}

      {step === 'questions' && (
        <div className="space-y-4">
          {questions.length === 0 && <Card className="text-center text-sm text-ink-2">Add your first question below. Answer keys stay on the server and are never sent to students.</Card>}
          {questions.map((q, i) => (
            <QuestionEditor key={i} question={q} index={i} total={questions.length} locked={locked} testId={testId ?? undefined} negativeMarking={meta.config.negativeMarking}
              onChange={(next) => updateQuestion(i, next)}
              onMove={(dir) => { setQuestions((list) => { const copy = [...list]; const [item] = copy.splice(i, 1); copy.splice(i + dir, 0, item); return copy; }); setDirtyQuestions(true); }}
              onDuplicate={() => { setQuestions((list) => { const copy = [...list]; copy.splice(i + 1, 0, { ...structuredClone(q), id: undefined, testCases: q.testCases.map((t) => ({ ...t, id: undefined })) }); return copy; }); setDirtyQuestions(true); }}
              onRemove={async () => { if (await askConfirm({ title: 'Delete this question?', body: 'It is removed from the test when you save.', confirmLabel: 'Delete question', tone: 'danger' })) { setQuestions((list) => list.filter((_, j) => j !== i)); setDirtyQuestions(true); } }} />
          ))}
          {!locked && (
            <Card className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-meta font-bold text-ink-2"><Plus size={12} className="inline" /> Add</span>
              {(['mcq', 'multiple_select', 'true_false', 'short_answer', 'numerical', 'long_answer', 'coding'] as QuestionType[]).map((t) => <Button key={t} size="sm" variant="secondary" onClick={() => addQuestion(t)}>{QUESTION_TYPE_LABELS[t]}</Button>)}
              <Button size="sm" onClick={() => setAiOpen(true)} icon={<Sparkles size={13} />}>Generate with AI</Button>
            </Card>
          )}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-3 ">
            <span className="text-xs font-bold text-ink-2">{questions.length} questions · {totalMarks} marks {invalidCount ? <span className="text-warning-ink">· {invalidCount} need attention</span> : null} {dirtyQuestions && <span className="text-primary">· unsaved changes</span>}</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={locked} loading={saving === 'questions'} onClick={() => void saveQuestions()} icon={<Save size={14} />}>Save questions</Button>
              <Button disabled={locked && false} onClick={() => (locked || !dirtyQuestions ? setStep('security') : void saveQuestions('security'))}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {step === 'security' && (
        <Card className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle checked={sec.requireFullscreen} onChange={(v) => setSec({ requireFullscreen: v })} label="Full-screen exam" description="Starts in full screen and records exits." />
            <Toggle checked={sec.tabSwitchDetection} onChange={(v) => setSec({ tabSwitchDetection: v })} label="Record tab and window switches" />
            <Toggle checked={sec.blockClipboard} onChange={(v) => setSec({ blockClipboard: v })} label="Block copy, paste and drag-and-drop" description="A deterrent in answer fields and the code editor, not a guarantee." />
            <Toggle checked={sec.requireCamera} onChange={(v) => setSec({ requireCamera: v })} label="Require camera" />
            <Toggle checked={sec.requireIdentityVerification} onChange={(v) => setSec({ requireIdentityVerification: v, requireCamera: v || sec.requireCamera })} label="Verify identity with Face ID before starting" description="Uses each student’s registered Face ID." />
            {sec.requireIdentityVerification && <Toggle checked={sec.livenessCheck} onChange={(v) => setSec({ livenessCheck: v })} label="Liveness check before Face ID" description="Students turn their head to both sides and blink, so a photo can’t be used. Runs on the student’s device." />}
            <Toggle checked={sec.liveProctoring} onChange={(v) => setSec({ liveProctoring: v, requireCamera: v || sec.requireCamera })} label="Live AI proctoring" description="On-device face, head-pose and gaze checks plus periodic identity re-checks." />
          </div>
          {(sec.liveProctoring || sec.requireIdentityVerification) && (
            <div className="space-y-4 rounded-card border border-primary-soft bg-primary-light p-4">
              <p className="text-meta font-bold text-primary">Detection thresholds</p>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Looking away for (s)"><input type="number" min={1} max={60} value={sec.thresholds.lookAwaySeconds} onChange={(e) => setThreshold('lookAwaySeconds', Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Head turn (°)"><input type="number" min={15} max={90} value={sec.thresholds.headYawDegrees} onChange={(e) => setThreshold('headYawDegrees', Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Head tilt up/down (°)"><input type="number" min={10} max={90} value={sec.thresholds.headPitchDegrees} onChange={(e) => setThreshold('headPitchDegrees', Number(e.target.value))} className={inputClass} /></Field>
                <Field label="No face for (s)"><input type="number" min={2} max={120} value={sec.thresholds.faceAbsentSeconds} onChange={(e) => setThreshold('faceAbsentSeconds', Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Multiple faces for (s)"><input type="number" min={1} max={60} value={sec.thresholds.multiFaceSeconds} onChange={(e) => setThreshold('multiFaceSeconds', Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Repeat warning after (s)"><input type="number" min={3} max={300} value={sec.thresholds.cooldownSeconds} onChange={(e) => setThreshold('cooldownSeconds', Number(e.target.value))} className={inputClass} /></Field>
                <Field label="Identity re-check every (s)"><input type="number" min={30} max={1800} value={sec.identityRecheckSeconds} onChange={(e) => setSec({ identityRecheckSeconds: Number(e.target.value) })} className={inputClass} /></Field>
                <Field label="Alert me after warnings"><input type="number" min={1} max={50} value={sec.warningEscalationThreshold} onChange={(e) => setSec({ warningEscalationThreshold: Number(e.target.value) })} className={inputClass} /></Field>
                <Field label="Keep proctoring records (days)"><input type="number" min={1} max={365} value={sec.evidenceRetentionDays} onChange={(e) => setSec({ evidenceRetentionDays: Number(e.target.value) })} className={inputClass} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="If the face service is down"><select value={sec.proctoringFailurePolicy} onChange={(e) => setSec({ proctoringFailurePolicy: e.target.value as SecurityConfig['proctoringFailurePolicy'] })} className={inputClass}><option value="warn">Let students continue, review later</option><option value="manual_review">Continue and flag for manual review</option><option value="block">Block until verified</option></select></Field>
                <Field label="If the camera disconnects"><select value={sec.cameraDisconnectPolicy} onChange={(e) => setSec({ cameraDisconnectPolicy: e.target.value as SecurityConfig['cameraDisconnectPolicy'] })} className={inputClass}><option value="flag">Record it and continue</option><option value="pause">Block the screen until reconnected</option></select></Field>
                <Field label="If full screen is exited"><select value={sec.fullscreenExitPolicy} onChange={(e) => setSec({ fullscreenExitPolicy: e.target.value as SecurityConfig['fullscreenExitPolicy'] })} className={inputClass}><option value="flag">Record and ask to return</option><option value="pause">Record and block until return</option></select></Field>
              </div>
              <p className="text-xs leading-5 text-ink-2">Warnings are review signals for you. They never fail a student automatically. Browser monitoring cannot see other devices or everything on a computer.</p>
            </div>
          )}
          <div className="flex justify-end"><Button loading={saving === 'details'} onClick={() => void saveDetails('publish')} icon={<Save size={14} />}>Save & continue</Button></div>
        </Card>
      )}

      {step === 'publish' && detail && (
        <Card className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Questions" value={String(detail.questions.length)} />
            <Stat label="Total marks" value={String(detail.totalMarks)} />
            <Stat label="Duration" value={`${detail.durationMinutes} min`} />
            <Stat label="Proctoring" value={detail.security.liveProctoring ? 'Live AI' : detail.security.requireIdentityVerification ? 'Face ID' : 'Browser only'} />
          </div>
          <ul className="space-y-2 text-sm">
            <Check ok={detail.questions.length > 0} label="At least one question" />
            <Check ok={!dirtyQuestions} label="All question changes saved" />
            <Check ok={!detail.questions.some((q) => q.type === 'coding' && !q.testCases.length)} label="Coding questions have test cases" />
            <Check ok={!meta.scheduledEnd || new Date(meta.scheduledEnd) > new Date()} label="Close time is in the future" />
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Opens at"><input type="datetime-local" value={meta.scheduledStart} onChange={(e) => setMeta({ ...meta, scheduledStart: e.target.value })} className={inputClass} /></Field>
            <Field label="Closes at"><input type="datetime-local" value={meta.scheduledEnd} onChange={(e) => setMeta({ ...meta, scheduledEnd: e.target.value })} className={inputClass} /></Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => onClose(changed)}>Keep as draft</Button>
            <Button loading={saving === 'publish'} onClick={() => void publish()} icon={meta.scheduledStart && new Date(meta.scheduledStart) > new Date() ? <CalendarClock size={14} /> : <Sparkles size={14} />}>{detail.status === 'published' ? 'Update schedule' : meta.scheduledStart && new Date(meta.scheduledStart) > new Date() ? 'Schedule' : 'Publish now'}</Button>
          </div>
        </Card>
      )}

      {aiOpen && <AIQuestionGenerator subject={meta.subject} onClose={() => setAiOpen(false)} onAdd={(qs) => { setQuestions((list) => [...list, ...qs]); setDirtyQuestions(true); setNotice(`${qs.length} AI suggestion(s) added. Review the answer keys, then save.`); }} />}

      {preview && detail && (
        <Modal title={`Preview — ${meta.title}`} onClose={() => setPreview(false)} wide>
          <p className="mb-4 rounded-button bg-primary-light p-3 text-xs text-primary-dark ">This is what students see. Answer keys and hidden test cases are not part of the student view.</p>
          <div className="space-y-10">
            {detail.questions.map((q, i) => (
              <QuestionView key={q.id ?? i} index={i} attemptId="preview" readOnly blockClipboard={false} onViolation={() => undefined} onChange={() => undefined} response={null}
                question={{ id: q.id ?? String(i), type: q.type, prompt: q.prompt, marks: q.marks, negativeMarks: meta.config.negativeMarking ? q.negativeMarks : 0, options: q.options.map((o, j) => ({ id: o.id ?? String(j), text: o.text })), coding: q.coding ? { languages: q.coding.languages, starterCode: q.coding.starterCode, timeLimitMs: q.coding.timeLimitMs, sampleTestCases: q.testCases.filter((t) => !t.isHidden).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput })) } : null }} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-card border border-line p-4 "><p className="text-meta font-bold text-ink-2">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
);
const Check: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <li className={cn('flex items-center gap-2', ok ? 'text-success-ink' : 'text-warning-ink')}><CheckCircle2 size={15} className={ok ? '' : 'opacity-40'} /> {label}</li>
);
