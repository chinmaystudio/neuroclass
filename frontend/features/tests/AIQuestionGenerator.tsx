import React, { useState } from 'react';
import { CheckSquare, Sparkles, Square } from '../../components/ui/icons-compat';
import { api } from '../lms/api';
import type { EditableQuestion } from '../lms/types';
import { Button, ErrorNote, Field, inputClass, Modal } from '../lms/ui';
import { blankQuestion } from './QuestionEditor';

/**
 * AI-generated questions are CANDIDATES. Nothing is added to the test until the
 * teacher selects, reviews and saves them (ported from test_creation's
 * "teacher-reviewed generation" rule).
 */
type Generated = { text?: string; question?: string; type?: string; marks?: number; options?: string[] | null; correctAnswer?: string; explanation?: string };

function toEditable(g: Generated): EditableQuestion {
  const prompt = String(g.text ?? g.question ?? '').trim();
  const options = Array.isArray(g.options) ? g.options.filter(Boolean) : [];
  const answer = String(g.correctAnswer ?? '').trim();
  if (options.length >= 2) {
    const q = blankQuestion('mcq');
    q.prompt = prompt;
    q.marks = Number(g.marks) || 1;
    q.options = options.map((text) => ({ text, isCorrect: text.trim().toLowerCase() === answer.toLowerCase() }));
    if (!q.options.some((o) => o.isCorrect)) q.options[0].isCorrect = true; // teacher must confirm
    q.explanation = g.explanation ?? '';
    return q;
  }
  const short = answer.length > 0 && answer.length <= 120;
  const q = blankQuestion(short ? 'short_answer' : 'long_answer');
  q.prompt = prompt;
  q.marks = Number(g.marks) || (short ? 1 : 5);
  if (short) q.acceptedAnswers = [answer];
  q.modelAnswer = answer;
  q.explanation = g.explanation ?? '';
  return q;
}

export const AIQuestionGenerator: React.FC<{ subject: string; onAdd: (questions: EditableQuestion[]) => void; onClose: () => void }> = ({ subject, onAdd, onClose }) => {
  const [topic, setTopic] = useState('');
  const [subj, setSubj] = useState(subject || 'General');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [count, setCount] = useState(5);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EditableQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.postLegacy<{ test: { questions: Generated[] } }>('/api/ai/generate-test', { topic, subject: subj, difficulty, questionCount: count, durationMins: 30, totalMarks: Math.max(count, count * 2), instructions: instructions || undefined });
      const list = (res.test?.questions ?? []).map(toEditable).filter((q) => q.prompt);
      setCandidates(list);
      setSelected(new Set(list.map((_, i) => i)));
      if (!list.length) setError('The AI returned no usable questions. Try a more specific topic.');
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };

  return (
    <Modal title="Generate questions with AI" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Topic" className="md:col-span-2"><input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} placeholder="e.g. Newton's laws of motion" /></Field>
          <Field label="Subject"><input value={subj} onChange={(e) => setSubj(e.target.value)} className={inputClass} /></Field>
          <Field label="Difficulty"><select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className={inputClass}><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
          <Field label="How many"><input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputClass} /></Field>
          <Field label="Extra instructions" className="md:col-span-3"><input value={instructions} onChange={(e) => setInstructions(e.target.value)} className={inputClass} placeholder="Optional, e.g. focus on numerical problems" /></Field>
        </div>
        <ErrorNote message={error} />
        <Button loading={loading} disabled={topic.trim().length < 2} onClick={() => void generate()} icon={<Sparkles size={14} />}>{candidates.length ? 'Generate again' : 'Generate'}</Button>
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-ink-2">Review each suggestion. Selected questions are added to your test as editable drafts — check every answer key before saving.</p>
            {candidates.map((q, i) => (
              <button key={i} type="button" onClick={() => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="flex w-full items-start gap-3 rounded-card border border-line p-3 text-left text-sm hover:bg-surface-2 ">
                {selected.has(i) ? <CheckSquare size={18} className="mt-0.5 shrink-0 text-primary" /> : <Square size={18} className="mt-0.5 shrink-0 text-ink-2" />}
                <span className="min-w-0"><span className="block font-semibold">{q.prompt}</span>
                  {q.options.length > 0 && <span className="mt-1 block text-xs text-ink-2">{q.options.map((o) => `${o.isCorrect ? '✓ ' : ''}${o.text}`).join(' · ')}</span>}
                  {q.acceptedAnswers.length > 0 && <span className="mt-1 block text-xs text-ink-2">Answer: {q.acceptedAnswers[0]}</span>}
                </span>
              </button>
            ))}
            <div className="flex justify-end"><Button disabled={!selected.size} onClick={() => { onAdd(candidates.filter((_, i) => selected.has(i))); onClose(); }}>Add {selected.size} question{selected.size === 1 ? '' : 's'}</Button></div>
          </div>
        )}
      </div>
    </Modal>
  );
};
