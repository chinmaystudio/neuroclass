import React, { Suspense, lazy, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { EditableQuestion, LanguageId, QuestionType } from '../lms/types';
import { QUESTION_TYPE_LABELS } from '../lms/types';
import { Button, Field, inputClass, Toggle } from '../lms/ui';
import { cn } from '../../lib/utils';

const CodingWorkspace = lazy(() => import('../coding/CodingWorkspace'));

export const ALL_LANGUAGES: Array<{ id: LanguageId; label: string }> = [
  { id: 'python', label: 'Python 3' }, { id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' }, { id: 'java', label: 'Java' }, { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' }, { id: 'csharp', label: 'C#' }, { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' }, { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' }, { id: 'kotlin', label: 'Kotlin' }, { id: 'swift', label: 'Swift' },
];

export function blankQuestion(type: QuestionType): EditableQuestion {
  const base: EditableQuestion = { type, prompt: '', options: [], marks: type === 'coding' ? 10 : type === 'long_answer' ? 5 : 1, negativeMarks: 0, explanation: '', acceptedAnswers: [], caseSensitive: false, numericAnswer: null, numericTolerance: 0, partialCredit: false, modelAnswer: '', coding: null, testCases: [] };
  if (type === 'mcq' || type === 'multiple_select') base.options = [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }];
  if (type === 'true_false') base.options = [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }];
  if (type === 'coding') { base.coding = { languages: ['python', 'cpp', 'java'], starterCode: {}, timeLimitMs: 3000, memoryLimitMb: 256 }; base.testCases = [{ input: '', expectedOutput: '', isHidden: false, weight: 1 }, { input: '', expectedOutput: '', isHidden: true, weight: 1 }]; }
  return base;
}

/** Client-side checks mirror the server schema so teachers see problems before saving. */
export function questionProblems(q: EditableQuestion): string[] {
  const problems: string[] = [];
  if (!q.prompt.trim()) problems.push('Enter the question text.');
  if (['mcq', 'multiple_select'].includes(q.type)) {
    if (q.options.filter((o) => o.text.trim()).length < 2) problems.push('Add at least two options.');
    if (q.options.some((o) => !o.text.trim())) problems.push('Remove or fill empty options.');
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (!correct) problems.push('Mark the correct option.');
    if (q.type === 'mcq' && correct > 1) problems.push('Single choice allows one correct option.');
  }
  if (q.type === 'numerical' && (q.numericAnswer === null || q.numericAnswer === undefined || Number.isNaN(q.numericAnswer))) problems.push('Enter the correct numerical answer.');
  if (['short_answer', 'fill_blank'].includes(q.type) && !q.acceptedAnswers.filter((a) => a.trim()).length) problems.push('Add at least one accepted answer.');
  if (q.type === 'coding') {
    if (!q.coding?.languages.length) problems.push('Choose at least one language.');
    if (!q.testCases.length) problems.push('Add at least one test case.');
  }
  if (q.negativeMarks > q.marks) problems.push('Negative marks cannot exceed marks.');
  return problems;
}

type Props = {
  question: EditableQuestion;
  index: number;
  total: number;
  locked: boolean;
  testId?: string;
  onChange: (q: EditableQuestion) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  negativeMarking: boolean;
};

