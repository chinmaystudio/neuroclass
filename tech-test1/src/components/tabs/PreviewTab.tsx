import React from 'react';
import { Test, QuestionType, LayoutModuleType } from '../../types';
import { Clock, HelpCircle, AlertTriangle, Terminal } from 'lucide-react';

interface PreviewTabProps {
  test: Test;
}

const getContrastColor = (hex: string) => {
  if (!hex || hex.length < 7) return 'text-slate-900';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? 'text-slate-900' : 'text-white';
};

const getSecondaryColor = (hex: string) => {
  if (!hex || hex.length < 7) return 'text-slate-500';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? 'text-slate-500' : 'text-slate-400';
};

export default function PreviewTab({ test }: PreviewTabProps) {
  const sampleQuestions = test.sections[0]?.questions || [];
  const currentQuestion = sampleQuestions[0];
  const textColor = getContrastColor(test.appearance.canvasBg);
  const secondaryColor = getSecondaryColor(test.appearance.canvasBg);

  return (
    <div 
      className="min-h-screen -mx-10 -mt-8 py-4 transition-colors duration-500 overflow-hidden"
      style={{ 
        backgroundColor: test.appearance.canvasBg,
        fontFamily: test.appearance.fontFamily
      }}
    >
      <div className="w-full h-full relative min-h-screen">
        {/* Render Layout Modules with Absolute Positioning - matching Designer layout precisely */}
        {test.layout.map((module) => (
          <div 
            key={module.id} 
            className="absolute transition-all duration-300 overflow-hidden p-4"
            style={{
              left: module.position.x,
              top: module.position.y,
              width: module.size.width,
              height: module.size.height,
            }}
          >
            {module.type === LayoutModuleType.Heading && (
              <h2 
                style={{ 
                  color: module.style?.textColor,
                  fontSize: module.style?.fontSize,
                  textAlign: module.style?.textAlign
                }}
                className={`text-3xl font-black tracking-tight leading-tight ${!module.style?.textColor ? textColor : ''}`}
              >
                {module.content || 'Section Header'}
              </h2>
            )}

            {module.type === LayoutModuleType.Text && (
              <p 
                style={{ 
                  color: module.style?.textColor,
                  fontSize: module.style?.fontSize,
                  textAlign: module.style?.textAlign
                }}
                className={`text-base leading-relaxed ${!module.style?.textColor ? secondaryColor : ''}`}
              >
                {module.content || 'Text content...'}
              </p>
            )}

            {module.type === LayoutModuleType.Image && (
              <div className="w-full h-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                <img src={module.url} alt="Exam asset" className="w-full h-full object-cover" />
              </div>
            )}

            {module.type === LayoutModuleType.Divider && (
              <div className="h-0.5 bg-slate-200/50 w-full my-auto" />
            )}

            {module.type === LayoutModuleType.QuestionBox && (
              <div className={`p-6 bg-white rounded-2xl border border-slate-100 h-full w-full overflow-y-auto shadow-xl`}>
                {currentQuestion ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Question 01</span>
                         <h3 className="text-xl font-bold text-slate-900 leading-tight">
                           {currentQuestion.title}
                         </h3>
                      </div>
                      <div className="bg-slate-50 px-3 py-1 rounded-xl text-[10px] font-black text-slate-400">
                        {currentQuestion.marks} MARKS
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                       {currentQuestion.options.map(opt => (
                         <label key={opt.id} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:border-indigo-200 transition-all">
                           <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                           <span className="text-slate-700 font-bold text-sm">{opt.text}</span>
                         </label>
                       ))}
                       
                       {(currentQuestion.type === QuestionType.ShortAnswer || currentQuestion.type === QuestionType.Essay) && (
                         <textarea 
                           className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                           placeholder="Write your response here..."
                           rows={currentQuestion.type === QuestionType.Essay ? 6 : 2}
                         />
                       )}
                    </div>

                    <div className="flex justify-between pt-2">
                       <button className="px-6 py-2 bg-slate-100 text-slate-400 font-black rounded-lg text-[10px] uppercase tracking-widest cursor-not-allowed">Previous</button>
                       <button className="px-6 py-2 bg-indigo-600 text-white font-black rounded-lg text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Next Question</button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                     <HelpCircle size={32} />
                     <p className="font-bold text-xs uppercase tracking-widest">Question Area Content</p>
                  </div>
                )}
              </div>
            )}

            {module.type === LayoutModuleType.StatsBox && (
              <div className="w-full h-full min-h-[80px] grid grid-cols-2 bg-white border border-slate-200 rounded-xl shadow-lg">
                 <div className="flex flex-col items-center justify-center border-r border-slate-200">
                    <span className="text-xl font-black text-indigo-600">--</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Done</span>
                 </div>
                 <div className="flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-slate-400">--</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Left</span>
                 </div>
              </div>
            )}

            {module.type === LayoutModuleType.Timer && (
              <div className="w-full h-full flex items-center justify-center gap-4 bg-slate-900 rounded-xl text-white shadow-2xl px-6">
                 <Clock size={20} className="text-indigo-500" />
                 <div className="text-xl font-black font-mono tracking-tighter opacity-90">
                   {test.settings.duration}:00:00
                 </div>
              </div>
            )}

            {module.type === LayoutModuleType.SectionNav && (
              <div className="flex gap-2 h-full items-center">
                 {test.sections.map((s, idx) => (
                   <button 
                     key={s.id}
                     className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap shadow-sm ${
                       idx === 0 
                         ? 'bg-indigo-600 text-white' 
                         : 'bg-white text-slate-400 border border-slate-100'
                     }`}
                   >
                     {s.title || `Section ${idx + 1}`}
                   </button>
                 ))}
              </div>
            )}

            {module.type === LayoutModuleType.Alert && (
              <div 
                style={{ 
                  backgroundColor: module.style?.backgroundColor || 'rgb(255 251 235)',
                  borderColor: module.style?.backgroundColor ? 'transparent' : 'rgb(251 191 36 / 0.2)'
                }}
                className="flex items-start gap-3 p-4 border rounded-xl h-full shadow-lg"
              >
                 <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">Notice</p>
                    <p 
                      style={{ 
                        color: module.style?.textColor,
                        fontSize: module.style?.fontSize,
                        textAlign: module.style?.textAlign
                      }}
                      className={`text-xs leading-tight font-bold ${!module.style?.textColor ? 'text-amber-700' : ''}`}
                    >
                      {module.content}
                    </p>
                 </div>
              </div>
            )}

            {module.type === LayoutModuleType.Progress && (
              <div className="space-y-1.5 w-full flex flex-col justify-center h-full">
                 <div className="flex justify-between items-center px-1">
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${secondaryColor}`}>Total Progress</span>
                    <span className="text-[10px] font-black text-indigo-600">35%</span>
                 </div>
                 <div className="h-2 bg-slate-200/30 rounded-full overflow-hidden w-full backdrop-blur-sm">
                    <div className="h-full bg-indigo-600 w-[35%] rounded-full shadow-sm" />
                 </div>
              </div>
            )}

            {module.type === LayoutModuleType.SystemLog && (
              <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-emerald-400 border border-slate-800 h-full overflow-hidden shadow-2xl">
                 <div className="opacity-40 mb-2 flex items-center gap-2 border-b border-white/5 pb-1"><Terminal size={12}/> LOG VIEW</div>
                 <div className="truncate">&gt; Secure session initialized</div>
                 <div className="truncate">&gt; Monitoring system active</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
