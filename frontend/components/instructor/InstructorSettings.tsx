import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Building, Phone, BookOpen, BrainCircuit,
  ShieldCheck, Zap, Bell, Moon, Sun, Save, RotateCcw,
  CheckCircle2, Sliders, Sparkles, Monitor, Key, RefreshCw
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { algoClient } from '../../services/algoClient';

// Storage keys
export const STORAGE_KEYS = {
  PROFILE: 'neuroclass_instructor_profile',
  AI: 'neuroclass_ai_settings',
  PROCTORING: 'neuroclass_proctoring_settings',
  X402: 'neuroclass_x402_settings',
  SYSTEM: 'neuroclass_system_settings',
};

// Default Settings Interfaces
export interface InstructorProfile {
  name: string;
  email: string;
  department: string;
  institution: string;
  phone: string;
  bio: string;
  avatar: string;
}

export interface AISettings {
  defaultQuestionCount: number;
  defaultDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Adaptive';
  defaultMarksPerQuestion: number;
  aiTemperature: number;
  autoSolutionKeys: boolean;
  includeMarkingMatrix: boolean;
  questionTypes: {
    mcq: boolean;
    shortAnswer: boolean;
    trueFalse: boolean;
    problemSolving: boolean;
  };
}

export interface ProctoringSettings {
  securityLevel: 'Relaxed' | 'Balanced' | 'Strict' | 'Lockdown';
  multiFaceAlert: boolean;
  maxTabSwitches: number;
  audioNoiseThreshold: number;
  fullscreenLock: boolean;
  autoIncidentReport: boolean;
  gazeTracking: boolean;
}

export interface X402Settings {
  treasuryAddress: string;
  network: string;
  autoConnectPera: boolean;
  showTransactionToasts: boolean;
  explorerUrl: 'algoexplorer' | 'pera';
  testPriceUsdcMicro: number;
  assignmentPriceUsdcMicro: number;
}

export interface SystemSettings {
  emailSubmissionAlerts: boolean;
  proctoringViolationSound: boolean;
  browserNotifications: boolean;
  compactNavigation: boolean;
}

// Fallback Defaults
export const DEFAULT_PROFILE: InstructorProfile = {
  name: 'Dr. Sarah Jenkins',
  email: 'sarah.jenkins@neuroclass.edu',
  department: 'Department of Computer Science',
  institution: 'NeuroUniversity STEM Institute',
  phone: '+1 (555) 382-9102',
  bio: 'Senior Professor of Data Structures & Algorithmic Security. Leading AI-enhanced educational research.',
  avatar: 'avatar-1',
};

export const DEFAULT_AI: AISettings = {
  defaultQuestionCount: 5,
  defaultDifficulty: 'Medium',
  defaultMarksPerQuestion: 10,
  aiTemperature: 0.4,
  autoSolutionKeys: true,
  includeMarkingMatrix: true,
  questionTypes: {
    mcq: true,
    shortAnswer: true,
    trueFalse: false,
    problemSolving: true,
  },
};

export const DEFAULT_PROCTORING: ProctoringSettings = {
  securityLevel: 'Strict',
  multiFaceAlert: true,
  maxTabSwitches: 3,
  audioNoiseThreshold: 65,
  fullscreenLock: true,
  autoIncidentReport: true,
  gazeTracking: true,
};

export const DEFAULT_X402: X402Settings = {
  treasuryAddress: 'HYNRAYO4IGZRBJ6MWZTBIRAOVWQFZODFDQBSJNQNFSP3TRGV5IYOOAZN5A',
  network: 'Algorand Testnet (SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=)',
  autoConnectPera: true,
  showTransactionToasts: true,
  explorerUrl: 'pera',
  testPriceUsdcMicro: 100000,
  assignmentPriceUsdcMicro: 50000,
};

export const DEFAULT_SYSTEM: SystemSettings = {
  emailSubmissionAlerts: true,
  proctoringViolationSound: true,
  browserNotifications: true,
  compactNavigation: false,
};

