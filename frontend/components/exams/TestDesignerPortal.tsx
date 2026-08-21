import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Save, Send, Layout, FileText, 
  Settings as SettingsIcon, ShieldCheck, 
  PlayCircle, Minus, Plus, ChevronLeft,
  ChevronRight, Laptop, Monitor, Tablet,
  Eye, MonitorIcon, Smartphone,
  PanelLeftClose, PanelLeftOpen,
  Box, Sparkles, Layers, History,
  Type, Image as ImageIcon, HelpCircle, 
  BarChart2, List, Clock as ClockIcon,
  Maximize2, AlertTriangle, Activity, Terminal,
  Heading as HeadingIcon
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Test, Theme, LayoutModuleType } from '../../types';
import BuilderTab from '../tabs/BuilderTab';
import DesignerTab from '../tabs/DesignerTab';
import ProctoringTab from '../tabs/ProctoringTab';
import SettingsTab from '../tabs/SettingsTab';
import PreviewTab from '../tabs/PreviewTab';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TestDesignerPortalProps {
  initialTest?: Test;
  onClose: () => void;
  onSave: (test: Test) => void;
  onPublish: (test: Test) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
  isPublishing?: boolean;
}

export default function TestDesignerPortal({ 
  initialTest, 
  onClose, 
  onSave, 
  onPublish,
  onShowToast,
  isPublishing = false
}: TestDesignerPortalProps) {
  const [activeTab, setActiveTab] = useState<'builder' | 'designer' | 'proctoring' | 'settings' | 'preview'>('builder');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  
  const addModule = (type: LayoutModuleType) => {
    const newId = uuidv4();
    const newModule = { 
      id: newId, 
      type, 
      content: type === LayoutModuleType.Heading ? 'New Heading' : 
               type === LayoutModuleType.Text ? 'Enter text here...' : 
               type === LayoutModuleType.Alert ? 'Important Notice' : '',
      position: { x: 50, y: 150 },
      size: { 
        width: type === LayoutModuleType.Heading || type === LayoutModuleType.Text || type === LayoutModuleType.Divider ? 600 : 300, 
        height: 'auto' 
      }
    };

    setTest(prev => ({ 
      ...prev, 
      layout: [...prev.layout, newModule] 
    }));
    setSelectedModuleId(newId);
  };

  const removeModule = (id: string) => {
    setTest(prev => ({ ...prev, layout: prev.layout.filter(m => m.id !== id) }));
    if (selectedModuleId === id) setSelectedModuleId(null);
  };

  const updateModule = (id: string, updates: any) => {
    setTest(prev => ({
      ...prev,
      layout: prev.layout.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const updateAppearance = (updates: any) => {
    setTest(prev => ({ ...prev, appearance: { ...prev.appearance, ...updates } }));
  };
  
  const [test, setTest] = useState<Test>(initialTest || {
    id: uuidv4(),
    settings: {
      title: 'New Examination',
      institutionName: 'NeuroClass Academy',
      institutionIcon: '🎓',
      duration: 60,
      totalMarks: 0,
      passingMarks: 0,
      maxAttempts: 1,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultImmediately: true,
      theme: Theme.Default,
      accentColor: '#4f46e5'
    },
    proctoring: {
      enabled: true,
      level: 'strict',
      tabSwitchDetection: true,
      faceDetection: true,
      gazeDetection: false,
      audioDetection: false,
      deviceDetection: false
    },
    sections: [
      {
        id: 'section-1',
        title: 'General Section',
        questions: [],
        defaultMarks: 1,
        defaultNegativeMarks: 0
      }
    ],
    layout: [
      {
        id: 'layout-1',
        type: LayoutModuleType.Heading,
        content: 'MIDTERM EXAMINATION',
        position: { x: 50, y: 50 },
        size: { width: 400, height: 'auto' }
      }
    ],
    appearance: {
      canvasBg: '#f8fafc',
      containerWidth: 'medium',
      cardStyle: 'glass',
      fontFamily: 'Inter'
    }
  });

  // Sync total marks whenever sections or questions change
  useEffect(() => {
    const totalMarks = test.sections.reduce((acc, s) => 
      acc + s.questions.reduce((qAcc, q) => qAcc + q.marks, 0), 0
    );
    
    if (test.settings.totalMarks !== totalMarks) {
      setTest(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          totalMarks,
          // Also update passing marks if it was 0 or should scale
          passingMarks: prev.settings.passingMarks || Math.round(totalMarks * 0.4)
        }
      }));
    }
  }, [test.sections]);

  const tabs = [
    { id: 'builder', label: 'Questions', icon: <FileText size={18} />, desc: 'Build your exam questions' },
    { id: 'designer', label: 'Interface', icon: <Layout size={18} />, desc: 'Design the visual layout' },
    { id: 'proctoring', label: 'Security', icon: <ShieldCheck size={18} />, desc: 'AI Proctoring settings' },
    { id: 'settings', label: 'Configuration', icon: <SettingsIcon size={18} />, desc: 'Time, marks & access' },
    { id: 'preview', label: 'Live Preview', icon: <PlayCircle size={18} />, desc: 'See how students see it' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#f8fafc] dark:bg-[#020617] flex flex-col font-sans overflow-hidden"
    >
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 z-50">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors group"
            title="Exit Designer"
          >
            <ChevronLeft size={20} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
          </button>
          
          <div className="h-6 w-px bg-black/10 dark:bg-white/10" />
          
          <div className="flex flex-col">
            <input 
              value={test.settings.title}
              onChange={(e) => setTest({ ...test, settings: { ...test.settings, title: e.target.value } })}
              className="bg-transparent border-none p-0 text-sm font-bold text-slate-900 dark:text-white focus:ring-0 w-64"
              placeholder="Test Title"
            />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Draft • Last saved just now</span>
          </div>
        </div>

        {/* Viewport Toggles (only for Designer/Preview) */}
        {(activeTab === 'designer' || activeTab === 'preview') && (
          <div className="hidden md:flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
            <button 
              onClick={() => setViewport('desktop')}
              className={cn("p-1.5 rounded-lg transition-all", viewport === 'desktop' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <Monitor size={16} />
            </button>
            <button 
              onClick={() => setViewport('tablet')}
              className={cn("p-1.5 rounded-lg transition-all", viewport === 'tablet' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <Tablet size={16} />
            </button>
            <button 
              onClick={() => setViewport('mobile')}
              className={cn("p-1.5 rounded-lg transition-all", viewport === 'mobile' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <Smartphone size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button 
            onClick={() => onSave(test)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-black/5 dark:text-white/40 dark:hover:text-white transition-all"
          >
            <Save size={14} /> Save Draft
          </button>
          <button 
            onClick={() => onPublish(test)}
            disabled={isPublishing}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50"
          >
            {isPublishing ? <span className="flex items-center gap-2"><History size={14} className="animate-spin" /> Publishing...</span> : <><Send size={14} /> Publish Test</>}
          </button>
          
          <div className="w-px h-8 bg-black/10 dark:bg-white/10 mx-2" />
          
          <button 
            onClick={onClose}
            className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Navigation */}
        <aside 
          className={cn(
            "bg-white dark:bg-[#0a0a0a] border-r border-black/5 dark:border-white/5 transition-all duration-500 flex flex-col",
            sidebarOpen ? "w-64" : "w-16"
          )}
        >
          <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all relative group overflow-hidden",
                  activeTab === tab.id 
                    ? "bg-blue-600/5 text-blue-600 dark:bg-blue-400/5 dark:text-blue-400" 
                    : "text-slate-400 dark:text-white/20 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="tab-active" 
                    className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full"
                  />
                )}
                <div className="relative z-10 p-1">{tab.icon}</div>
                {sidebarOpen && (
                  <div className="flex flex-col items-start truncate relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                    <span className="text-[8px] font-medium opacity-50 truncate w-full">{tab.desc}</span>
                  </div>
                )}
              </button>
            ))}

            {activeTab === 'designer' && sidebarOpen && (
              <div className="space-y-8 pb-20">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 pt-8 border-t border-black/5 dark:border-white/5 space-y-4"
                >
                  <div className="px-3">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 mb-4 flex items-center gap-2">
                      <Box size={12} /> Visual Elements
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: LayoutModuleType.Heading, icon: HeadingIcon, label: 'Heading' },
                        { type: LayoutModuleType.Text, icon: Type, label: 'Text' },
                        { type: LayoutModuleType.Image, icon: ImageIcon, label: 'Media' },
                        { type: LayoutModuleType.Divider, icon: Minus, label: 'Divider' },
                        { type: LayoutModuleType.QuestionBox, icon: HelpCircle, label: 'Question' },
                        { type: LayoutModuleType.QuestionSwitcher, icon: PlayCircle, label: 'Q-Switcher' },
                        { type: LayoutModuleType.StatsBox, icon: BarChart2, label: 'Stats' },
                        { type: LayoutModuleType.SectionNav, icon: List, label: 'Nav' },
                        { type: LayoutModuleType.Timer, icon: ClockIcon, label: 'Timer' },
                        { type: LayoutModuleType.Alert, icon: AlertTriangle, label: 'Alert' },
                        { type: LayoutModuleType.Progress, icon: Activity, label: 'Steps' },
                      ].map((item) => (
                        <button 
                          key={item.type}
                          onClick={() => addModule(item.type)}
                          className="flex flex-col items-center justify-center p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 hover:border-blue-500/50 hover:bg-blue-600/5 transition-all group"
                        >
                          <item.icon size={16} className="text-slate-400 group-hover:text-blue-500 mb-2" />
                          <span className="text-[8px] font-bold text-slate-500 uppercase">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {selectedModuleId && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-3 space-y-6"
                  >
                    <div className="p-4 bg-blue-600/5 border border-blue-600/10 rounded-2xl">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Component Settings</span>
                        <button onClick={() => setSelectedModuleId(null)} className="text-blue-600/50 hover:text-blue-600"><X size={14}/></button>
                      </div>
                      
                      {(() => {
                        const sm = test.layout.find(m => m.id === selectedModuleId);
                        if (!sm) return null;
                        return (
                          <div className="space-y-4">
                            {(sm.type === LayoutModuleType.Heading || sm.type === LayoutModuleType.Text || sm.type === LayoutModuleType.Alert) && (
                              <textarea 
                                value={sm.content}
                                onChange={(e) => updateModule(sm.id, { content: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                                rows={4}
                              />
                            )}
                            {sm.type === LayoutModuleType.Image && (
                              <input 
                                value={sm.url}
                                onChange={(e) => updateModule(sm.id, { url: e.target.value })}
                                className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-3 text-[10px] font-mono"
                                placeholder="Image URL"
                              />
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Text Color</span>
                                <input type="color" value={sm.style?.textColor || '#000000'} onChange={(e) => updateModule(sm.id, { style: {...sm.style, textColor: e.target.value}})} className="w-full h-8 rounded-lg overflow-hidden border-none p-1 bg-white" />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Bg Color</span>
                                <input type="color" value={sm.style?.backgroundColor || 'transparent'} onChange={(e) => updateModule(sm.id, { style: {...sm.style, backgroundColor: e.target.value}})} className="w-full h-8 rounded-lg overflow-hidden border-none p-1 bg-white" />
                              </div>
                            </div>
                            <button 
                              onClick={() => removeModule(sm.id)}
                              className="w-full py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mt-2"
                            >
                              Delete Component
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}

                <div className="px-3">
                   <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 mb-4">Canvas Appearance</h3>
                   <div className="grid grid-cols-3 gap-2">
                      {['#f8fafc', '#ffffff', '#0f172a', '#eef2ff', '#f0f9ff', '#fff7ed'].map(color => (
                        <button 
                          key={color}
                          onClick={() => updateAppearance({ canvasBg: color })}
                          className={cn(
                            "h-8 rounded-lg border-2 transition-all",
                            test.appearance.canvasBg === color ? "border-blue-600 scale-105" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                   </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-black/5 dark:border-white/5">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#f1f5f9] dark:bg-[#020617]">
          {/* Viewport Container (only for Preview/Designer) */}
          <div className="flex-1 relative overflow-auto p-8 flex justify-center custom-scrollbar">
            <motion.div 
              key={viewport}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "bg-white dark:bg-slate-900 shadow-2xl rounded-2xl flex flex-col transition-all duration-700",
                viewport === 'desktop' ? "w-full max-w-6xl" : viewport === 'tablet' ? "w-[768px]" : "w-[375px]",
                (activeTab === 'designer' || activeTab === 'preview') ? "min-h-[1000px]" : "min-h-full h-auto"
              )}
            >
              {/* Internal Tab Content */}
              <div className={cn(
                "flex-1 p-8",
                activeTab === 'designer' && "p-0" // Designer manages its own padding
              )}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="min-h-full"
                  >
                    {activeTab === 'builder' && <BuilderTab test={test} setTest={setTest} onShowToast={onShowToast} />}
                    {activeTab === 'designer' && <DesignerTab test={test} setTest={setTest} selectedModuleId={selectedModuleId} setSelectedModuleId={setSelectedModuleId} />}
                    {activeTab === 'proctoring' && <ProctoringTab test={test} setTest={setTest} />}
                    {activeTab === 'settings' && <SettingsTab test={test} setTest={setTest} />}
                    {activeTab === 'preview' && <PreviewTab test={test} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
          
          {/* Quick Stats / Helper Bar */}
          <footer className="h-12 bg-white dark:bg-[#0a0a0a] border-t border-black/5 dark:border-white/5 px-6 flex items-center justify-between z-10">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                   <span className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">
                     {test.sections.reduce((acc, s) => acc + s.questions.length, 0)} Total Questions
                   </span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   <span className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest">
                     {test.sections.reduce((acc, s) => acc + s.questions.reduce((qAcc, q) => qAcc + q.marks, 0), 0)} Marks Total
                   </span>
                </div>
             </div>
             
             <div className="flex items-center gap-4">
                <span className="text-[9px] font-bold text-slate-300 dark:text-white/10 uppercase tracking-widest">Visual Architect 2.0</span>
                <div className="flex items-center gap-1">
                   <div className="w-1 h-1 rounded-full bg-blue-500" />
                   <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                   <div className="w-1 h-1 rounded-full bg-blue-500/20" />
                </div>
             </div>
          </footer>
        </main>
      </div>
    </motion.div>
  );
}
