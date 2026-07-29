import React, { useState, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { 
  Type, 
  Image as ImageIcon, 
  Minus, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Settings as SettingsIcon,
  Heading as HeadingIcon,
  BarChart2,
  List,
  Clock,
  Maximize2,
  AlertTriangle,
  Activity,
  Terminal,
  X,
  Move
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Test, LayoutModule, LayoutModuleType } from '../../types';

interface DesignerTabProps {
  test: Test;
  setTest: React.Dispatch<React.SetStateAction<Test>>;
}

const ToolboxItem = ({ type, icon: Icon, label, onClick }: { type: LayoutModuleType, icon: any, label: string, onClick: () => void }) => {
  return (
    <div 
      className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group dark:bg-slate-900 dark:border-slate-800"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors dark:bg-slate-800">
        <Icon size={18} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
      <div className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-indigo-600">
        <Plus size={14} />
      </div>
    </div>
  );
};

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

export default function DesignerTab({ test, setTest, selectedModuleId, setSelectedModuleId }: DesignerTabProps & { selectedModuleId: string | null, setSelectedModuleId: (id: string | null) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const textColor = getContrastColor(test.appearance.canvasBg);
  const secondaryColor = getSecondaryColor(test.appearance.canvasBg);

  const updateModule = (id: string, updates: Partial<LayoutModule>) => {
    setTest(prev => ({
      ...prev,
      layout: prev.layout.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0 -mx-10 -mt-2 overflow-hidden border-t border-slate-200 dark:border-slate-800">
      {/* Canvas - Main Area */}
      <main 
        className="flex-1 relative overflow-hidden bg-slate-200/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedModuleId(null);
        }}
      >
        <div 
          ref={canvasRef}
          className="w-full h-full relative overflow-auto shadow-2xl transition-colors duration-500 border border-slate-300 rounded-sm"
          style={{ backgroundColor: test.appearance.canvasBg }}
        >
          {/* Grid lines for visual aid */}
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{ 
            backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />

          {test.layout.map((module) => (
            <Rnd
              key={module.id}
              size={{ width: module.size.width, height: module.size.height }}
              position={{ x: module.position.x, y: module.position.y }}
              onDragStop={(e, d) => {
                updateModule(module.id, { position: { x: d.x, y: d.y } });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                updateModule(module.id, {
                  size: { width: ref.style.width, height: ref.style.height },
                  position: { x: position.x, y: position.y }
                });
              }}
              bounds="parent"
              enableResizing={{
                bottomRight: true,
                bottom: true,
                right: true,
                topLeft: true,
                top: true,
                left: true,
                topRight: true,
                bottomLeft: true
              }}
              onMouseDown={() => setSelectedModuleId(module.id)}
              className={`group ${selectedModuleId === module.id ? 'z-50' : 'z-10'}`}
              dragHandleClassName="drag-surface"
            >
              <div 
                className={`drag-surface relative w-full h-full p-4 transition-all ${
                  selectedModuleId === module.id 
                    ? 'ring-2 ring-blue-500 bg-blue-500/5' 
                    : 'hover:ring-1 hover:ring-slate-300'
                }`}
              >
                {/* Visual Editing Components removed from canvas as per user request */}
                
                {/* Module Previews */}

                <div className="w-full h-full overflow-hidden">
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
                      {module.content || 'Edit text content...'}
                    </p>
                  )}
                  {module.type === LayoutModuleType.Image && (
                    <div className="w-full h-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                      <img src={module.url} alt="Media" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {module.type === LayoutModuleType.Divider && (
                    <div className="h-0.5 bg-slate-200 w-full dark:bg-slate-800 my-auto" />
                  )}
                  {module.type === LayoutModuleType.QuestionBox && (
                    <div className="w-full h-full min-h-[100px] border-2 border-indigo-100 bg-indigo-50/20 rounded-2xl border-dashed flex flex-col items-center justify-center gap-2">
                       <HelpCircle className="text-indigo-500" size={24} />
                       <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">Question Content</span>
                    </div>
                  )}
                  {module.type === LayoutModuleType.QuestionSwitcher && (
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-xl w-full h-full overflow-hidden">
                       {[1, 2, 3, 4, 5, 6].map(i => (
                         <div key={i} className={`w-8 h-8 rounded-lg text-[8px] font-black flex items-center justify-center ${i === 1 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                           {i}
                         </div>
                       ))}
                    </div>
                  )}
                  {module.type === LayoutModuleType.StatsBox && (
                    <div className="w-full h-full min-h-[80px] grid grid-cols-2 bg-slate-50/80 border border-slate-200 rounded-xl dark:bg-slate-800/50">
                       <div className="flex flex-col items-center justify-center border-r border-slate-200">
                          <span className="text-lg font-black text-indigo-600">--</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Done</span>
                       </div>
                       <div className="flex flex-col items-center justify-center">
                          <span className="text-lg font-black text-slate-400">--</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Left</span>
                       </div>
                    </div>
                  )}
                  {module.type === LayoutModuleType.Timer && (
                    <div className="w-full h-full min-h-[60px] flex items-center justify-center gap-3 bg-slate-900 rounded-xl text-white shadow-xl px-4">
                       <Clock size={16} className="text-indigo-500" />
                       <div className="text-lg font-black font-mono tracking-tighter">00:00:00</div>
                    </div>
                  )}
                  {module.type === LayoutModuleType.SectionNav && (
                    <div className="flex gap-1 overflow-hidden h-full items-center">
                       {[1, 2, 3].map(i => (
                         <div key={i} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${i === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                           S{i}
                         </div>
                       ))}
                    </div>
                  )}
                  {module.type === LayoutModuleType.Alert && (
                    <div 
                      style={{ 
                        backgroundColor: module.style?.backgroundColor || 'rgb(255 251 235)',
                        borderColor: module.style?.backgroundColor ? 'transparent' : 'rgb(251 191 36 / 0.2)'
                      }}
                      className="flex items-start gap-3 p-3 border rounded-xl h-full overflow-hidden"
                    >
                       <AlertTriangle className="text-amber-600 shrink-0" size={16} />
                       <p 
                         style={{ 
                           color: module.style?.textColor,
                           fontSize: module.style?.fontSize,
                           textAlign: module.style?.textAlign
                         }}
                         className={`text-[10px] leading-tight font-bold ${!module.style?.textColor ? 'text-amber-700' : ''}`}
                       >
                         {module.content || 'Alert Message'}
                       </p>
                    </div>
                  )}
                  {module.type === LayoutModuleType.Progress && (
                    <div className="space-y-1 w-full flex flex-col justify-center h-full">
                       <div className="flex justify-between items-center px-1">
                          <span className={`text-[8px] font-black uppercase tracking-tighter ${secondaryColor}`}>Total Progress</span>
                          <span className="text-[8px] font-black text-indigo-600">35%</span>
                       </div>
                       <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 w-[35%] rounded-full shadow-sm" />
                       </div>
                    </div>
                  )}
                  {module.type === LayoutModuleType.SystemLog && (
                    <div className="bg-slate-900 rounded-xl p-3 font-mono text-[8px] text-emerald-400 border border-slate-800 h-full overflow-hidden">
                       <div className="opacity-40 mb-1 flex items-center gap-1 border-b border-white/5 pb-1"><Terminal size={10}/> LOG</div>
                       <div className="truncate">&gt; Secure session active</div>
                       <div className="truncate">&gt; Proctored environment</div>
                    </div>
                  )}
                </div>
              </div>
            </Rnd>
          ))}
        </div>
      </main>
    </div>
  );
}