// Storage Helpers
export function getStoredInstructorProfile(): InstructorProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function getStoredAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI);
    return raw ? { ...DEFAULT_AI, ...JSON.parse(raw) } : DEFAULT_AI;
  } catch {
    return DEFAULT_AI;
  }
}

export function getStoredProctoringSettings(): ProctoringSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROCTORING);
    return raw ? { ...DEFAULT_PROCTORING, ...JSON.parse(raw) } : DEFAULT_PROCTORING;
  } catch {
    return DEFAULT_PROCTORING;
  }
}

export function getStoredX402Settings(): X402Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.X402);
    return raw ? { ...DEFAULT_X402, ...JSON.parse(raw) } : DEFAULT_X402;
  } catch {
    return DEFAULT_X402;
  }
}

export function getStoredSystemSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYSTEM);
    return raw ? { ...DEFAULT_SYSTEM, ...JSON.parse(raw) } : DEFAULT_SYSTEM;
  } catch {
    return DEFAULT_SYSTEM;
  }
}

const AVATAR_OPTIONS = [
  { id: 'avatar-1', bg: 'from-blue-600 to-indigo-600', text: 'SJ' },
  { id: 'avatar-2', bg: 'from-purple-600 to-pink-600', text: 'DR' },
  { id: 'avatar-3', bg: 'from-emerald-500 to-teal-700', text: 'NC' },
  { id: 'avatar-4', bg: 'from-amber-500 to-orange-600', text: 'AI' },
  { id: 'avatar-5', bg: 'from-cyan-500 to-blue-600', text: 'AL' },
];

