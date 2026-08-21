import React, { useState, useEffect } from 'react';
import { 
  FileText, UploadCloud, Copy, Sparkles, CheckCircle2, AlertCircle, 
  ArrowRight, FileSpreadsheet, ListFilter, RotateCcw, Play, Check, HelpCircle, X, Plus, BookOpen, Layers, Award, User, Hash, HelpCircle as QuestionIcon, ChevronRight
} from 'lucide-react';
import { getEvaluations, saveEvaluation, EvaluationRecord, subscribeToStoreChanges } from '../../services/evaluationStore';
import { getApiUrl } from '../../config/apiConfig';
import { supabase } from '../../database/supabase';
import { downloadAsExcel } from '../../services/excelGenerator';

interface AnalyzedQuestion {
  questionNumber: string;
  questionText: string;
  maxMarks: number;
  expectedAnswerSummary: string;
}

interface AnalyzedPaper {
  id: string;
  title: string;
  subject: string;
  totalMarks: number;
  questions: AnalyzedQuestion[];
}

const SAMPLE_ANALYZED_PAPER: AnalyzedPaper = {
  id: 'paper-sample-1',
  title: 'Quantum Physics Midterm Exam',
  subject: 'Quantum Mechanics',
  totalMarks: 10,
  questions: [
    {
      questionNumber: 'Q1',
      questionText: 'Evaluate wave normalization constants and determine the normalization constant A for a 1D infinite square well between 0 and L.',
      maxMarks: 5,
      expectedAnswerSummary: 'Integrate the square of the wave function over [0, L] and set to 1. Using ∫ sin^2(nπx/L) dx = L/2, A = √(2/L).'
    },
    {
      questionNumber: 'Q2',
      questionText: 'State the Heisenberg Uncertainty Principle and discuss its mathematical boundary implications for harmonic oscillators.',
      maxMarks: 5,
      expectedAnswerSummary: 'Δx Δp ≥ ℏ/2. In a harmonic oscillator, the ground state reaches the exact lower boundary product of ℏ/2.'
    }
  ]
};

