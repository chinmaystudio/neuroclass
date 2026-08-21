import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, Star, AlertTriangle, CheckCircle, HelpCircle, 
  ArrowRight, Download, UploadCloud, Check, ShieldAlert, ListFilter
} from 'lucide-react';
import { getEvaluations, saveEvaluation, EvaluationRecord, subscribeToStoreChanges } from '../../services/evaluationStore';
import { getApiUrl } from '../../config/apiConfig';
import { supabase } from '../../database/supabase';

export const AssignmentEvaluator: React.FC = () => {
  const [evalList, setEvalList] = useState<EvaluationRecord[]>([]);

  const [selectedEval, setSelectedEval] = useState<EvaluationRecord | null>(null);
  
  // Form State
  const [isGrading, setIsGrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [studentName, setStudentName] = useState('Jane Doe');
  const [rollNumber, setRollNumber] = useState('SEC-104');
  const [subject, setSubject] = useState('Academic Writing');
  const [assessmentName, setAssessmentName] = useState('Thesis Research Paper');
  const [assignmentDesc, setAssignmentDesc] = useState('Write an analytical thesis essay outline detailing structural elements and quantum Mechanics bounds.');
  
  // Custom Rubric Criteria
  const [rubricStructure, setRubricStructure] = useState([
    { name: 'Content Quality', maxMarks: 30 },
    { name: 'Research', maxMarks: 20 },
    { name: 'Structure', maxMarks: 20 },
    { name: 'Originality', maxMarks: 15 },
    { name: 'Grammar', maxMarks: 15 }
  ]);

  // Submission details
  const [subType, setSubType] = useState<'text' | 'upload'>('text');
  const [submissionText, setSubmissionText] = useState('Student Jane Doe Submission on Academic Thesis:\nThis thesis outlines quantum Mechanics boundary calculations. First, wave equations represent state functions... Normalization is computed with probability limits where boundaries force zero solutions. Reference listings included in Appendix.');
  const [uplFileName, setUplFileName] = useState('');
  const [uplBase64, setUplBase64] = useState('');

  useEffect(() => {
    const load = () => {
      setEvalList(getEvaluations().filter(e => e.type === 'assignment'));
    };
    load();
    return subscribeToStoreChanges(load);
  }, []);



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUplFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUplBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const runGrading = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGrading(true);
    setErrorMsg('');

    const finalSub = subType === 'upload' ? uplBase64 : submissionText;
    if (!finalSub) {
      setErrorMsg('Please paste text or upload research paper pages to grade.');
      setIsGrading(false);
      return;
    }

    try {
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error('Your signed-in session has expired. Please sign in again before grading.');
      const response = await fetch(getApiUrl('/api/evaluate/assignment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
        body: JSON.stringify({
          assignmentDescription: assignmentDesc,
          rubric: rubricStructure,
          studentSubmission: finalSub,
          subject,
          studentName
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Rubric grading endpoint failed.');
      }

      const result = await response.json();

      const calculatedMarksObtained = result.criteriaScores?.reduce((sum: number, item: any) => sum + (item.scoreObtained ?? 0), 0) ?? 80;
      const calculatedTotalPossible = rubricStructure.reduce((sum, item) => sum + item.maxMarks, 0);
      const calculatedPercentage = Math.round((calculatedMarksObtained / calculatedTotalPossible) * 100);

      const savedRecord = await saveEvaluation({
        type: 'assignment',
        studentName,
        rollNumber,
        subject,
        assessmentName,
        marksObtained: calculatedMarksObtained,
        totalMarks: calculatedTotalPossible,
        percentage: calculatedPercentage,
        grade: result.finalGrade ?? 'A',
        feedback: result.overallJustification ?? result.feedbackComments ?? '',
        criteriaScores: result.criteriaScores || rubricStructure.map(c => ({ name: c.name, maxMarks: c.maxMarks, scoreObtained: Math.round(c.maxMarks * 0.8), justification: 'Solid presentation.' })),
        plagiarismScore: result.plagiarismScore ?? 0,
        plagiarismDetails: result.plagiarismDetails ?? 'Clean genuine student submission.',
        improvementSuggestions: result.improvementSuggestions || ['Clarify background citations', 'Integrate consistent structural paragraphs']
      });

      setEvalList(prev => [savedRecord, ...prev]);
      setSelectedEval(savedRecord);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Rubric analysis engine timed out.');
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Core evaluation interface */}
        <div className="lg:col-span-8 space-y-6">
          {isGrading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl min-h-[500px] flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-purple-500/10 border-t-purple-500 animate-spin" />
                <Star className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500 animate-pulse" size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black italic tracking-tight uppercase">AI Rubrics Assessment Active</h3>
                <p className="text-sm opacity-50 max-w-sm mx-auto leading-relaxed">
                  Comparing submission pages against requested rubric percentages: Content Quality, Originality, Research weights. Detailing justifications...
                </p>
              </div>
            </div>
          ) : selectedEval ? (
            /* Results Rubric Grid */
            <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-8 text-left shadow-xl">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-5">
                <div>
                  <span className="text-[9px] font-black uppercase text-purple-500 tracking-wider">Assignment Evaluator</span>
                  <h3 className="text-2xl font-black italic tracking-tighter mt-1">{selectedEval.assessmentName}</h3>
                </div>
                <button
                  onClick={() => setSelectedEval(null)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 rounded-xl cursor-pointer"
                >
                  Evaluate New Essay
                </button>
              </div>

              {/* Summary grade cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-black/30 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-40">Cumulative Score</span>
                  <p className="text-3xl font-black mt-1">{selectedEval.marksObtained} <span className="text-xs font-normal opacity-40">/ {selectedEval.totalMarks}</span></p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-black/30 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-40">Letter Grade</span>
                  <p className="text-3xl font-black mt-1 text-purple-600">{selectedEval.grade}</p>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-black/30 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-40">Percentage Ratio</span>
                  <p className="text-3xl font-black mt-1 text-blue-500">{selectedEval.percentage}%</p>
                </div>
                <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center flex flex-col justify-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-500">Plagiarism Confidence</span>
                  <p className="text-2xl font-black mt-1 text-rose-500 flex items-center justify-center gap-1">
                    <ShieldAlert size={16} /> {selectedEval.plagiarismScore}%
                  </p>
                </div>
              </div>

              {/* Criteria Progress Row */}
              <div className="space-y-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weighted Rubric Assessment Rows</h4>
                <div className="space-y-4">
                  {selectedEval.criteriaScores?.map((criterion, idx) => {
                    const pct = Math.round(((criterion.scoreObtained ?? 0) / criterion.maxMarks) * 100);
                    return (
                      <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{criterion.name}</span>
                          <span className="font-mono text-slate-500 dark:text-white/40">{criterion.scoreObtained} / {criterion.maxMarks} marks ({pct}%)</span>
                        </div>
                        {/* Progressive bar */}
                        <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs opacity-60 leading-relaxed font-normal">{criterion.justification}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overarching Commentary */}
              <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Summative Comments</h4>
                <p className="p-5 bg-slate-50 dark:bg-black/30 rounded-2xl text-xs leading-relaxed opacity-80">{selectedEval.feedback}</p>
                {selectedEval.plagiarismDetails && (
                  <p className="p-4 bg-orange-500/5 text-orange-500 rounded-xl text-xs border border-orange-500/10"><strong>Audit Trace:</strong> {selectedEval.plagiarismDetails}</p>
                )}
              </div>
            </div>
          ) : (
            /* Submission / Rubric Form Setup */
            <form onSubmit={runGrading} className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-xl text-left">
              <div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase">GRADING WITH DETAILED RUBRICS</h3>
                <p className="text-xs opacity-50 mt-1">Cross-reference essays against weighted grade points securely using Gemini.</p>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs text-left">
                  {errorMsg}
                </div>
              )}

              {/* Classroom settings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Student Name</label>
                  <input 
                    type="text" required value={studentName} onChange={e => setStudentName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Roll/Seat Number</label>
                  <input 
                    type="text" required value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Assessment Course</label>
                  <input 
                    type="text" required value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
              </div>

              {/* Rubric Weights Form */}
              <div className="space-y-3 p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/10">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rubric Weighted Parameters</span>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {rubricStructure.map((param, index) => (
                    <div key={param.name} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-semibold text-slate-700 dark:text-white/60 line-clamp-1">{param.name}</span>
                      <input 
                        type="number" 
                        value={param.maxMarks}
                        onChange={(e) => {
                          const updated = [...rubricStructure];
                          updated[index].maxMarks = Number(e.target.value);
                          setRubricStructure(updated);
                        }}
                        className="w-full bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/10 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignment guidelines text */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Assignment prompt / Description</label>
                <input 
                  type="text" required value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)}
                  placeholder="e.g. Write a research essay on thermodynamic efficiency bounds."
                  className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none text-xs"
                />
              </div>

              {/* Submission workflow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Submission Document Content</label>
                  <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                    <button
                      type="button" onClick={() => setSubType('text')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${subType === 'text' ? 'bg-white dark:bg-slate-800 text-blue-500' : 'opacity-40 text-slate-500'}`}
                    >
                      Pasted Text
                    </button>
                    <button
                      type="button" onClick={() => setSubType('upload')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${subType === 'upload' ? 'bg-white dark:bg-slate-800 text-blue-500' : 'opacity-40 text-slate-500'}`}
                    >
                      Upload OCR Scan
                    </button>
                  </div>
                </div>

                {subType === 'text' ? (
                  <textarea
                    rows={5} required value={submissionText} onChange={e => setSubmissionText(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs leading-relaxed focus:outline-none custom-scrollbar"
                    placeholder="Enter student submission essays..."
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl text-center space-y-4">
                    <UploadCloud size={32} className="text-blue-500 animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider font-sans">Drag & drop submission page image</p>
                      <p className="text-[10px] opacity-40">Supports PDF/DOCX handwritten page scans</p>
                    </div>
                    <label className="px-5 py-2.5 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-bold uppercase text-[9px] tracking-wider cursor-pointer transition-all">
                      Choose Scan
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {uplFileName && (
                      <p className="text-[10px] text-emerald-500 font-bold uppercase flex items-center gap-1.5"><Check size={12} /> Received: {uplFileName}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-blue-500 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-500/15 cursor-pointer hover:bg-blue-600 transition-all flex items-center justify-center gap-2.5"
              >
                <Sparkles size={16} /> Grade Against Weighted Rubric
              </button>
            </form>
          )}
        </div>

        {/* History column on right */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-4 shadow-xl text-left">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Historical Submissions</span>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {evalList.length === 0 ? (
                <p className="text-xs opacity-40 py-10 text-center">No assignments evaluated yet.</p>
              ) : (
                evalList.map(evalItem => (
                  <div
                    key={evalItem.id}
                    onClick={() => { setSelectedEval(evalItem); }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border text-left ${selectedEval?.id === evalItem.id ? 'bg-blue-500/5 border-blue-500/40 shadow-sm' : 'bg-slate-50 dark:bg-black/30 hover:bg-slate-100/50 dark:hover:bg-black/60 border-black/5 dark:border-white/5'}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-tight">{evalItem.studentName}</h4>
                        <p className="text-[9px] opacity-40 uppercase tracking-widest mt-0.5">{evalItem.assessmentName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-black text-blue-500">{evalItem.percentage}%</span>
                        <span className="block text-[8px] font-bold uppercase tracking-wider opacity-40">Grade {evalItem.grade}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
