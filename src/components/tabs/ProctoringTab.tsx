import React from 'react';
import { Test } from '../../types';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Eye, 
  Monitor, 
  Mic, 
  Smartphone,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ProctoringTabProps {
  test: Test;
  setTest: React.Dispatch<React.SetStateAction<Test>>;
}

export default function ProctoringTab({ test, setTest }: ProctoringTabProps) {
  const updateProctoring = (updates: Partial<Test['proctoring']>) => {
    setTest({ ...test, proctoring: { ...test.proctoring, ...updates } });
  };

  const levels = [
    { 
      id: 'basic', 
      label: 'Basic Proctoring', 
      icon: Shield, 
      color: 'blue',
      features: ['Tab Switch Detection', 'Simple Timer', 'Full Screen Enforcement']
    },
    { 
      id: 'strict', 
      label: 'Strict Proctoring', 
      icon: ShieldAlert, 
      color: 'orange',
      features: ['Basic +', 'Face Detection', 'Browser Lockdown', 'Copy-Paste Disabled']
    },
    { 
      id: 'full-ai', 
      label: 'Full AI Suite', 
      icon: ShieldCheck, 
      color: 'purple',
      features: ['Strict +', 'Gaze Tracking', 'Object Detection (Phone)', 'Voices Detection', 'Advanced Analytics']
    }
  ];

  return (
    <div className="space-y-8">
      {/* Master Toggle */}
      <div className={`flex items-center justify-between rounded-xl border border-slate-200 p-8 transition-all bg-white dark:bg-slate-900 dark:border-slate-800`}>
        <div className="flex items-center gap-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
            test.proctoring.enabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
          }`}>
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Proctoring Suite</h2>
            <p className="text-sm font-medium text-slate-500">Enable advanced monitoring to prevent academic dishonesty.</p>
          </div>
        </div>
        <button
          onClick={() => updateProctoring({ enabled: !test.proctoring.enabled })}
          className={`relative flex h-8 w-14 items-center rounded-full transition-all ${
            test.proctoring.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <div className={`h-6 w-6 translate-x-1 rounded-full bg-white shadow-sm transition-all ${
            test.proctoring.enabled ? 'translate-x-7' : ''
          }`} />
        </button>
      </div>

      {test.proctoring.enabled && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 dark:bg-slate-900 dark:border-slate-800">
           <div className="flex items-center justify-between mb-8">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Security Configuration Matrix</div>
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold underline cursor-pointer">Change Status Level</div>
           </div>

           <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { id: 'tabSwitchDetection', label: 'Tab Focus', icon: Monitor },
                { id: 'faceDetection', label: 'Face Det.', icon: Shield },
                { id: 'gazeDetection', label: 'Eye Gaze', icon: Eye },
                { id: 'audioDetection', label: 'Voice Det.', icon: Mic },
                { id: 'deviceDetection', label: 'Phone Det.', icon: Smartphone },
                { id: 'deskScan', label: 'Desk Scan', icon: ShieldCheck }
              ].map((feature) => {
                const featureKey = feature.id as keyof Test['proctoring'];
                const isActive = !!test.proctoring[featureKey];
                return (
                  <button
                    key={feature.id}
                    onClick={() => updateProctoring({ [feature.id]: !isActive })}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-xs font-bold ${
                      isActive 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    <feature.icon size={14} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                    {feature.label}
                  </button>
                )
              })}
           </div>

           <div className="mt-8 flex items-start gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg dark:bg-indigo-900/10 dark:border-indigo-800/30">
              <AlertTriangle className="text-indigo-600 shrink-0" size={18} />
              <div className="text-xs text-indigo-800 dark:text-indigo-400 leading-relaxed">
                 <span className="font-bold uppercase tracking-wider block mb-1">Strict Mode Recommendation</span>
                 For high-stakes exams, we recommend enabling Face Detection and Gaze Tracking alongside full-screen enforcement to ensure maximum integrity.
              </div>
           </div>
        </div>
      )}
      
      {test.proctoring.enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {levels.map((level) => (
            <div
              key={level.id}
              className={`flex flex-col items-start rounded-xl border border-slate-200 p-6 bg-white dark:bg-slate-900 dark:border-slate-800 ${
                test.proctoring.level === level.id ? 'border-2 border-indigo-600' : ''
              }`}
            >
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white mb-2">{level.label}</h3>
              <p className="text-[11px] text-slate-400 mb-4">Optimized for different security needs.</p>
              <button 
                onClick={() => updateProctoring({ level: level.id as any })}
                className={`mt-auto w-full py-2 rounded-lg text-xs font-bold transition-all ${
                  test.proctoring.level === level.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {test.proctoring.level === level.id ? 'Selected' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
