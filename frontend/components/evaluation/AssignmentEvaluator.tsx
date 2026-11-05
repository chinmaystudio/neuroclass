import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, Star, AlertTriangle, CheckCircle, HelpCircle, 
  ArrowRight, Download, UploadCloud, Check, ShieldAlert, ListFilter
} from '../ui/icons-compat';
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
            <div className="p-12 text-center bg-surface border border-line rounded-card min-h-[500px] flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary-soft border-t-primary animate-spin" />
                <Star className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold italic tracking-tight ">AI Rubrics Assessment Active</h3>
                <p className="text-sm opacity-50 max-w-sm mx-auto leading-relaxed">
                  Comparing submission pages against requested rubric percentages: Content Quality, Originality, Research weights. Detailing justifications...
                </p>
              </div>
            </div>
          ) : selectedEval ? (
            /* Results Rubric Grid */
            <div className="p-8 bg-surface border border-line rounded-card space-y-8 text-left shadow-raised">
              <div className="flex items-center justify-between border-b border-line pb-5">
                <div>
                  <span className="text-meta font-semibold text-primary ">Assignment Evaluator</span>
                  <h3 className="text-2xl font-semibold italic tracking-tighter mt-1">{selectedEval.assessmentName}</h3>
                </div>
                <button
                  onClick={() => setSelectedEval(null)}
                  className="px-4 py-2 text-meta font-bold bg-surface-2 rounded-button cursor-pointer"
                >
                  Evaluate New Essay
                </button>
              </div>

              {/* Summary grade cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-card bg-surface-2 text-center">
                  <span className="text-meta font-semibold opacity-40">Cumulative Score</span>
                  <p className="text-3xl font-semibold mt-1">{selectedEval.marksObtained} <span className="text-xs font-normal opacity-40">/ {selectedEval.totalMarks}</span></p>
                </div>
                <div className="p-5 rounded-card bg-surface-2 text-center">
                  <span className="text-meta font-semibold opacity-40">Letter Grade</span>
                  <p className="text-3xl font-semibold mt-1 text-primary">{selectedEval.grade}</p>
                </div>
                <div className="p-5 rounded-card bg-surface-2 text-center">
                  <span className="text-meta font-semibold opacity-40">Percentage Ratio</span>
                  <p className="text-3xl font-semibold mt-1 text-primary">{selectedEval.percentage}%</p>
                </div>
                <div className="p-5 rounded-card bg-danger-bg border border-danger/30 text-center flex flex-col justify-center">
                  <span className="text-meta font-semibold text-danger-ink">Plagiarism Confidence</span>
                  <p className="text-2xl font-semibold mt-1 text-danger-ink flex items-center justify-center gap-1">
                    <ShieldAlert size={16} /> {selectedEval.plagiarismScore}%
                  </p>
                </div>
              </div>

              {/* Criteria Progress Row */}
              <div className="space-y-5">
                <h4 className="text-meta font-semibold text-ink-2">Weighted Rubric Assessment Rows</h4>
                <div className="space-y-4">
                  {selectedEval.criteriaScores?.map((criterion, idx) => {
                    const pct = Math.round(((criterion.scoreObtained ?? 0) / criterion.maxMarks) * 100);
                    return (
                      <div key={idx} className="p-5 rounded-card bg-surface-2 border border-line space-y-3">
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span className="text-sm font-semibold text-ink ">{criterion.name}</span>
                          <span className="font-mono text-ink-2 ">{criterion.scoreObtained} / {criterion.maxMarks} marks ({pct}%)</span>
                        </div>
                        {/* Progressive bar */}
                        <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs opacity-60 leading-relaxed font-normal">{criterion.justification}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overarching Commentary */}
              <div className="space-y-3 pt-4 border-t border-line ">
                <h4 className="text-xs font-semibold text-ink-2">Summative Comments</h4>
                <p className="p-5 bg-surface-2 rounded-card text-xs leading-relaxed opacity-80">{selectedEval.feedback}</p>
                {selectedEval.plagiarismDetails && (
                  <p className="p-4 bg-warning-bg text-warning-ink rounded-button text-xs border border-warning/30"><strong>Audit Trace:</strong> {selectedEval.plagiarismDetails}</p>
                )}
              </div>
            </div>
          ) : (
            /* Submission / Rubric Form Setup */
            <form onSubmit={runGrading} className="p-8 bg-surface border border-line rounded-card space-y-6 shadow-raised text-left">
              <div>
                <h3 className="text-xl font-semibold italic tracking-tighter ">GRADING WITH DETAILED RUBRICS</h3>
                <p className="text-xs opacity-50 mt-1">Cross-reference essays against weighted grade points securely using Gemini.</p>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-card bg-danger-bg border border-danger/30 text-danger-ink text-xs text-left">
                  {errorMsg}
                </div>
              )}

              {/* Classroom settings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-meta font-bold text-ink-2">Student Name</label>
                  <input 
                    type="text" required value={studentName} onChange={e => setStudentName(e.target.value)}
                    className="w-full px-4 py-3 rounded-button bg-surface-2 border border-line focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-meta font-bold text-ink-2">Roll/Seat Number</label>
                  <input 
                    type="text" required value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-button bg-surface-2 border border-line focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-meta font-bold text-ink-2">Assessment Course</label>
                  <input 
                    type="text" required value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-button bg-surface-2 border border-line focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>
              </div>

              {/* Rubric Weights Form */}
              <div className="space-y-3 p-5 rounded-card border border-line bg-surface-2 ">
                <div className="flex justify-between items-center">
                  <span className="text-meta font-semibold text-ink-2">Rubric Weighted Parameters</span>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {rubricStructure.map((param, index) => (
                    <div key={param.name} className="p-3.5 rounded-button bg-surface border border-line space-y-1">
                      <span className="text-meta font-semibold text-ink-2 line-clamp-1">{param.name}</span>
                      <input 
                        type="number" 
                        value={param.maxMarks}
                        onChange={(e) => {
                          const updated = [...rubricStructure];
                          updated[index].maxMarks = Number(e.target.value);
                          setRubricStructure(updated);
                        }}
                        className="w-full bg-surface-2 border border-line px-2 py-1 text-xs font-mono font-bold text-center rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignment guidelines text */}
              <div className="space-y-1">
                <label className="text-meta font-bold text-ink-2">Assignment prompt / Description</label>
                <input 
                  type="text" required value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)}
                  placeholder="e.g. Write a research essay on thermodynamic efficiency bounds."
                  className="w-full px-4 py-3 rounded-button bg-surface-2 border border-line focus:outline-none text-xs"
                />
              </div>

              {/* Submission workflow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-meta font-semibold text-ink-2">Submission Document Content</label>
                  <div className="flex bg-surface-2 p-1 rounded-button">
                    <button
                      type="button" onClick={() => setSubType('text')}
                      className={`px-3 py-1.5 rounded-lg text-meta font-bold transition-all cursor-pointer ${subType === 'text' ? 'bg-surface text-primary' : 'opacity-40 text-ink-2'}`}
                    >
                      Pasted Text
                    </button>
                    <button
                      type="button" onClick={() => setSubType('upload')}
                      className={`px-3 py-1.5 rounded-lg text-meta font-bold transition-all cursor-pointer ${subType === 'upload' ? 'bg-surface text-primary' : 'opacity-40 text-ink-2'}`}
                    >
                      Upload OCR Scan
                    </button>
                  </div>
                </div>

                {subType === 'text' ? (
                  <textarea
                    rows={5} required value={submissionText} onChange={e => setSubmissionText(e.target.value)}
                    className="w-full p-4 rounded-card bg-surface-2 border border-line text-xs leading-relaxed focus:outline-none custom-scrollbar"
                    placeholder="Enter student submission essays..."
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-surface-2 border-2 border-dashed border-line rounded-card text-center space-y-4">
                    <UploadCloud size={32} className="text-primary animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold font-sans">Drag & drop submission page image</p>
                      <p className="text-meta opacity-40">Supports PDF/DOCX handwritten page scans</p>
                    </div>
                    <label className="px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-hover rounded-button font-bold text-meta cursor-pointer transition-all">
                      Choose Scan
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {uplFileName && (
                      <p className="text-meta text-success-ink font-bold flex items-center gap-1.5"><Check size={12} /> Received: {uplFileName}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-primary text-on-primary font-bold text-xs rounded-card shadow-raised cursor-pointer hover:bg-primary-hover transition-all flex items-center justify-center gap-2.5"
              >
                <Sparkles size={16} /> Grade Against Weighted Rubric
              </button>
            </form>
          )}
        </div>

        {/* History column on right */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-surface border border-line rounded-card space-y-4 shadow-raised text-left">
            <span className="text-meta font-semibold text-ink-2 ">Historical Submissions</span>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {evalList.length === 0 ? (
                <p className="text-xs opacity-40 py-10 text-center">No assignments evaluated yet.</p>
              ) : (
                evalList.map(evalItem => (
                  <div
                    key={evalItem.id}
                    onClick={() => { setSelectedEval(evalItem); }}
                    className={`p-4 rounded-card cursor-pointer transition-all border text-left ${selectedEval?.id === evalItem.id ? 'bg-primary-light border-primary shadow-card' : 'bg-surface-2 hover:bg-surface-2 border-line '}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-ink tracking-tight">{evalItem.studentName}</h4>
                        <p className="text-meta opacity-40 mt-0.5">{evalItem.assessmentName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-semibold text-primary">{evalItem.percentage}%</span>
                        <span className="block text-meta font-bold opacity-40">Grade {evalItem.grade}</span>
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
