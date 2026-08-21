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
      evaluationCache = data as EvaluationRecord[];
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

  const { data: saved, error } = await supabase.from('evaluations').insert({ ...newRecord, owner_user_id: userId }).select('*').single();
  if (error || !saved) throw new Error('Evaluation could not be saved securely. Please retry.');
  evaluationCache = [saved as EvaluationRecord, ...evaluationCache];
  notifyStoreListeners();
  return saved as EvaluationRecord;
};
