import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';

export interface KnowledgeAsset {
  id: string;
  title: string;
  type: 'answer-key' | 'rubric' | 'instructions';
  subject: string;
  content: string;
  createdAt: string;
}

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

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  ipAddress: string;
  details: string;
}

export interface TeacherRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  status: 'Active' | 'On Leave';
  joinedAt: string;
  classesCount: number;
}

const INITIAL_SEED_ASSETS: KnowledgeAsset[] = [
  {
    id: 'k-1',
    title: 'Quantum Physics Midterm Answer Key',
    type: 'answer-key',
    subject: 'Quantum Mechanics',
    content: 'Q1: Schrodinger equation states iℏ ∂/∂t Ψ = HΨ. The normalization constant is A = √(2/L).\nQ2: Heisenberg Uncertainty Principle: Δx Δp ≥ ℏ/2. For harmonic oscillator, ground state uncertainty product is exactly ℏ/2.\nQ3: Quantum tunneling probability T ≈ e^{-2κL} where κ = √{2m(V_0 - E)}/ℏ.',
    createdAt: '2026-05-15T10:00:00Z'
  },
  {
    id: 'k-2',
    title: 'Advanced Research Essay Rubric',
    type: 'rubric',
    subject: 'Academic Writing',
    content: 'Content Quality: 30 marks (Original insights, robust thesis).\nResearch: 20 marks (At least 5 peer-reviewed references).\nStructure: 20 marks (Clear intro, body paragraphs with topic sentences, logical transitions).\nOriginality: 15 marks (No boilerplate plagiarism, innovative perspectives).\nGrammar: 15 marks (Flawless scientific syntax, sophisticated vocabulary).',
    createdAt: '2026-05-18T14:30:00Z'
  },
  {
    id: 'k-3',
    title: 'System Mechanics Grading Guidelines',
    type: 'instructions',
    subject: 'Mechanical Engineering',
    content: '1. Deduct 0.5 marks for units errors.\n2. Award 50% partial marks if the formula is correct but calculation has arithmetic errors.\n3. Demand fully labeled force-body diagrams for Q3.',
    createdAt: '2026-06-01T09:12:00Z'
  }
];

