import React from 'react';
import { Test, Theme } from '../../types';
import { 
  Building2, 
  Calendar, 
  Clock, 
  Layout, 
  Palette, 
  Timer,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';

interface SettingsTabProps {
  test: Test;
  setTest: React.Dispatch<React.SetStateAction<Test>>;
}

export default function SettingsTab({ test, setTest }: SettingsTabProps) {
  const updateSettings = (updates: Partial<Test['settings']>) => {
    setTest({ ...test, settings: { ...test.settings, ...updates } });
  };

  const icons = ['🎓', '🔬', '💻', '⚖️', '🏥', '🎨', '🚀', '🧠', '💼', '📚'];
  const themes = Object.values(Theme);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Configuration */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-6 mb-6 dark:border-slate-800">
            <Building2 size={20} className="text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Test Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Exam Title</label>
              <input
                value={test.settings.title}
                onChange={(e) => updateSettings({ title: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Institution Name</label>
              <input
                value={test.settings.institutionName}
                onChange={(e) => updateSettings({ institutionName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Duration (Minutes)</label>
              <input
                type="number"
                value={test.settings.duration}
                onChange={(e) => updateSettings({ duration: Number(e.target.value) })}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Total Marks</label>
              <input
                type="number"
                value={test.settings.totalMarks}
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Start Date & Time</label>
              <input
                type="datetime-local"
                value={test.settings.startDateTime || ''}
                onChange={(e) => updateSettings({ startDateTime: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">End Date & Time</label>
              <input
                type="datetime-local"
                value={test.settings.endDateTime || ''}
                onChange={(e) => updateSettings({ endDateTime: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pass Percentage (%)</label>
              <input
                type="number"
                value={Math.round((test.settings.passingMarks / (test.settings.totalMarks || 100)) * 100)}
                onChange={(e) => updateSettings({ passingMarks: Math.round((Number(e.target.value) / 100) * test.settings.totalMarks) })}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-6 mb-6 dark:border-slate-800">
            <Palette size={20} className="text-purple-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Appearance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="mb-4 block text-xs font-bold text-slate-700 dark:text-slate-300">Accent Color</label>
              <div className="flex items-center gap-4">
                 <input 
                   type="color" 
                   value={test.settings.accentColor}
                   onChange={(e) => updateSettings({ accentColor: e.target.value })}
                   className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-white outline-1 outline-indigo-600 p-0"
                 />
                 <div className="text-xs font-mono font-bold text-slate-500">{test.settings.accentColor.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Panel Styles */}
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
           <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Options</div>
           <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700">
                <input 
                  type="checkbox" 
                  checked={test.settings.shuffleQuestions}
                  onChange={(e) => updateSettings({ shuffleQuestions: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Shuffle Questions</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700">
                <input 
                  type="checkbox" 
                  checked={test.settings.shuffleOptions}
                  onChange={(e) => updateSettings({ shuffleOptions: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Shuffle Options</span>
              </label>
           </div>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl">
           <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Institution Branding</div>
           
           <div className="space-y-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Institution Logo URL (Image Address)</label>
                <input
                  value={test.settings.logoUrl || ''}
                  onChange={(e) => updateSettings({ logoUrl: e.target.value })}
                  placeholder="/logo.png"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {icons.map(icon => (
                  <button
                    key={icon}
                    onClick={() => updateSettings({ institutionIcon: icon })}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-all ${
                      test.settings.institutionIcon === icon 
                        ? 'bg-indigo-600 shadow-lg' 
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
           </div>
           <p className="text-[10px] text-slate-500 font-medium">Selected logo or icon will appear on exam portal and certificates.</p>
        </div>
      </div>
    </div>
  );
}
