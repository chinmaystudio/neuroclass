export enum QuestionType {
  SingleChoice = 'single-choice',
  MultipleSelect = 'multiple-select',
  TrueFalse = 'true-false',
  ShortAnswer = 'short-answer',
  Essay = 'essay',
  FillInBlank = 'fill-in-blank',
  RatingScale = 'rating-scale',
  MatchPairs = 'match-pairs'
}

export enum LayoutModuleType {
  Heading = 'heading',
  Text = 'text',
  Image = 'image',
  Divider = 'divider',
  QuestionBox = 'question-box',
  StatsBox = 'stats-box',
  SectionNav = 'section-nav',
  Timer = 'timer',
  Alert = 'alert',
  Progress = 'progress',
  SystemLog = 'system-log',
  QuestionSwitcher = 'question-switcher'
}

export interface LayoutModule {
  id: string;
  type: LayoutModuleType;
  content?: string;
  url?: string;
  position: { x: number; y: number };
  size: { width: string | number; height: string | number };
  style?: {
    padding?: string;
    borderRadius?: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  options: Option[];
  marks: number;
  negativeMarks: number;
  timeLimit?: number; // in seconds
  required: boolean;
  image?: string;
  hint?: string;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  defaultMarks: number;
  defaultNegativeMarks: number;
}

export enum Theme {
  Default = 'default',
  Dark = 'dark',
  Serene = 'serene',
  Vibrant = 'vibrant',
  Professional = 'professional',
  Midnight = 'midnight',
  Nature = 'nature'
}

export interface ProctoringSettings {
  enabled: boolean;
  level: 'basic' | 'strict' | 'full-ai';
  tabSwitchDetection: boolean;
  faceDetection: boolean;
  gazeDetection: boolean;
  audioDetection: boolean;
  deviceDetection: boolean;
}

export interface TestSettings {
  title: string;
  subtitle?: string;
  institutionName: string;
  institutionIcon: string;
  logoUrl?: string;
  bannerUrl?: string;
  duration: number; // in minutes
  totalMarks: number;
  passingMarks: number;
  maxAttempts: number;
  startDateTime?: string;
  endDateTime?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  theme: Theme;
  accentColor: string;
}

export interface Test {
  id?: string;
  settings: TestSettings;
  proctoring: ProctoringSettings;
  sections: Section[];
  layout: LayoutModule[];
  appearance: {
    canvasBg: string;
    containerWidth: 'narrow' | 'medium' | 'wide' | 'full';
    cardStyle: 'flat' | 'elevated' | 'glass';
    fontFamily: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
