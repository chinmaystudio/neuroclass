import React, { useState } from 'react';
import { 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  X, 
  Clock, 
  Star, 
  Settings as SettingsIcon,
  Check,
  Image as ImageIcon
} from 'lucide-react';
import { Question, QuestionType, Option } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface QuestionCardProps {
  key?: string;
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  onRemove: () => void;
  index: number;
}

export default function QuestionCard({ question, onUpdate, onRemove, index }: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const addOption = () => {
    const newOption: Option = {
      id: uuidv4(),
      text: `Option ${question.options.length + 1}`,
      isCorrect: false
    };
    onUpdate({ options: [...question.options, newOption] });
  };

  const removeOption = (id: string) => {
    onUpdate({ options: question.options.filter(o => o.id !== id) });
  };

  const updateOption = (id: string, text: string) => {
    onUpdate({
      options: question.options.map(o => o.id === id ? { ...o, text } : o)
    });
  };

  const toggleCorrect = (id: string) => {
    if (question.type === QuestionType.SingleChoice || question.type === QuestionType.TrueFalse) {
      onUpdate({
        options: question.options.map(o => ({ ...o, isCorrect: o.id === id }))
      });
    } else {
      onUpdate({
        options: question.options.map(o => o.id === id ? { ...o, isCorrect: !o.isCorrect } : o)
      });
    }
  };

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm transition-all dark:bg-slate-900 dark:border-slate-800 ${isExpanded ? 'border-l-4 border-l-indigo-600' : 'border-l-4 border-l-slate-300'}`}>
      <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            Question {index < 10 ? `0${index}` : index} &bull; {question.type.replace('-', ' ')}
          </span>
          <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-md">
            {question.title || <span className="italic font-medium text-slate-300">New Question...</span>}
          </h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider">
            <span>{question.marks.toFixed(1)} Marks</span>
            {question.negativeMarks > 0 && <span className="text-red-400">-{question.negativeMarks.toFixed(1)} Negative</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
            {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 pt-0 space-y-6">
          <div className="space-y-4">
            <input
              value={question.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="w-full text-base font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none dark:bg-transparent dark:text-white"
              placeholder="What is the question?"
            />
            <textarea
              value={question.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="w-full text-sm text-slate-500 placeholder:text-slate-300 focus:outline-none dark:bg-transparent dark:text-slate-400 border-none p-0 resize-none"
              placeholder="Add additional context or instructions..."
              rows={1}
            />
          </div>

          {/* Options Section */}
          {(question.type === QuestionType.SingleChoice || 
            question.type === QuestionType.MultipleSelect || 
            question.type === QuestionType.TrueFalse) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.options.map((option) => (
                <div key={option.id} className="group flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100 focus-within:border-indigo-300 transition-all dark:bg-slate-800 dark:border-slate-700">
                  <button
                    onClick={() => toggleCorrect(option.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all ${
                      option.isCorrect 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-600'
                    }`}
                  >
                    {option.isCorrect && <Check size={12} strokeWidth={4} />}
                  </button>
                  <input
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    disabled={question.type === QuestionType.TrueFalse}
                    className="flex-1 bg-transparent text-sm font-medium text-slate-700 focus:outline-none dark:text-slate-200"
                  />
                  {question.type !== QuestionType.TrueFalse && (
                    <button
                      onClick={() => removeOption(option.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {question.type !== QuestionType.TrueFalse && (
                <button
                  onClick={addOption}
                  className="flex items-center justify-center gap-2 py-2 border border-dashed border-slate-200 rounded-lg text-[11px] font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all dark:border-slate-700"
                >
                  <Plus size={14} /> Add Option
                </button>
              )}
            </div>
          )}

          {question.type === QuestionType.ShortAnswer && (
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Accepted Correct Answers (Comma Separated)</label>
              <textarea
                value={question.options.map(o => o.text).join(', ')}
                onChange={(e) => {
                  const texts = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                  onUpdate({
                    options: texts.map((t) => ({ id: uuidv4(), text: t, isCorrect: true }))
                  });
                }}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:bg-slate-800 dark:text-slate-200"
                placeholder="Berlin, berlin, BERLIN"
                rows={2}
              />
              <p className="text-[10px] text-slate-400 italic">User input will be matched against these values (case-insensitive recommended in evaluation logic).</p>
            </div>
          )}

          {question.type === QuestionType.Essay && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl dark:bg-amber-900/20 dark:border-amber-900/50">
               <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Manual Grading Required</p>
               <p className="text-xs text-amber-600/80 dark:text-amber-400/60 leading-relaxed">
                 Essay questions cannot be auto-scored. You will need to manually review and assign points after the student submits their response.
               </p>
            </div>
          )}

          {/* Question Settings Bar */}
          <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-slate-50 dark:border-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Points</span>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <input
                  type="number"
                  step="0.5"
                  value={question.marks}
                  onChange={(e) => onUpdate({ marks: Number(e.target.value) })}
                  className="w-16 bg-transparent text-sm font-black text-slate-700 focus:outline-none dark:text-white"
                />
                <span className="text-[10px] font-bold text-slate-400">PTS</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Penalty</span>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <input
                  type="number"
                  step="0.1"
                  value={question.negativeMarks}
                  onChange={(e) => onUpdate({ negativeMarks: Number(e.target.value) })}
                  className="w-16 bg-transparent text-sm font-black text-slate-700 focus:outline-none dark:text-white"
                />
                <span className="text-[10px] font-bold text-slate-400">PTS</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Time</span>
              <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded dark:bg-slate-800">
                <input
                  type="number"
                  value={question.timeLimit || 0}
                  onChange={(e) => onUpdate({ timeLimit: Number(e.target.value) })}
                  className="w-10 bg-transparent text-xs font-black text-slate-700 focus:outline-none dark:text-white"
                />
                <span className="text-[10px] font-bold text-slate-400">SEC</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mandatory</span>
              <button
                onClick={() => onUpdate({ required: !question.required })}
                className={`relative flex h-5 w-9 items-center rounded-full transition-all ${
                  question.required ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <div className={`h-3 w-3 translate-x-1 rounded-full bg-white transition-all ${
                  question.required ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