const INITIAL_SEED_EVALUATIONS: EvaluationRecord[] = [
  {
    id: 'e-1',
    type: 'test-paper',
    studentName: 'Aishwarya Roy',
    rollNumber: 'SEC-101',
    subject: 'Quantum Mechanics',
    assessmentName: 'Quantum Mechanics Midterm',
    marksObtained: 84,
    totalMarks: 100,
    percentage: 84,
    grade: 'A',
    feedback: 'Excellent grasp of mathematical normalization. Partial marks awarded for quantum tunneling derivation despite minor mathematical misstep on exponents.',
    strengths: ['Beautiful mathematical precision', 'Strong intuitive physics context', 'Clear diagram annotation'],
    weaknesses: ['Exponent signs in tunneling probability', 'Sloppy algebra in question 3'],
    improvementSuggestions: ['Re-derive tunneling probability exponents with strict boundary checks', 'Review standard wave packet normalization constants'],
    date: '2026-06-10T12:00:00Z'
  },
  {
    id: 'e-2',
    type: 'assignment',
    studentName: 'Ishaan Sharma',
    rollNumber: 'SEC-102',
    subject: 'Academic Writing',
    assessmentName: 'Thesis Research Paper',
    marksObtained: 72,
    totalMarks: 100,
    percentage: 72,
    grade: 'B+',
    feedback: 'Good academic focus, though grammar checks identified several run-on sentences in sections 2 and 3.',
    criteriaScores: [
      { name: 'Content Quality', maxMarks: 30, scoreObtained: 24, justification: 'Clear thesis statement, although development in body paragraph 3 was slightly repetitive.' },
      { name: 'Research', maxMarks: 20, scoreObtained: 16, justification: 'Included 4 sources, mostly primary, but lacked standard citation standards.' },
      { name: 'Structure', maxMarks: 20, scoreObtained: 15, justification: 'Formatting was largely correct. Transitions could flow more smoothly between sections.' },
      { name: 'Originality', maxMarks: 15, scoreObtained: 12, justification: 'Expressed sound critical views.' },
      { name: 'Grammar', maxMarks: 15, scoreObtained: 5, justification: 'Frequent run-on sentences and punctuation slips downplayed paragraph flow.' }
    ],
    plagiarismScore: 4,
    plagiarismDetails: 'Typical scholastic phrasing identified in background section, well within normal thresholds.',
    date: '2026-06-11T15:20:00Z'
  },
  {
    id: 'e-3',
    type: 'test-paper',
    studentName: 'Zayn Malik',
    rollNumber: 'SEC-108',
    subject: 'Quantum Mechanics',
    assessmentName: 'Quantum Mechanics Midterm',
    marksObtained: 45,
    totalMarks: 100,
    percentage: 45,
    grade: 'D',
    feedback: 'Critical misconceptions identified in Schrodinger equations and wave functions. Severe deficiency in basic differentiation and integrals.',
    strengths: ['Heisenberg Uncertainty formulation correctly cited'],
    weaknesses: ['Failed to state the wave boundary conditions', 'Incorrect Schrodinger equation definition'],
    improvementSuggestions: ['Book consultation hours with teaching assistant', 'Re-read chapters 2 and 3 on finite potential wells'],
    date: '2026-06-12T09:40:00Z'
  },
  {
    id: 'e-4',
    type: 'assignment',
    studentName: 'Meera Patel',
    rollNumber: 'SEC-103',
    subject: 'Academic Writing',
    assessmentName: 'Thesis Research Paper',
    marksObtained: 92,
    totalMarks: 100,
    percentage: 92,
    grade: 'A+',
    feedback: 'Masterpiece level academic paper. Perfect citation, innovative structure, and flawless grammar.',
    criteriaScores: [
      { name: 'Content Quality', maxMarks: 30, scoreObtained: 28, justification: 'Profoundly informative and original thesis.' },
      { name: 'Research', maxMarks: 20, scoreObtained: 19, justification: 'Comprehensive literature review from 8 high-tier journals.' },
      { name: 'Structure', maxMarks: 20, scoreObtained: 18, justification: 'Coherent outline and masterful transitions.' },
      { name: 'Originality', maxMarks: 15, scoreObtained: 14, justification: 'Exceptional, distinctive perspectives.' },
      { name: 'Grammar', maxMarks: 15, scoreObtained: 13, justification: 'Brilliant style with zero errors.' }
    ],
    plagiarismScore: 0,
    plagiarismDetails: 'Fully genuine content.',
    date: '2026-06-12T16:00:00Z'
  },
  {
    id: 'e-5',
    type: 'test-paper',
    studentName: 'Rohit Sharma',
    rollNumber: 'SEC-105',
    subject: 'Quantum Mechanics',
    assessmentName: 'Quantum Mechanics Midterm',
    marksObtained: 68,
    totalMarks: 100,
    percentage: 68,
    grade: 'C+',
    feedback: 'A decent effort showing average conceptual understanding, but requires more preparation for mathematical derivatives.',
    strengths: ['Recognized wave boundary constants'],
    weaknesses: ['Failed question 3 tunneling question completely', 'Weak integration calculus'],
    improvementSuggestions: ['Complete tutorial assignments 4 and 5 on calculus applications'],
    date: '2026-06-12T11:00:00Z'
  }
];

const INITIAL_SEED_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-06-13T00:05:10Z',
    actor: 'Dr. Samuel Oak (Teacher)',
    action: 'Create Rubric',
    ipAddress: '192.168.1.42',
    details: 'Created and saved Advanced Research Essay Rubric asset to Knowledge Store.'
  },
  {
    id: 'log-2',
    timestamp: '2026-06-13T00:10:45Z',
    actor: 'Zayn Malik (Student)',
    action: 'View Grade',
    ipAddress: '198.51.100.12',
    details: 'Accessed student grade report for Quantum Mechanics Midterm.'
  },
  {
    id: 'log-3',
    timestamp: '2026-06-13T00:18:22Z',
    actor: 'Dr. Samuel Oak (Teacher)',
    action: 'Evaluate Assignment',
    ipAddress: '192.168.1.42',
    details: 'Executed AI Evaluation for Rohit Sharma Thesis Research Paper (assignment).'
  }
];

const INITIAL_SEED_TEACHERS: TeacherRecord[] = [
  { id: 't-1', name: 'Dr. Eleanor Vance', email: 'vance@school.edu', department: 'Quantum Physics', status: 'Active', joinedAt: '2024-08-15', classesCount: 4 },
  { id: 't-2', name: 'Prof. Samuel Oak', email: 'oak@school.edu', department: 'Biology & Life Sci', status: 'Active', joinedAt: '2023-01-10', classesCount: 6 },
  { id: 't-3', name: 'Dr. Alan Grant', email: 'grant@school.edu', department: 'Geology & Paleontology', status: 'On Leave', joinedAt: '2025-03-24', classesCount: 2 }
];

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
    try {
      cb();
    } catch (err) {
      console.error('Error notifying store listener:', err);
    }
  });
};

