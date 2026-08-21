import React from 'react';
import { Plus, Trash2, GripVertical, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Test, Section, Question, QuestionType } from '../../types';
import QuestionCard from '../common/QuestionCard';

interface BuilderTabProps {
  test: Test;
  setTest: React.Dispatch<React.SetStateAction<Test>>;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export default function BuilderTab({ test, setTest, onShowToast }: BuilderTabProps) {
  const addSection = () => {
    const newSection: Section = {
      id: uuidv4(),
      title: `Section ${test.sections.length + 1}`,
      questions: [],
      defaultMarks: 1,
      defaultNegativeMarks: 0
    };
    setTest({ ...test, sections: [...test.sections, newSection] });
  };

  const removeSection = (sectionId: string) => {
    if (test.sections.length <= 1) return;
    setTest({
      ...test,
      sections: test.sections.filter(s => s.id !== sectionId)
    });
  };

  const updateSection = (sectionId: string, updates: Partial<Section>) => {
    setTest({
      ...test,
      sections: test.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s)
    });
  };

  const addQuestion = (sectionId: string, type: QuestionType) => {
    const section = test.sections.find(s => s.id === sectionId);
    if (!section) return;

    const newQuestion: Question = {
      id: uuidv4(),
      type,
      title: '',
      options: type === QuestionType.TrueFalse 
        ? [{ id: '1', text: 'True', isCorrect: false }, { id: '2', text: 'False', isCorrect: false }]
        : type === QuestionType.SingleChoice || type === QuestionType.MultipleSelect
        ? [{ id: uuidv4(), text: 'Option 1', isCorrect: false }]
        : [],
      marks: section.defaultMarks,
      negativeMarks: section.defaultNegativeMarks,
      required: true
    };

    updateSection(sectionId, {
      questions: [...section.questions, newQuestion]
    });
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    const section = test.sections.find(s => s.id === sectionId);
    if (!section) return;

    updateSection(sectionId, {
      questions: section.questions.filter(q => q.id !== questionId)
    });
  };

  const updateQuestion = (sectionId: string, questionId: string, updates: Partial<Question>) => {
    const section = test.sections.find(s => s.id === sectionId);
    if (!section) return;

    updateSection(sectionId, {
      questions: section.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
    });
  };

  return (
    <div className="space-y-6 max-h-screen overflow-y-auto pr-2 custom-scrollbar">
      {test.sections.map((section, index) => (
        <div key={section.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-800">
            <div className="flex items-center gap-4 flex-1">
              <GripVertical className="bg-slate-200 p-1 rounded text-slate-400 cursor-grab dark:bg-slate-700" size={24} />
              <div className="flex flex-col">
                <input
                  value={section.title}
                  onChange={(e) => updateSection(section.id, { title: e.target.value })}
                  className="bg-transparent text-base font-bold text-slate-900 focus:outline-none dark:text-white"
                  placeholder="Section Title"
                />
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge-slate">{section.questions.length} Questions</span>
                  <span className="badge-slate">{section.questions.reduce((acc, q) => acc + q.marks, 0)} Total Marks</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const updatedQuestions = section.questions.map(q => ({
                    ...q,
                    marks: section.defaultMarks,
                    negativeMarks: section.defaultNegativeMarks
                  }));
                  updateSection(section.id, { questions: updatedQuestions });
                  if (onShowToast) onShowToast('Section markings updated to defaults.', 'success');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Apply Defaults
              </button>
              <button
                onClick={() => removeSection(section.id)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Section Default Marks</label>
                  <input 
                    type="number"
                    value={section.defaultMarks}
                    onChange={(e) => updateSection(section.id, { defaultMarks: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
               </div>
               <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Section Negative Marks</label>
                  <input 
                    type="number"
                    value={section.defaultNegativeMarks}
                    onChange={(e) => updateSection(section.id, { defaultNegativeMarks: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
               </div>
            </div>

            <div className="space-y-4">
              {section.questions.map((question, qIndex) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  onUpdate={(updates) => updateQuestion(section.id, question.id, updates)}
                  onRemove={() => removeQuestion(section.id, question.id)}
                  index={qIndex + 1}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              {Object.values(QuestionType).map((type) => (
                <button
                  key={type}
                  onClick={() => addQuestion(section.id, type)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  + Add {type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addSection}
        className="w-full py-6 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 font-bold text-sm hover:border-indigo-400 hover:text-indigo-600 hover:bg-slate-50 transition-all dark:border-slate-800 dark:hover:bg-slate-900"
      >
        <Plus size={20} />
        Add New Section
      </button>
    </div>
  );
}