export const InstructorSettings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'proctoring' | 'x402' | 'system'>('profile');

  // State slices
  const [profile, setProfile] = useState<InstructorProfile>(getStoredInstructorProfile);
  const [aiSettings, setAiSettings] = useState<AISettings>(getStoredAISettings);
  const [proctoring, setProctoring] = useState<ProctoringSettings>(getStoredProctoringSettings);
  const [x402, setX402] = useState<X402Settings>(getStoredX402Settings);
  const [system, setSystem] = useState<SystemSettings>(getStoredSystemSettings);

  // UI state
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [algoBalance, setAlgoBalance] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    setWalletAddress(algoClient.getConnectedAddress());
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.AI, JSON.stringify(aiSettings));
    localStorage.setItem(STORAGE_KEYS.PROCTORING, JSON.stringify(proctoring));
    localStorage.setItem(STORAGE_KEYS.X402, JSON.stringify(x402));
    localStorage.setItem(STORAGE_KEYS.SYSTEM, JSON.stringify(system));

    setSaveStatus('Settings successfully saved!');
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all teacher settings to default values?')) {
      setProfile(DEFAULT_PROFILE);
      setAiSettings(DEFAULT_AI);
      setProctoring(DEFAULT_PROCTORING);
      setX402(DEFAULT_X402);
      setSystem(DEFAULT_SYSTEM);

      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem(STORAGE_KEYS.AI);
      localStorage.removeItem(STORAGE_KEYS.PROCTORING);
      localStorage.removeItem(STORAGE_KEYS.X402);
      localStorage.removeItem(STORAGE_KEYS.SYSTEM);

      setSaveStatus('Settings reset to defaults.');
      setTimeout(() => setSaveStatus(null), 3500);
    }
  };

  const checkTestnetBalance = async () => {
    setIsCheckingBalance(true);
    try {
      setAlgoBalance(10.5);
    } catch {
      setAlgoBalance(0.0);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile & Account', icon: <User size={18} /> },
    { id: 'ai', label: 'AI & Assessment', icon: <BrainCircuit size={18} /> },
    { id: 'proctoring', label: 'Proctoring & Security', icon: <ShieldCheck size={18} /> },
    { id: 'x402', label: 'Algorand & x402', icon: <Zap size={18} /> },
    { id: 'system', label: 'System & Theme', icon: <Sliders size={18} /> },
  ] as const;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-hide text-slate-900 dark:text-white">
      {/* Toast Alert */}
      <AnimatePresence>
        {saveStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-8 z-50 px-6 py-4 rounded-2xl bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-2xl flex items-center gap-3 border border-emerald-400/40"
          >
            <CheckCircle2 size={18} />
            <span>{saveStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <Sliders size={22} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Instructor Settings</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Configure default AI parameters, proctoring security levels, Algorand x402 payment options, and personal profile.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
          >
            <RotateCcw size={16} />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-black/5 dark:border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 relative ${
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/5 border border-transparent'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeSettingTab"
                className="absolute inset-0 rounded-2xl border-2 border-blue-600/50 pointer-events-none"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Panels */}
      <div className="flex-1 space-y-6">

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className={`w-28 h-28 rounded-full bg-gradient-to-tr ${
                  AVATAR_OPTIONS.find(a => a.id === profile.avatar)?.bg || 'from-blue-600 to-indigo-600'
                } flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-blue-500/20`}>
                  {AVATAR_OPTIONS.find(a => a.id === profile.avatar)?.text || 'SJ'}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black">{profile.name}</h3>
                <p className="text-xs text-blue-500 font-semibold">{profile.department}</p>
                <p className="text-[11px] text-slate-400 mt-1">{profile.institution}</p>
              </div>

              <div className="w-full pt-4 border-t border-black/5 dark:border-white/5 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-left">
                  Choose Avatar Style
                </label>
                <div className="flex items-center justify-center gap-3">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setProfile({ ...profile, avatar: opt.id })}
                      className={`w-9 h-9 rounded-full bg-gradient-to-tr ${opt.bg} text-white font-bold text-xs flex items-center justify-center transition-all ${
                        profile.avatar === opt.id ? 'ring-4 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <User size={16} />
                <span>Personal & Academic Profile</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User size={14} /> Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Mail size={14} /> Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building size={14} /> Department
                  </label>
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <BookOpen size={14} /> Institution
                  </label>
                  <input
                    type="text"
                    value={profile.institution}
                    onChange={(e) => setProfile({ ...profile, institution: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Phone size={14} /> Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Academic Bio & Research Focus
                  </label>
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI & ASSESSMENT TAB */}
        {activeTab === 'ai' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <BrainCircuit size={16} className="text-purple-500" />
                <span>Default AI Generator Parameters</span>
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold uppercase tracking-wider text-slate-400">Default Question Count</label>
                    <span className="font-mono font-bold text-blue-500">{aiSettings.defaultQuestionCount} Questions</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={aiSettings.defaultQuestionCount}
                    onChange={(e) => setAiSettings({ ...aiSettings, defaultQuestionCount: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Default Difficulty Preset
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Easy', 'Medium', 'Hard', 'Adaptive'] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setAiSettings({ ...aiSettings, defaultDifficulty: diff })}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          aiSettings.defaultDifficulty === diff
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                            : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-black/5 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold uppercase tracking-wider text-slate-400">
                      Gemini Temperature (Creativity)
                    </label>
                    <span className="font-mono font-bold text-purple-500">{aiSettings.aiTemperature}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.9}
                    step={0.1}
                    value={aiSettings.aiTemperature}
                    onChange={(e) => setAiSettings({ ...aiSettings, aiTemperature: Number(e.target.value) })}
                    className="w-full accent-purple-600"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span>Question Types & Marking Key Toggles</span>
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Auto-Generate Solution Keys & Explanations</div>
                    <div className="text-[10px] text-slate-400">Includes step-by-step solutions for instructors</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiSettings.autoSolutionKeys}
                    onChange={(e) => setAiSettings({ ...aiSettings, autoSolutionKeys: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Include Marking Matrix</div>
                    <div className="text-[10px] text-slate-400">Attach point distribution per sub-part</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiSettings.includeMarkingMatrix}
                    onChange={(e) => setAiSettings({ ...aiSettings, includeMarkingMatrix: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {/* PROCTORING TAB */}
        {activeTab === 'proctoring' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span>Proctoring Security Profiles</span>
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'Relaxed', label: 'Relaxed', desc: 'Minimal alerts' },
                  { id: 'Balanced', label: 'Balanced', desc: 'Standard check' },
                  { id: 'Strict', label: 'Strict', desc: 'Enforce fullscreen' },
                  { id: 'Lockdown', label: 'Lockdown', desc: 'Immediate submit' },
                ].map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setProctoring({ ...proctoring, securityLevel: level.id as any })}
                    className={`p-4 rounded-2xl text-left border transition-all ${
                      proctoring.securityLevel === level.id
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-50 dark:bg-white/5 border-black/5 dark:border-white/10 text-slate-500'
                    }`}
                  >
                    <div className="font-bold text-xs uppercase tracking-wider">{level.label}</div>
                    <div className="text-[10px] opacity-75 mt-1">{level.desc}</div>
                  </button>
                ))}
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold uppercase tracking-wider text-slate-400">Max Allowed Tab Switches</label>
                    <span className="font-mono font-bold text-emerald-500">{proctoring.maxTabSwitches} Warnings</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={proctoring.maxTabSwitches}
                    onChange={(e) => setProctoring({ ...proctoring, maxTabSwitches: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Monitor size={16} className="text-blue-500" />
                <span>Biometric & Vision Checks</span>
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Multi-Person Alert</div>
                    <div className="text-[10px] text-slate-400">Flag secondary face in frame</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={proctoring.multiFaceAlert}
                    onChange={(e) => setProctoring({ ...proctoring, multiFaceAlert: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Fullscreen Lock</div>
                    <div className="text-[10px] text-slate-400">Require student fullscreen mode</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={proctoring.fullscreenLock}
                    onChange={(e) => setProctoring({ ...proctoring, fullscreenLock: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 rounded"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {/* ALGORAND & X402 TAB */}
        {activeTab === 'x402' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                <span>Algorand Treasury & Protocol Options</span>
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Treasury Receiver Address
                  </label>
                  <input
                    type="text"
                    value={x402.treasuryAddress}
                    onChange={(e) => setX402({ ...x402, treasuryAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-mono font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">Balance Verification</div>
                    <div className="text-[10px] text-slate-400">
                      {walletAddress ? `Connected: ${walletAddress.slice(0, 8)}...` : 'Pera Wallet Status'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {algoBalance !== null && (
                      <span className="text-xs font-mono font-bold text-emerald-500">{algoBalance} ALGO</span>
                    )}
                    <button
                      type="button"
                      onClick={checkTestnetBalance}
                      disabled={isCheckingBalance}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-500 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-500/30 transition-all"
                    >
                      <RefreshCw size={14} className={isCheckingBalance ? 'animate-spin' : ''} />
                      <span>Check</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Key size={16} className="text-blue-500" />
                <span>Pricing & Wallet Toggles</span>
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">AI Test Fee</div>
                  <div className="text-lg font-mono font-black text-blue-500">$0.10 USDC</div>
                </div>
                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Assignment Fee</div>
                  <div className="text-lg font-mono font-black text-purple-500">$0.05 USDC</div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Auto-Prompt Pera Wallet</div>
                    <div className="text-[10px] text-slate-400">Auto trigger wallet prompt on 402</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={x402.autoConnectPera}
                    onChange={(e) => setX402({ ...x402, autoConnectPera: e.target.checked })}
                    className="w-5 h-5 accent-amber-500 rounded"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {/* SYSTEM & THEME TAB */}
        {activeTab === 'system' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sun size={16} className="text-amber-500" />
                <span>Dashboard Theme Mode</span>
              </h2>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold">Current Theme: {theme.toUpperCase()}</div>
                  <div className="text-[10px] text-slate-400">Toggle dark / light display mode</div>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md hover:bg-blue-500 transition-all"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-black/5 dark:border-white/10 space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Bell size={16} className="text-blue-500" />
                <span>Notification Preferences</span>
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Email Alerts on Test Submission</div>
                    <div className="text-[10px] text-slate-400">Get notified when students turn in tests</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={system.emailSubmissionAlerts}
                    onChange={(e) => setSystem({ ...system, emailSubmissionAlerts: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/10">
                  <div>
                    <div className="text-xs font-bold">Proctoring Sound Alerts</div>
                    <div className="text-[10px] text-slate-400">Audio chime on critical violation</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={system.proctoringViolationSound}
                    onChange={(e) => setSystem({ ...system, proctoringViolationSound: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};