let isSynced = false;
export const initStoreSync = () => {
  if (isSynced) return;
  isSynced = true;

  onSnapshot(collection(db, 'knowledge_store'), (snapshot) => {
    if (snapshot.empty) {
      INITIAL_SEED_ASSETS.forEach(item => {
        setDoc(doc(db, 'knowledge_store', item.id), item)
          .catch(err => {
            try {
              handleFirestoreError(err, 'create', `knowledge_store/${item.id}`);
            } catch (formattedErr) {
              console.error('Error seeding asset:', formattedErr);
            }
          });
      });
      return;
    }
    const assets: KnowledgeAsset[] = [];
    snapshot.forEach(docSnap => {
      assets.push({ id: docSnap.id, ...docSnap.data() } as KnowledgeAsset);
    });
    localStorage.setItem('nc_knowledge_store', JSON.stringify(assets));
    notifyStoreListeners();
  }, (err) => {
    console.warn('Firestore knowledge_store sync is offline or lacks permissions. Using local storage.', err.message);
  });

  onSnapshot(collection(db, 'evaluations'), (snapshot) => {
    if (snapshot.empty) {
      INITIAL_SEED_EVALUATIONS.forEach(item => {
        setDoc(doc(db, 'evaluations', item.id), item)
          .catch(err => {
            try {
              handleFirestoreError(err, 'create', `evaluations/${item.id}`);
            } catch (formattedErr) {
              console.error('Error seeding evaluation:', formattedErr);
            }
          });
      });
      return;
    }
    const evals: EvaluationRecord[] = [];
    snapshot.forEach(docSnap => {
      evals.push({ id: docSnap.id, ...docSnap.data() } as EvaluationRecord);
    });
    localStorage.setItem('nc_evaluations', JSON.stringify(evals));
    notifyStoreListeners();
  }, (err) => {
    console.warn('Firestore evaluations sync is offline or lacks permissions. Using local storage.', err.message);
  });

  onSnapshot(collection(db, 'audit_logs'), (snapshot) => {
    if (snapshot.empty) {
      INITIAL_SEED_AUDIT_LOGS.forEach(item => {
        setDoc(doc(db, 'audit_logs', item.id), item)
          .catch(err => {
            try {
              handleFirestoreError(err, 'create', `audit_logs/${item.id}`);
            } catch (formattedErr) {
              console.error('Error seeding audit log:', formattedErr);
            }
          });
      });
      return;
    }
    const logs: AuditLog[] = [];
    snapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...docSnap.data() } as AuditLog);
    });
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    localStorage.setItem('nc_audit_logs', JSON.stringify(logs.slice(0, 100)));
    notifyStoreListeners();
  }, (err) => {
    console.warn('Firestore audit_logs sync is offline or lacks permissions. Using local storage.', err.message);
  });

  onSnapshot(collection(db, 'teachers'), (snapshot) => {
    if (snapshot.empty) {
      INITIAL_SEED_TEACHERS.forEach(item => {
        setDoc(doc(db, 'teachers', item.id), item)
          .catch(err => {
            try {
              handleFirestoreError(err, 'create', `teachers/${item.id}`);
            } catch (formattedErr) {
              console.error('Error seeding teacher:', formattedErr);
            }
          });
      });
      return;
    }
    const teachers: TeacherRecord[] = [];
    snapshot.forEach(docSnap => {
      teachers.push({ id: docSnap.id, ...docSnap.data() } as TeacherRecord);
    });
    localStorage.setItem('nc_teachers', JSON.stringify(teachers));
    notifyStoreListeners();
  }, (err) => {
    console.warn('Firestore teachers sync is offline or lacks permissions. Using local storage.', err.message);
  });
};

export const getKnowledgeStore = (): KnowledgeAsset[] => {
  initStoreSync();
  const data = localStorage.getItem('nc_knowledge_store');
  return data ? JSON.parse(data) : [];
};

