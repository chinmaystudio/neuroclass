import { supabase } from '../database/supabase';

export interface RubricCriterion {
  name: string;
  maxMarks: number;
  scoreObtained?: number;
  justification?: string;
}

export interface EvaluationRecord {
  id: string;
  type: 'test-paper' | 'assignment';
  studentName: string;
  rollNumber: string;
  subject: string;
  assessmentName: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
  improvementSuggestions?: string[];
  criteriaScores?: RubricCriterion[];
  questionEvaluations?: any[];
  plagiarismScore?: number;
  plagiarismDetails?: string;
  date: string;
}

type Listener = () => void;
const storeListeners = new Set<Listener>();

export const subscribeToStoreChanges = (callback: Listener) => {
  storeListeners.add(callback);
  return () => {
    storeListeners.delete(callback);
  };
};

const notifyStoreListeners = () => {
  storeListeners.forEach(cb => {
    try { cb(); } catch (err) { console.error(err); }
  });
};

// Database columns are lowercase / snake_case; the app uses camelCase.
const toRow = (r: EvaluationRecord, ownerUserId: string) => ({
  id: r.id,
  type: r.type,
  studentname: r.studentName,
  rollnumber: r.rollNumber ?? null,
  subject: r.subject ?? null,
  assessmentname: r.assessmentName ?? null,
  marksobtained: r.marksObtained ?? null,
  totalmarks: r.totalMarks ?? null,
  percentage: r.percentage ?? null,
  grade: r.grade ?? null,
  feedback: r.feedback ?? null,
  strengths: r.strengths ?? null,
  weaknesses: r.weaknesses ?? null,
  improvementsuggestions: r.improvementSuggestions ?? null,
  criteria_scores: r.criteriaScores ?? null,
  question_evaluations: r.questionEvaluations ?? null,
  plagiarism_score: r.plagiarismScore ?? null,
  plagiarism_details: r.plagiarismDetails ?? null,
  date: r.date,
  owner_user_id: ownerUserId,
});

const fromRow = (row: any): EvaluationRecord => ({
  id: row.id,
  type: row.type,
  studentName: row.studentname,
  rollNumber: row.rollnumber ?? '',
  subject: row.subject ?? '',
  assessmentName: row.assessmentname ?? '',
  marksObtained: Number(row.marksobtained ?? 0),
  totalMarks: Number(row.totalmarks ?? 0),
  percentage: Number(row.percentage ?? 0),
  grade: row.grade ?? '',
  feedback: row.feedback ?? '',
  strengths: row.strengths ?? undefined,
  weaknesses: row.weaknesses ?? undefined,
  improvementSuggestions: row.improvementsuggestions ?? undefined,
  criteriaScores: row.criteria_scores ?? undefined,
  questionEvaluations: row.question_evaluations ?? undefined,
  plagiarismScore: row.plagiarism_score === null || row.plagiarism_score === undefined ? undefined : Number(row.plagiarism_score),
  plagiarismDetails: row.plagiarism_details ?? undefined,
  date: row.date,
});

let isSynced = false;
let evaluationCache: EvaluationRecord[] = [];
export const initStoreSync = () => {
  if (isSynced) return;
  isSynced = true;

  const fetchEvaluations = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;
    const { data, error } = await supabase.from('evaluations').select('*').eq('owner_user_id', userId).order('date', { ascending: false }).limit(200);
    if (!error && data) {
      evaluationCache = (data as any[]).map(fromRow);
      localStorage.removeItem('nc_evaluations');
      notifyStoreListeners();
    }
  };

  fetchEvaluations();
  
  // Optional: Set up real-time subscription
  supabase.channel('evaluations_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, payload => {
      fetchEvaluations();
    })
    .subscribe();
};

export const getEvaluations = (): EvaluationRecord[] => {
  initStoreSync();
  return evaluationCache;
};

export const saveEvaluation = async (record: Omit<EvaluationRecord, 'id' | 'date'>): Promise<EvaluationRecord> => {
  initStoreSync();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Your signed-in session has expired. Please sign in again before saving an evaluation.');
  const id = 'e-' + crypto.randomUUID();
  const date = new Date().toISOString();
  const newRecord: EvaluationRecord = { ...record, id, date };

  const { data: saved, error } = await supabase.from('evaluations').insert(toRow(newRecord, userId) as any).select('*').single();
  if (error || !saved) throw new Error('Evaluation could not be saved securely. Please retry.');
  const stored = fromRow(saved);
  evaluationCache = [stored, ...evaluationCache];
  notifyStoreListeners();
  return stored;
};
