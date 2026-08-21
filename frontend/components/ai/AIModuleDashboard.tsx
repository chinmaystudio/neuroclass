import React from 'react';

import { 
  BrainCircuit, X, Activity, Layers, CornerDownRight 
} from 'lucide-react';

export const AIModuleDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-black flex flex-col font-sans overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <header className="h-20 border-b border-black/5 dark:border-white/5 flex items-center justify-between px-10 relative z-10 backdrop-blur-3xl bg-white/40 dark:bg-black/40">
        <div className="flex items-center gap-4">
          <img src="/logo-light.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain block dark:hidden drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
          <img src="/logo-dark.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.3em]">AI Module Registry</h1>
            <p className="text-[9px] opacity-40 font-bold uppercase tracking-widest text-[#64748b]">Localized Intelligence Platform</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-90 cursor-pointer"
        >
          <X size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-10 relative z-10 flex items-center justify-center">
        <div className="max-w-3xl w-full p-12 rounded-[40px] bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-center space-y-10 shadow-2xl">
          <div className="w-24 h-24 rounded-[32px] bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto">
            <Layers size={48} className="animate-pulse" />
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white uppercase">Decentralized AI Architecture Active</h2>
            <p className="text-slate-500 dark:text-white/40 text-sm max-w-xl mx-auto leading-relaxed">
              We have migrated and localized key AI functionalities from this global dashboard straight into **individual classrooms** to ensure rigorous scope containment, private context-safety, and precise evaluation mapping.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-left space-y-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">How to access AI tools now:</p>
            <div className="space-y-3">
              {[
                "Open any specific classroom from your Teacher Panel.",
                "Explore the new centralized tabs directly on the classroom workspace.",
                "Leverage localized OCR Test Evaluator, Rubric Grading, RAG Knowledge indexing, and performance analytics for that classroom context."
              ].map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CornerDownRight size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs transition-opacity">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={onClose}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-500/20 active:scale-95 transition-transform"
          >
            Go to Your Classrooms
          </button>
        </div>
      </main>

      <footer className="h-16 border-t border-black/5 dark:border-white/5 flex items-center justify-between px-10 bg-white/40 dark:bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest opacity-40">
           <Activity size={12} className="text-indigo-500" /> Distributed Node Environment Ready
        </div>
        <p className="text-[8px] font-bold uppercase tracking-widest opacity-40">© 2026 NeuroClass Decentralized Grader System</p>
      </footer>


    </div>
  );
};