export const TestPaperEvaluator: React.FC = () => {
  const [evalList, setEvalList] = useState<EvaluationRecord[]>([]);
  const [selectedEval, setSelectedEval] = useState<EvaluationRecord | null>(null);
  
  // Analyzed Paper States
  const [analyzedPapers, setAnalyzedPapers] = useState<AnalyzedPaper[]>([]);
  const [activePaper, setActivePaper] = useState<AnalyzedPaper | null>(null);
  const [showNewPaperForm, setShowNewPaperForm] = useState(false);
  const [newPaperTitle, setNewPaperTitle] = useState('');
  const [newPaperSubject, setNewPaperSubject] = useState('Quantum Mechanics');
  const [isAnalyzingPaper, setIsAnalyzingPaper] = useState(false);
  const [newPaperContent, setNewPaperContent] = useState('');
  const [paperUploadName, setPaperUploadName] = useState('');
  const [paperUploadBase64, setPaperUploadBase64] = useState('');

  // Filtering state
  const [filterSubject, setFilterSubject] = useState('all');

  // Student grading States
  const [isGrading, setIsGrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [studentName, setStudentName] = useState('Arjun Mehta');
  const [rollNumber, setRollNumber] = useState('SEC-109');
  
  const [submissionType, setSubmissionType] = useState<'text' | 'upload'>('text');
  const [answerSheetText, setAnswerSheetText] = useState('Student Arjun Mehta answer sheet:\nQ1 wave constant solution is calculated using integral from 0 to L of A^2 sin^2(pi*x/L) dx = 1. A^2 * L/2 = 1 => Normalization constant is A = sqrt(2/L) which is absolutely correct.\nQ2: Heisenberg uncertainty equation states delta_x times delta_p must be exactly h/4*pi. It means we cannot measure position and speed together.');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedBase64, setUploadedBase64] = useState<string>('');

  useEffect(() => {
    // Sync historical evaluations
    const load = () => {
      setEvalList(getEvaluations().filter(e => e.type === 'test-paper'));
    };
    load();
    
    // Load analyzed papers
    const stored = localStorage.getItem('nc_analyzed_papers');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length > 0) {
          setAnalyzedPapers(parsed);
          setActivePaper(parsed[0]);
        } else {
          setAnalyzedPapers([SAMPLE_ANALYZED_PAPER]);
          setActivePaper(SAMPLE_ANALYZED_PAPER);
        }
      } catch (e) {
        setAnalyzedPapers([SAMPLE_ANALYZED_PAPER]);
        setActivePaper(SAMPLE_ANALYZED_PAPER);
      }
    } else {
      setAnalyzedPapers([SAMPLE_ANALYZED_PAPER]);
      setActivePaper(SAMPLE_ANALYZED_PAPER);
    }

    return subscribeToStoreChanges(load);
  }, []);

  const saveAnalyzedPapersList = (updatedList: AnalyzedPaper[]) => {
    setAnalyzedPapers(updatedList);
    localStorage.setItem('nc_analyzed_papers', JSON.stringify(updatedList));
  };

  const handlePaperFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaperUploadName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPaperUploadBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStudentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // 1. Analyze Question Paper with AI
  const handleAnalyzeQuestionPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzingPaper(true);
    setErrorMsg('');

    const paperSource = paperUploadBase64 || newPaperContent;
    if (!paperSource) {
      setIsAnalyzingPaper(false);
      setErrorMsg('Please paste the question paper text or upload a paper scan image.');
      return;
    }

    try {
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error('Your signed-in session has expired. Please sign in again before analyzing a question paper.');
      const response = await fetch(getApiUrl('/api/analyze-question-paper'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
        body: JSON.stringify({
          questionPaper: paperSource,
          subject: newPaperSubject
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to analyze question paper.');
      }

      const result = await response.json();
      
      const newAnalyzedPaper: AnalyzedPaper = {
        id: 'paper-' + Math.random().toString(36).substring(2, 9),
        title: result.title || newPaperTitle || 'Uploaded Question Sheet',
        subject: result.subject || newPaperSubject,
        totalMarks: result.totalMarks || 10,
        questions: result.questions || []
      };

      const newList = [newAnalyzedPaper, ...analyzedPapers];
      saveAnalyzedPapersList(newList);
      setActivePaper(newAnalyzedPaper);
      setShowNewPaperForm(false);
      
      // Reset input form
      setNewPaperContent('');
      setPaperUploadName('');
      setPaperUploadBase64('');
      setNewPaperTitle('');

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during AI question paper inspection.');
    } finally {
      setIsAnalyzingPaper(false);
    }
  };

  // 2. Evaluate Student Paper against Active Reference
  const runEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaper) {
      setErrorMsg('Please set or upload an active Question Paper reference first.');
      return;
    }

    setIsGrading(true);
    setErrorMsg('');

    const sheetContent = submissionType === 'upload' ? uploadedBase64 : answerSheetText;
    if (!sheetContent) {
      setErrorMsg('Please paste student responses or upload their answer sheet scan.');
      setIsGrading(false);
      return;
    }

    try {
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error('Your signed-in session has expired. Please sign in again before grading.');
      const response = await fetch(getApiUrl('/api/evaluate/test-paper'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.session.access_token}` },
        body: JSON.stringify({
          studentAnswerSheet: sheetContent,
          subject: activePaper.subject,
          studentName,
          analyzedQuestionPaper: activePaper
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Backend student evaluation failed.');
      }

      const result = await response.json();
      
      // Capture evaluations locally and sync
      const savedRecord = await saveEvaluation({
        type: 'test-paper',
        studentName,
        rollNumber,
        subject: activePaper.subject,
        assessmentName: activePaper.title,
        marksObtained: result.totalMarksObtained ?? 0,
        totalMarks: result.totalMarksPossible ?? activePaper.totalMarks,
        percentage: result.percentage ?? Math.round(((result.totalMarksObtained ?? 0) / (result.totalMarksPossible ?? activePaper.totalMarks)) * 100),
        grade: result.grade ?? 'B',
        feedback: result.overallFeedback ?? '',
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        improvementSuggestions: result.improvementSuggestions || []
      });

      // Also append questions feedback breakdown inside local record
      const recordWithBreakdown = {
        ...savedRecord,
        questionEvaluations: result.questionEvaluations || []
      };

      setEvalList(prev => [recordWithBreakdown, ...prev]);
      setSelectedEval(recordWithBreakdown);

      // Reset submission
      setAnswerSheetText('');
      setUploadedFileName('');
      setUploadedBase64('');

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gemini core failed to structure and score student paper.');
    } finally {
      setIsGrading(false);
    }
  };

  const handleSelectPaper = (id: string) => {
    const found = analyzedPapers.find(p => p.id === id);
    if (found) {
      setActivePaper(found);
    }
  };

  const deletePaperReference = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = analyzedPapers.filter(p => p.id !== id);
    saveAnalyzedPapersList(filtered);
    if (activePaper?.id === id) {
      setActivePaper(filtered[0] || null);
    }
  };

  const exportSpreadsheet = () => {
    const excelRecords = evalList.map(e => ({
      studentName: e.studentName,
      rollNumber: e.rollNumber,
      subject: e.subject,
      assessmentName: e.assessmentName,
      marksObtained: e.marksObtained,
      totalMarks: e.totalMarks,
      percentage: e.percentage,
      grade: e.grade,
      feedback: e.feedback
    }));
    downloadAsExcel(excelRecords, `${activePaper?.subject?.replace(/\s+/g, '_') || 'Grading'}_Evaluation_Report.csv`);
  };

  const subjects = ['all', ...Array.from(new Set(evalList.map(e => e.subject)))];
  const filteredEvals = evalList.filter(e => filterSubject === 'all' || e.subject === filterSubject);

  return (
    <div className="space-y-8">
      {/* Top Controls: Subject Filter, Excel report and Active reference info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-black/5 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <ListFilter size={14} className="opacity-45" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter:</span>
          <select 
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-bold uppercase tracking-wider focus:outline-none"
          >
            {subjects.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Subjects' : s}</option>
            ))}
          </select>
        </div>

        <button
          onClick={exportSpreadsheet}
          disabled={evalList.length === 0}
          className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-40 hover:bg-emerald-600 transition-all active:scale-95"
        >
          <FileSpreadsheet size={14} /> Export Grading Sheet (.csv)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Setup active paper and grading forms */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* SECTION 1: QUESTION PAPER REFERENCE SELECTOR/ANALYZER */}
          <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <BookOpen size={18} className="text-blue-500" />
                  1. CHOOSE ACTIVE QUESTION PAPER
                </h3>
                <p className="text-xs opacity-50 mt-1">Select an analyzed paper context to evaluate student submissions against.</p>
              </div>
              <button
                onClick={() => setShowNewPaperForm(!showNewPaperForm)}
                className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all self-start"
              >
                <Plus size={14} /> Analyze New Paper
              </button>
            </div>

            {errorMsg && (
              <div className="p-4 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-3">
                <AlertCircle size={16} className="shrink-0" /> 
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Collapsible New Paper Analysis Form */}
            {showNewPaperForm && (
              <form onSubmit={handleAnalyzeQuestionPaper} className="bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/5 rounded-2xl p-5 mb-6 space-y-4 animate-in fade-in duration-200">
                <h4 className="text-xs font-black uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-2">AI Paper Extraction & Setup</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Exam Title / Label</label>
                    <input 
                      type="text" required placeholder="e.g., Physics Midterm 2026"
                      value={newPaperTitle} onChange={e => setNewPaperTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Subject Name</label>
                    <input 
                      type="text" required placeholder="e.g., Quantum Mechanics"
                      value={newPaperSubject} onChange={e => setNewPaperSubject(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Question Paper Text OR Upload Scan</label>
                    <span className="text-[8px] opacity-40 uppercase font-black">Fast OCR Enabled</span>
                  </div>
                  
                  <textarea
                    rows={4} placeholder="Type or paste question paper guidelines here, OR upload an exam sheet scan below..."
                    value={newPaperContent} onChange={e => setNewPaperContent(e.target.value)}
                    className="w-full p-4 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 text-xs font-mono focus:outline-none custom-scrollbar"
                  />

                  <div className="pt-2">
                    <div className="flex items-center justify-center p-6 bg-white dark:bg-slate-900/50 border border-dashed border-black/10 dark:border-white/10 rounded-xl relative">
                      <div className="space-y-2 text-center">
                        <UploadCloud size={24} className="mx-auto text-blue-500" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">Upload Question Exam Image</p>
                        <p className="text-[8px] opacity-40">Drop a scan page to identify exact questions</p>
                        <label className="inline-block mt-1 px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/80 hover:bg-slate-200 hover:text-black rounded-lg font-bold uppercase text-[8px] tracking-wider cursor-pointer">
                          Upload file
                          <input type="file" accept="image/*" onChange={handlePaperFileUpload} className="hidden" />
                        </label>
                        {paperUploadName && (
                          <p className="text-[9px] text-emerald-500 font-bold mt-1 flex items-center justify-center gap-1"><Check size={10} /> {paperUploadName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button" onClick={() => setShowNewPaperForm(false)}
                    className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit" disabled={isAnalyzingPaper}
                    className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[9px] uppercase tracking-widest flex items-center gap-2 rounded-xl"
                  >
                    {isAnalyzingPaper ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Extract questions with AI
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* List of analyzed question papers */}
            {analyzedPapers.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-black/10 dark:border-white/10 rounded-2xl opacity-40">
                No question papers analyzed yet. Upload one to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analyzedPapers.map(paper => (
                  <div
                    key={paper.id}
                    onClick={() => handleSelectPaper(paper.id)}
                    className={`p-4 rounded-2xl cursor-pointer border relative text-left transition-all ${activePaper?.id === paper.id ? 'bg-blue-500/5 border-blue-500/40 shadow-sm ring-1 ring-blue-500/10' : 'bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 border-black/5 dark:border-white/5'}`}
                  >
                    {activePaper?.id === paper.id && (
                      <span className="absolute top-3 right-3 text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Active</span>
                    )}
                    <span className="text-[8px] font-black uppercase tracking-wider text-blue-500">{paper.subject}</span>
                    <h4 className="font-black text-xs text-slate-800 dark:text-white mt-0.5 truncate pr-16">{paper.title}</h4>
                    <div className="flex gap-4 mt-2 text-[10px] opacity-50 font-semibold font-mono">
                      <span>{paper.questions?.length || 0} Questions</span>
                      <span>{paper.totalMarks} Max Marks</span>
                    </div>

                    {paper.id !== 'paper-sample-1' && (
                      <button
                        onClick={(e) => deletePaperReference(paper.id, e)}
                        className="absolute bottom-3 right-3 p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="Delete Reference"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Displays questions inside the active paper context */}
            {activePaper && (
              <div className="mt-6 pt-5 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between pb-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">ACTIVE PAPER STRUCTURE (NO RAG INDEXING)</h4>
                  <span className="text-[10px] uppercase font-bold text-slate-400 italic">Checks strictly against these questions</span>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {activePaper.questions?.map((q, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl text-left flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                        {q.questionNumber}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug">{q.questionText}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          <span className="font-extrabold text-blue-500">[{q.maxMarks} MARKS]</span> Expected: {q.expectedAnswerSummary}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: GRADER PANEL (FOR GRADING SUBSEQUENT PAPERS SPECIFICALLY AGAINST ACTIVE PAPER) */}
          {activePaper ? (
            isGrading ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl min-h-[400px] flex flex-col items-center justify-center space-y-6 shadow-xl">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-spin" />
                  <Sparkles className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black italic tracking-tight uppercase">AI GRADER ACTIVE</h3>
                  <p className="text-sm opacity-50 max-w-sm mx-auto leading-relaxed">
                    Evaluating student answer sheet sheet specifically against <strong>{activePaper.title}</strong>...
                  </p>
                </div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 p-3 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
                  Executing Context Check • Strict Grading Rules
                </div>
              </div>
            ) : selectedEval ? (
              /* High-fidelity Student Evaluation Report Inspector */
              <div className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-8 shadow-xl">
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-5">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-500">{selectedEval.subject}</span>
                    <h3 className="text-2xl font-black italic tracking-tighter mt-1">{selectedEval.assessmentName}</h3>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <User size={12} /> Student: <strong>{selectedEval.studentName}</strong> • {selectedEval.rollNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEval(null)}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  >
                    Grade New Student
                  </button>
                </div>

                {/* Score Summary Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-center">
                    <span className="text-[9px] font-black uppercase text-blue-500 tracking-wider">Marks Scored</span>
                    <p className="text-4xl font-black italic mt-1">{selectedEval.marksObtained} <span className="text-xs font-normal opacity-40">/ {selectedEval.totalMarks}</span></p>
                  </div>
                  <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/10 text-center">
                    <span className="text-[9px] font-black uppercase text-purple-500 tracking-wider">Final Grade</span>
                    <p className="text-4xl font-black italic mt-1 text-purple-500">{selectedEval.grade}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <span className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">Percentage</span>
                    <p className="text-4xl font-black italic mt-1 text-emerald-500">{selectedEval.percentage}%</p>
                  </div>
                </div>

                {/* Overarching Commentary Text */}
                <div className="space-y-2 text-left">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Overarching Evaluator Commentary</h4>
                  <div className="p-6 bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/5 rounded-2xl text-sm leading-relaxed font-medium">
                    {selectedEval.feedback}
                  </div>
                </div>

                {/* Question by Question matched evaluation scores *if* stored */}
                {selectedEval.questionEvaluations && selectedEval.questionEvaluations.length > 0 && (
                  <div className="space-y-3 pt-2 text-left">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Detailed Question Breakdown</h4>
                    <div className="space-y-3">
                      {selectedEval.questionEvaluations.map((qe: any, qIdx: number) => (
                        <div key={qIdx} className="p-4 bg-slate-50 dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center border-b border-black/5 dark:border-white/5 pb-2">
                            <span className="text-xs font-extrabold text-blue-500">{qe.questionNumber} - {qe.questionSummary || 'Question Details'}</span>
                            <span className="text-xs font-black font-mono px-2.5 py-1 rounded bg-black/5 dark:bg-white/5">
                              {qe.marksAwarded} / {qe.maxMarks} Marks
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                            <div>
                              <strong className="text-slate-400 uppercase tracking-wide text-[9px] block">Extracted Answer:</strong>
                              <p className="p-2.5 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg mt-0.5 max-h-24 overflow-y-auto italic font-medium leading-relaxed">
                                {qe.studentAnswerExtracted || "No response matched or empty."}
                              </p>
                            </div>
                            {qe.deductionExplanation && (
                              <div className="pt-1.5 flex gap-1.5 items-start text-red-500">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                <p><strong>Deduction Justification:</strong> {qe.deductionExplanation}</p>
                              </div>
                            )}
                            {qe.feedback && (
                              <div className="pt-1 flex gap-1.5 items-start text-emerald-500 font-medium">
                                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                                <p><strong>Guidance:</strong> {qe.feedback}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Weaknesses row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                      <CheckCircle2 size={14} /> Strengths
                    </h4>
                    <ul className="space-y-2">
                      {selectedEval.strengths?.map((s, idx) => (
                        <li key={idx} className="text-xs opacity-75 leading-relaxed bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 flex items-start gap-2">
                          <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                      <AlertCircle size={14} /> Weaknesses
                    </h4>
                    <ul className="space-y-2">
                      {selectedEval.weaknesses?.map((w, idx) => (
                        <li key={idx} className="text-xs opacity-75 leading-relaxed bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 flex items-start gap-2">
                          <X size={14} className="text-rose-500 shrink-0 mt-0.5" /> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Stepwise suggestions */}
                <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/5 text-left">
                  <h4 className="text-xs font-black uppercase tracking-widest text-blue-500">Stepwise Recommendations for Student</h4>
                  <div className="space-y-2">
                    {selectedEval.improvementSuggestions?.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-black/5 dark:border-white/5 text-xs font-medium">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Simple Student Answer Sheet Submission form */
              <form onSubmit={runEvaluation} className="p-8 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-6 shadow-xl text-left">
                <div>
                  <h3 className="text-xs font-black tracking-widest text-slate-400">STEP 2. ENTER STUDENT ANSWER SHEET TO CHECK</h3>
                  <p className="text-xs opacity-50 mt-1">Grade individual student paper against active reference: <strong>{activePaper.title}</strong>.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1"><User size={10} /> Student Full Name</label>
                    <input 
                      type="text" required value={studentName} onChange={e => setStudentName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                      placeholder="e.g. Arjun Mehta"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1"><Hash size={10} /> Roll / Seat Number</label>
                    <input 
                      type="text" required value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                      placeholder="SEC-109"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Student Answer Sheet Content</label>
                    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                      <button
                        type="button" onClick={() => setSubmissionType('text')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${submissionType === 'text' ? 'bg-white dark:bg-slate-800 text-blue-500 shadow-sm' : 'opacity-40 text-slate-500'}`}
                      >
                        Paste text
                      </button>
                      <button
                        type="button" onClick={() => setSubmissionType('upload')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${submissionType === 'upload' ? 'bg-white dark:bg-slate-800 text-blue-500 shadow-sm' : 'opacity-40 text-slate-500'}`}
                      >
                        OCR Scan Upload
                      </button>
                    </div>
                  </div>

                  {submissionType === 'text' ? (
                    <textarea
                      rows={6} required value={answerSheetText} onChange={e => setAnswerSheetText(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs font-mono leading-relaxed focus:outline-none custom-scrollbar"
                      placeholder="Type or paste the student's handwritten draft text or answers..."
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl text-center space-y-4">
                      <UploadCloud size={32} className="text-blue-500 animate-bounce" />
                      <div className="space-y-1 animate-pulse">
                        <p className="text-xs font-bold uppercase tracking-wider">Upload student scan image</p>
                        <p className="text-[9px] opacity-40">JPEG, WebP, PNG images under 5MB</p>
                      </div>
                      <label className="px-5 py-2.5 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-bold uppercase text-[9px] tracking-wider cursor-pointer transition-all">
                        Browse Scan Photo
                        <input type="file" accept="image/*" onChange={handleStudentFileUpload} className="hidden" />
                      </label>
                      {uploadedFileName && (
                        <p className="text-[10px] text-emerald-500 font-bold uppercase flex items-center gap-1.5"><Check size={12} /> Received: {uploadedFileName}</p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-500/15 cursor-pointer transform hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2.5"
                >
                  <Sparkles size={16} /> Evaluate Student Sheet vs Active Paper
                </button>
              </form>
            )
          ) : (
            <div className="p-12 text-center bg-slate-100 dark:bg-slate-900 rounded-3xl opacity-50 space-y-2">
              <HelpCircle className="mx-auto text-blue-500" size={32} />
              <p className="text-sm font-bold uppercase tracking-wider">No Active Question Paper Reference</p>
              <p className="text-xs">Setup a paper in Step 1 to begin grading student transcripts.</p>
            </div>
          )}
        </div>

        {/* Right column: Archived student evaluations list */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-3xl space-y-4 shadow-xl text-left">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">EVALUATION ARCHIVE</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredEvals.length === 0 ? (
                <p className="text-xs opacity-40 py-10 text-center">No evaluations completed yet.</p>
              ) : (
                filteredEvals.map(evalItem => (
                  <div
                    key={evalItem.id}
                    onClick={() => { setSelectedEval(evalItem); }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border text-left ${selectedEval?.id === evalItem.id ? 'bg-blue-500/5 border-blue-500/40 shadow-sm ring-1 ring-blue-500/20' : 'bg-slate-50 dark:bg-black/30 hover:bg-slate-100/50 dark:hover:bg-black/60 border-black/5 dark:border-white/5'}`}
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