export const saveKnowledgeAsset = (asset: Omit<KnowledgeAsset, 'id' | 'createdAt'>): KnowledgeAsset => {
  initStoreSync();
  const id = 'k-' + Math.random().toString(36).substr(2, 9);
  const createdAt = new Date().toISOString();
  const newAsset: KnowledgeAsset = {
    ...asset,
    id,
    createdAt
  };

  const current = getKnowledgeStore();
  localStorage.setItem('nc_knowledge_store', JSON.stringify([newAsset, ...current]));
  notifyStoreListeners();

  setDoc(doc(db, 'knowledge_store', id), newAsset)
    .catch(err => handleFirestoreError(err, 'create', `knowledge_store/${id}`));

  addAuditLog('Teacher', 'Create Knowledge Asset', `Added new ${asset.type}: "${asset.title}"`);
  return newAsset;
};

export const deleteKnowledgeAsset = (id: string) => {
  initStoreSync();
  const current = getKnowledgeStore();
  const updated = current.filter(a => a.id !== id);
  localStorage.setItem('nc_knowledge_store', JSON.stringify(updated));
  notifyStoreListeners();

  deleteDoc(doc(db, 'knowledge_store', id))
    .catch(err => handleFirestoreError(err, 'delete', `knowledge_store/${id}`));

  addAuditLog('Teacher', 'Delete Knowledge Asset', `Deleted asset ID: ${id}`);
};

export const getEvaluations = (): EvaluationRecord[] => {
  initStoreSync();
  const data = localStorage.getItem('nc_evaluations');
  return data ? JSON.parse(data) : [];
};

export const saveEvaluation = (record: Omit<EvaluationRecord, 'id' | 'date'>): EvaluationRecord => {
  initStoreSync();
  const id = 'e-' + Math.random().toString(36).substr(2, 9);
  const date = new Date().toISOString();
  const newRecord: EvaluationRecord = {
    ...record,
    id,
    date
  };

  const current = getEvaluations();
  localStorage.setItem('nc_evaluations', JSON.stringify([newRecord, ...current]));
  notifyStoreListeners();

  setDoc(doc(db, 'evaluations', id), newRecord)
    .catch(err => handleFirestoreError(err, 'create', `evaluations/${id}`));

  addAuditLog(record.studentName || 'Student', 'Evaluate Submission', `Completed evaluation for ${record.studentName} - ${record.assessmentName} (${record.marksObtained}/${record.totalMarks} marks)`);
  return newRecord;
};

export const getAuditLogs = (): AuditLog[] => {
  initStoreSync();
  const data = localStorage.getItem('nc_audit_logs');
  return data ? JSON.parse(data) : [];
};

export const addAuditLog = (actor: string, action: string, details: string) => {
  initStoreSync();
  const id = 'log-' + Math.random().toString(36).substr(2, 9);
  const newLog: AuditLog = {
    id,
    timestamp: new Date().toISOString(),
    actor,
    action,
    ipAddress: '127.0.0.1',
    details
  };

  const current = getAuditLogs();
  const updated = [newLog, ...current].slice(0, 100);
  localStorage.setItem('nc_audit_logs', JSON.stringify(updated));
  notifyStoreListeners();

  setDoc(doc(db, 'audit_logs', id), newLog)
    .catch(err => handleFirestoreError(err, 'create', `audit_logs/${id}`));
};

export const getTeachers = (): TeacherRecord[] => {
  initStoreSync();
  const data = localStorage.getItem('nc_teachers');
  return data ? JSON.parse(data) : [];
};

export const saveTeacher = (teacher: Omit<TeacherRecord, 'id' | 'joinedAt' | 'classesCount'>): TeacherRecord => {
  initStoreSync();
  const id = 't-' + Math.random().toString(36).substr(2, 9);
  const joinedAt = new Date().toISOString().split('T')[0];
  const newTeacher: TeacherRecord = {
    ...teacher,
    id,
    joinedAt,
    classesCount: 0
  };

  const current = getTeachers();
  localStorage.setItem('nc_teachers', JSON.stringify([...current, newTeacher]));
  notifyStoreListeners();

  setDoc(doc(db, 'teachers', id), newTeacher)
    .catch(err => handleFirestoreError(err, 'create', `teachers/${id}`));

  addAuditLog('Admin', 'Register Teacher', `Registered new teacher: "${teacher.name}" <${teacher.email}>`);
  return newTeacher;
};

export const deleteTeacher = (id: string) => {
  initStoreSync();
  const current = getTeachers();
  const updated = current.filter(t => t.id !== id);
  localStorage.setItem('nc_teachers', JSON.stringify(updated));
  notifyStoreListeners();

  deleteDoc(doc(db, 'teachers', id))
    .catch(err => handleFirestoreError(err, 'delete', `teachers/${id}`));

  addAuditLog('Admin', 'Delete Teacher', `Removed teacher ID: ${id}`);
};
