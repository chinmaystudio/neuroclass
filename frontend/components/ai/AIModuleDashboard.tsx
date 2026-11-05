import React from 'react';

import { 
  BrainCircuit, X, Activity, Layers, CornerDownRight 
} from '../ui/icons-compat';

export const AIModuleDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-surface-2 flex flex-col font-sans overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-primary-light hidden rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-primary-light hidden rounded-full" />
      </div>

      <header className="h-20 border-b border-line flex items-center justify-between px-10 relative z-10 bg-surface ">
        <div className="flex items-center gap-4">
          <img src="/logo-light.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain block dark:hidden drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
          <img src="/logo-dark.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
          <div>
            <h1 className="text-sm font-semibold ">AI Module Registry</h1>
            <p className="text-meta opacity-40 font-bold text-white">Localized Intelligence Platform</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full border border-line flex items-center justify-center hover:bg-danger-bg hover:text-danger-ink transition-all active:scale-90 cursor-pointer"
        >
          <X size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-10 relative z-10 flex items-center justify-center">
        <div className="max-w-3xl w-full p-12 rounded-card bg-surface border border-line text-center space-y-10 shadow-raised">
          <div className="w-24 h-24 rounded-card bg-primary-light flex items-center justify-center text-primary mx-auto">
            <Layers size={48} className="animate-pulse" />
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-light tracking-tight text-ink ">Decentralized AI Architecture Active</h2>
            <p className="text-ink-2 text-sm max-w-xl mx-auto leading-relaxed">
              We have migrated and localized key AI functionalities from this global dashboard straight into **individual classrooms** to ensure rigorous scope containment, private context-safety, and precise evaluation mapping.
            </p>
          </div>

          <div className="p-6 rounded-card bg-surface-2 border border-line text-left space-y-4">
            <p className="text-meta font-semibold text-primary">How to access AI tools now:</p>
            <div className="space-y-3">
              {[
                "Open any specific classroom from your Teacher Panel.",
                "Explore the new centralized tabs directly on the classroom workspace.",
                "Leverage localized OCR Test Evaluator, Rubric Grading, RAG Knowledge indexing, and performance analytics for that classroom context."
              ].map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CornerDownRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs transition-opacity">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={onClose}
            className="px-8 py-4 bg-primary text-on-primary rounded-card font-bold text-meta shadow-raised active:scale-95 transition-transform"
          >
            Go to Your Classrooms
          </button>
        </div>
      </main>

      <footer className="h-16 border-t border-line flex items-center justify-between px-10 bg-surface ">
        <div className="flex items-center gap-2 text-meta font-bold opacity-40">
           <Activity size={12} className="text-primary" /> Distributed Node Environment Ready
        </div>
        <p className="text-meta font-bold opacity-40">© 2026 NeuroClass Decentralized Grader System</p>
      </footer>


    </div>
  );
};