export const QuestionEditor: React.FC<Props> = ({ question: q, index, total, locked, testId, onChange, onMove, onDuplicate, onRemove, negativeMarking }) => {
  const [showReference, setShowReference] = useState(false);
  const [reference, setReference] = useState<{ language: LanguageId; source: string } | null>(null);
  const set = (patch: Partial<EditableQuestion>) => onChange({ ...q, ...patch });
  const problems = questionProblems(q);

  const setOption = (i: number, patch: Partial<EditableQuestion['options'][number]>) => {
    const options = q.options.map((o, j) => {
      if (j !== i) return (patch.isCorrect && q.type !== 'multiple_select') ? { ...o, isCorrect: false } : o;
      return { ...o, ...patch };
    });
    set({ options });
  };

  return (
    <article className="space-y-4 rounded-3xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">Q{index + 1}</span>
        <select aria-label="Question type" disabled={locked} value={q.type} onChange={(e) => onChange({ ...blankQuestion(e.target.value as QuestionType), prompt: q.prompt, marks: q.marks })} className="rounded-lg border border-black/10 bg-slate-50 px-2 py-1.5 text-xs font-bold dark:border-white/10 dark:bg-black/30">
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).filter((t) => t !== 'file_upload').map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
        </select>
        {problems.length > 0 && <span className="text-[11px] font-semibold text-amber-600">{problems[0]}</span>}
        <div className="ml-auto flex gap-1">
          <IconButton label="Move up" disabled={locked || index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} /></IconButton>
          <IconButton label="Move down" disabled={locked || index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14} /></IconButton>
          <IconButton label="Duplicate question" disabled={locked} onClick={onDuplicate}><Copy size={14} /></IconButton>
          <IconButton label="Delete question" disabled={locked} onClick={onRemove}><Trash2 size={14} /></IconButton>
        </div>
      </header>

      <textarea aria-label="Question text" disabled={locked} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={q.type === 'coding' ? 5 : 3} placeholder={q.type === 'coding' ? 'Describe the problem, input format, output format and constraints.' : 'Question text'} className={inputClass} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Marks"><input type="number" min={0} max={1000} step={0.5} disabled={locked} value={q.marks} onChange={(e) => set({ marks: Number(e.target.value) })} className={inputClass} /></Field>
        {negativeMarking && !['long_answer', 'coding'].includes(q.type) && <Field label="Negative marks" hint="Deducted for a wrong answer"><input type="number" min={0} step={0.25} disabled={locked} value={q.negativeMarks} onChange={(e) => set({ negativeMarks: Number(e.target.value) })} className={inputClass} /></Field>}
      </div>

      {['mcq', 'multiple_select'].includes(q.type) && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Options <span className="normal-case tracking-normal text-slate-400">— {q.type === 'mcq' ? 'select the correct one' : 'tick every correct option'}</span></p>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type={q.type === 'mcq' ? 'radio' : 'checkbox'} name={`correct-${index}`} aria-label={`Option ${i + 1} is correct`} disabled={locked} checked={o.isCorrect} onChange={(e) => setOption(i, { isCorrect: e.target.checked })} className="h-4 w-4 accent-blue-600" />
              <input aria-label={`Option ${i + 1}`} disabled={locked} value={o.text} onChange={(e) => setOption(i, { text: e.target.value })} placeholder={`Option ${String.fromCharCode(65 + i)}`} className={inputClass} />
              <IconButton label="Remove option" disabled={locked || q.options.length <= 2} onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}><Trash2 size={13} /></IconButton>
            </div>
          ))}
          {!locked && q.options.length < 12 && <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => set({ options: [...q.options, { text: '', isCorrect: false }] })}>Add option</Button>}
          {q.type === 'multiple_select' && <Toggle checked={q.partialCredit} disabled={locked} onChange={(v) => set({ partialCredit: v })} label="Partial credit" description="Award marks in proportion to correct selections, minus wrong selections." />}
        </div>
      )}

      {q.type === 'true_false' && (
        <div className="flex gap-3">
          {['True', 'False'].map((label, i) => (
            <label key={label} className={cn('flex flex-1 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-bold', q.options[i]?.isCorrect ? 'border-blue-500 bg-blue-500/10' : 'border-black/10 dark:border-white/10')}>
              <input type="radio" disabled={locked} name={`tf-${index}`} checked={Boolean(q.options[i]?.isCorrect)} onChange={() => set({ options: [{ text: 'True', isCorrect: i === 0 }, { text: 'False', isCorrect: i === 1 }] })} className="accent-blue-600" /> {label} is correct
            </label>
          ))}
        </div>
      )}

      {q.type === 'numerical' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Correct answer"><input type="number" step="any" disabled={locked} value={q.numericAnswer ?? ''} onChange={(e) => set({ numericAnswer: e.target.value === '' ? null : Number(e.target.value) })} className={inputClass} /></Field>
          <Field label="Tolerance (±)" hint="0 requires an exact match"><input type="number" min={0} step="any" disabled={locked} value={q.numericTolerance} onChange={(e) => set({ numericTolerance: Number(e.target.value) })} className={inputClass} /></Field>
        </div>
      )}

      {['short_answer', 'fill_blank'].includes(q.type) && (
        <div className="space-y-2">
          <Field label="Accepted answers" hint="One per line. Spacing differences are ignored. Unmatched answers are sent to you for review instead of being marked wrong.">
            <textarea disabled={locked} rows={3} value={q.acceptedAnswers.join('\n')} onChange={(e) => set({ acceptedAnswers: e.target.value.split('\n') })} className={inputClass} />
          </Field>
          <Toggle checked={q.caseSensitive} disabled={locked} onChange={(v) => set({ caseSensitive: v })} label="Case sensitive" />
        </div>
      )}

      {q.type === 'long_answer' && (
        <Field label="Model answer / rubric (teacher only)"><textarea disabled={locked} rows={3} value={q.modelAnswer ?? ''} onChange={(e) => set({ modelAnswer: e.target.value })} className={inputClass} placeholder="Shown to you while grading. Shown to students only if you enable correct answers." /></Field>
      )}

      {q.type === 'coding' && q.coding && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Allowed languages</p>
            <div className="flex flex-wrap gap-2">
              {ALL_LANGUAGES.map((l) => {
                const on = q.coding!.languages.includes(l.id);
                return <button key={l.id} type="button" disabled={locked} onClick={() => set({ coding: { ...q.coding!, languages: on ? q.coding!.languages.filter((x) => x !== l.id) : [...q.coding!.languages, l.id] } })} className={cn('rounded-full border px-3 py-1 text-xs font-bold', on ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-black/10 text-slate-500 dark:border-white/10')}>{l.label}</button>;
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Time limit per test (ms)"><input type="number" min={500} max={10000} step={500} disabled={locked} value={q.coding.timeLimitMs} onChange={(e) => set({ coding: { ...q.coding!, timeLimitMs: Number(e.target.value) } })} className={inputClass} /></Field>
            <Field label="Memory limit (MB)"><input type="number" min={32} max={512} step={32} disabled={locked} value={q.coding.memoryLimitMb} onChange={(e) => set({ coding: { ...q.coding!, memoryLimitMb: Number(e.target.value) } })} className={inputClass} /></Field>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Test cases <span className="normal-case tracking-normal text-slate-400">— visible cases are samples students can run; hidden cases are only run by the server after submission</span></p>
            {q.testCases.map((tc, i) => (
              <div key={i} className="grid gap-2 rounded-2xl border border-black/5 p-3 dark:border-white/10 md:grid-cols-[1fr_1fr_auto]">
                <textarea aria-label={`Test ${i + 1} input`} disabled={locked} rows={2} value={tc.input} onChange={(e) => set({ testCases: q.testCases.map((t, j) => (j === i ? { ...t, input: e.target.value } : t)) })} placeholder="stdin" className={cn(inputClass, 'font-mono text-xs')} />
                <textarea aria-label={`Test ${i + 1} expected output`} disabled={locked} rows={2} value={tc.expectedOutput} onChange={(e) => set({ testCases: q.testCases.map((t, j) => (j === i ? { ...t, expectedOutput: e.target.value } : t)) })} placeholder="expected stdout" className={cn(inputClass, 'font-mono text-xs')} />
                <div className="flex items-center gap-1 md:flex-col md:items-stretch">
                  <button type="button" disabled={locked} onClick={() => set({ testCases: q.testCases.map((t, j) => (j === i ? { ...t, isHidden: !t.isHidden } : t)) })} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase', tc.isHidden ? 'bg-slate-900 text-white dark:bg-white dark:text-black' : 'bg-emerald-500/15 text-emerald-600')}>{tc.isHidden ? <><EyeOff size={12} /> Hidden</> : <><Eye size={12} /> Sample</>}</button>
                  <input type="number" aria-label="Weight" title="Weight" min={0.5} max={100} step={0.5} disabled={locked} value={tc.weight} onChange={(e) => set({ testCases: q.testCases.map((t, j) => (j === i ? { ...t, weight: Number(e.target.value) } : t)) })} className="w-16 rounded-lg border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10" />
                  <IconButton label="Remove test case" disabled={locked} onClick={() => set({ testCases: q.testCases.filter((_, j) => j !== i) })}><Trash2 size={13} /></IconButton>
                </div>
              </div>
            ))}
            {!locked && q.testCases.length < 50 && <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => set({ testCases: [...q.testCases, { input: '', expectedOutput: '', isHidden: true, weight: 1 }] })}>Add test case</Button>}
          </div>
          {testId && q.id && (
            <div>
              <Button size="sm" variant="secondary" onClick={() => setShowReference((v) => !v)}>{showReference ? 'Hide' : 'Check test cases with a reference solution'}</Button>
              {showReference && (
                <div className="mt-3 h-[480px]">
                  <Suspense fallback={<p className="text-xs text-slate-500">Loading editor…</p>}>
                    <CodingWorkspace mode="teacher" languages={q.coding.languages} value={reference} onChange={setReference} runContext={{ contextType: 'teacher_question', contextId: testId, questionId: q.id }} />
                  </Suspense>
                  <p className="mt-1 text-[11px] text-slate-400">Runs against the saved test cases. Save the test first after editing cases.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-slate-500">Explanation (optional)</summary>
        <textarea disabled={locked} rows={2} value={q.explanation ?? ''} onChange={(e) => set({ explanation: e.target.value })} className={cn(inputClass, 'mt-2')} placeholder="Shown to students after results are released if you allow correct answers." />
      </details>
    </article>
  );
};

const IconButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white">{children}</button>
);
