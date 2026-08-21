import React, { useState } from 'react';
import { Test, QuestionType, LayoutModuleType } from '../../types';
import { Clock, HelpCircle, AlertTriangle, Terminal, PlayCircle, Eye, Shield, Lock, Monitor, Layout } from 'lucide-react';
import ExamPortal from '../exams/ExamPortal';

interface PreviewTabProps {
  test: Test;
}

export default function PreviewTab({ test }: PreviewTabProps) {
  const [showFullPreview, setShowFullPreview] = useState(false);
  const sampleQuestions = test.sections[0]?.questions || [];
  
  if (showFullPreview) {
    return <ExamPortal test={test} attemptId="demo-attempt" onExit={() => setShowFullPreview(false)} isDemo={true} />;
  }

  return (
    <div className="space-y-8">
      {/* Launch Banner */}
      <div className="bg-indigo-600 rounded-3xl p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl shadow-indigo-100">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10 space-y-4 text-center md:text-left">
           <div className="flex items-center gap-3 justify-center md:justify-start">
             <Eye size={20} className="text-indigo-200" />
             <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-200">Immersion Mode</span>
           </div>
           <h2 className="text-4xl font-black tracking-tight leading-tight">Test Actual Environment</h2>
           <p className="text-indigo-100 font-medium max-w-lg opacity-80">
             Launch the student-facing portal to verify proctoring rules, layout responsiveness, and examination flow in a simulated high-stakes atmosphere.
           </p>
        </div>

        <button 
          onClick={() => setShowFullPreview(true)}
          className="relative z-10 px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] shadow-xl hover:scale-105 transition-all flex items-center gap-4"
        >
          <PlayCircle size={20} />
          Launch Live Preview
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Layout Consistency Check</h3>
            <div className="aspect-video bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden relative shadow-inner">
               {/* Quick Mini Map of the Canvas */}
               <div className="absolute inset-0 bg-white origin-top-left scale-[0.25] pointer-events-none">
                  {test.layout.map(m => (
                    <div 
                      key={m.id} 
                      className="absolute border border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden"
                      style={{
                        left: m.position.x,
                        top: m.position.y,
                        width: m.size.width,
                        height: m.size.height
                      }}
                    >
                      <span className="text-[8px] font-bold text-slate-300">{m.type}</span>
                    </div>
                  ))}
               </div>
               <div className="absolute inset-0 flex items-center justify-center p-12 text-center">
                  <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white shadow-xl max-w-xs">
                     <p className="text-xs font-bold text-slate-600 mb-2">Static Snapshot</p>
                     <p className="text-[10px] text-slate-400 font-medium">Use 'Launch Live Preview' to interact with the full engine.</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Proctoring Rules Status</h3>
            <div className="grid grid-cols-1 gap-3">
               {[
                 { label: 'Fullscreen Enforcement', status: true, icon: <Layout size={16}/> },
                 { label: 'Tab Switch Detection', status: test.proctoring.tabSwitchDetection, icon: <Monitor size={16}/> },
                 { label: 'Face Tracking', status: test.proctoring.faceDetection, icon: <Eye size={16}/> },
                 { label: 'Browser Lockdown', status: test.proctoring.level === 'strict' || test.proctoring.level === 'full-ai', icon: <Lock size={16}/> }
               ].map((rule, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                       <div className={`p-2 rounded-xl scale-75 ${rule.status ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
                          {rule.icon || <Shield size={20} />}
                       </div>
                       <span className={`text-[11px] font-bold uppercase tracking-widest ${rule.status ? 'text-slate-700' : 'text-slate-300'}`}>{rule.label}</span>
                    </div>
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full border ${rule.status ? 'border-emerald-500/20 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
                       {rule.status ? 'ENGAGED' : 'DISABLED'}
                    </span>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
