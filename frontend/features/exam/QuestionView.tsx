import React, { Suspense, lazy } from 'react';
import type { StudentQuestion, LanguageId } from '../lms/types';
import { QUESTION_TYPE_LABELS } from '../lms/types';
import { cn } from '../../lib/utils';

const CodingWorkspace = lazy(() => import('../coding/CodingWorkspace'));

type Props = {
  question: StudentQuestion;
  index: number;
  response: any;
  onChange: (response: unknown, debounceMs?: number) => void;
  attemptId: string;
  blockClipboard: boolean;
  onViolation: (type: 'clipboard_blocked' | 'context_menu_blocked' | 'drop_blocked') => void;
  saveState?: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
  readOnly?: boolean;
};

export const QuestionView: React.FC<Props> = ({ question, index, response, onChange, attemptId, blockClipboard, onViolation, saveState, readOnly }) => {
  const selected: string[] = response?.optionIds ?? [];
  const toggle = (id: string) => {
    if (question.type === 'multiple_select') onChange({ optionIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] }, 300);
    else onChange({ optionIds: [id] }, 150);
  };
  const block = (e: React.ClipboardEvent | React.DragEvent) => {
    if (!blockClipboard) return;
    e.preventDefault();
    onViolation(e.type === 'drop' ? 'drop_blocked' : 'clipboard_blocked');
  };

  return (
    <section aria-labelledby={`q-${question.id}`} className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-primary-light px-3 py-1 text-meta font-bold text-primary ">Question {index + 1}</span>
        <span className="text-meta font-bold text-ink-2">{QUESTION_TYPE_LABELS[question.type]}</span>
        <span className="ml-auto text-xs font-bold text-ink-2">{question.marks} mark{question.marks === 1 ? '' : 's'}{question.negativeMarks ? ` · −${question.negativeMarks} if wrong` : ''}</span>
      </header>
      <h2 id={`q-${question.id}`} className="whitespace-pre-wrap text-base font-semibold leading-7 text-ink sm:text-lg">{question.prompt}</h2>

      {['mcq', 'true_false', 'multiple_select'].includes(question.type) && (
        <div role={question.type === 'multiple_select' ? 'group' : 'radiogroup'} aria-labelledby={`q-${question.id}`} className="space-y-2.5">
          {question.type === 'multiple_select' && <p className="text-xs text-ink-2">Select all that apply.</p>}
          {question.options.map((option, i) => {
            const checked = selected.includes(option.id);
            return (
              <label key={option.id} className={cn('flex cursor-pointer items-start gap-3 rounded-card border p-4 text-sm transition-colors', checked ? 'border-primary bg-primary-light' : 'border-line hover:border-primary-soft ', readOnly && 'cursor-default')}>
                <input type={question.type === 'multiple_select' ? 'checkbox' : 'radio'} name={`q-${question.id}`} checked={checked} disabled={readOnly} onChange={() => toggle(option.id)} className="mt-0.5 h-4 w-4 accent-purple-600" />
                <span className="font-mono text-xs font-bold text-ink-2">{String.fromCharCode(65 + i)}</span>
                <span className="whitespace-pre-wrap leading-6">{option.text}</span>
              </label>
            );
          })}
          {selected.length > 0 && !readOnly && <button type="button" onClick={() => onChange(null, 0)} className="text-xs font-semibold text-ink-2 underline">Clear answer</button>}
        </div>
      )}

      {question.type === 'numerical' && (
        <input type="text" inputMode="decimal" aria-label="Your numerical answer" value={response?.value ?? ''} disabled={readOnly} onChange={(e) => onChange({ value: e.target.value.trim() }, 500)} onPaste={block} onDrop={block} className="w-full max-w-xs rounded-button border border-line bg-surface px-4 py-3 font-mono text-lg outline-none focus:border-primary " placeholder="e.g. 9.81" />
      )}

      {['short_answer', 'fill_blank'].includes(question.type) && (
        <input type="text" aria-label="Your answer" value={response?.text ?? ''} disabled={readOnly} maxLength={2000} onChange={(e) => onChange({ text: e.target.value }, 700)} onPaste={block} onDrop={block} className="w-full rounded-button border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary " placeholder="Type your answer" />
      )}

      {question.type === 'long_answer' && (
        <div>
          <textarea aria-label="Your answer" value={response?.text ?? ''} disabled={readOnly} rows={12} onChange={(e) => onChange({ text: e.target.value }, 900)} onPaste={block} onDrop={block} className="w-full rounded-card border border-line bg-surface p-4 text-sm leading-6 outline-none focus:border-primary " placeholder="Write your answer" />
          <p className="mt-1 text-right text-meta text-ink-2">{(response?.text ?? '').trim().split(/\s+/).filter(Boolean).length} words</p>
        </div>
      )}

      {question.type === 'file_upload' && (
        <p className="rounded-card border border-dashed border-line p-4 text-sm text-ink-2 ">File-upload answers are collected through classroom assignments. Ask your teacher if this question needs a file.</p>
      )}

      {question.type === 'coding' && question.coding && (
        <div className="h-[70vh] min-h-[520px]">
          <Suspense fallback={<div className="rounded-card border border-line p-6 text-sm text-ink-2 ">Loading the coding workspace…</div>}>
            <CodingWorkspace
              mode="exam"
              languages={question.coding.languages as LanguageId[]}
              starterCode={question.coding.starterCode}
              value={response?.source !== undefined ? response : null}
              onChange={(value) => onChange(value, 1200)}
              runContext={{ contextType: 'test_attempt', contextId: attemptId, questionId: question.id }}
              sampleTestCases={question.coding.sampleTestCases}
              blockClipboard={blockClipboard}
              onViolation={onViolation}
              saveState={saveState}
              readOnly={readOnly}
            />
          </Suspense>
        </div>
      )}
    </section>
  );
};
