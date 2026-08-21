import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { 
  X, Camera, UserCheck, Shield, Settings, 
  Users, Layout, Activity, Bell, Search, 
  Plus, BarChart3, Clock, Lock, Eye,
  FileText, Trash2, Edit3, ChevronRight, User,
  AlertCircle, CheckCircle2, MoreHorizontal,
  Mail, Calendar, ArrowRight, UserPlus,
  Monitor, BrainCircuit, Scan, ExternalLink,
  Zap, Share2, Cpu, LayoutDashboard,
  LayoutTemplate, ShieldCheck, PlayCircle, Library,
  AlertTriangle, BookOpen, TrendingUp, Database
} from 'lucide-react';
import { TestPaperEvaluator } from '../evaluation/TestPaperEvaluator';
import { LocalMLService } from '../../services/ml/LocalMLService';
import { CameraService } from '../../services/ml/CameraService';
import { AssignmentEvaluator } from '../evaluation/AssignmentEvaluator';
import { AnalyticsDashboard } from '../evaluation/AnalyticsDashboard';
import { AITestGeneratorModal } from './AITestGeneratorModal';


import { 
  AreaChart, Area, 
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useTheme } from '../../context/ThemeContext';

import { supabase, isSupabaseConfigured } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';
import { logClassroomCreated } from '../../database/analytics';
import { Test, Theme, LayoutModuleType } from '../../types';
import BuilderTab from '../tabs/BuilderTab';
import DesignerTab from '../tabs/DesignerTab';
import PreviewTab from '../tabs/PreviewTab';
import ProctoringTab from '../tabs/ProctoringTab';
import SettingsTab from '../tabs/SettingsTab';
import TestDesignerPortal from '../exams/TestDesignerPortal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ClassroomViewProps {
  user?: any;
  onClose?: () => void;
  onOpenAICore?: () => void;
}

type ActiveSection = 'dashboard' | 'classrooms' | 'attendance' | 'tests' | 'monitoring' | 'reports' | 'settings' | 'classroom-detail';

const ATTENDANCE_DATA = []; // Removed mock data

const parseFaceDescriptor = (value: unknown): Float32Array | null => {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return new Float32Array(parsed.map(Number));
    }
  } catch {
    // Invalid legacy biometrics are ignored instead of breaking the scan loop.
  }
  return null;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  }
};

export const ClassroomView: React.FC<ClassroomViewProps> = ({ user, onClose, onOpenAICore }) => {
  const currentUserId = user?.id || user?.uid;
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'info' | 'success' | 'warn' | 'error' } | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [showTestDesigner, setShowTestDesigner] = useState(false);
  const [showAiTestModal, setShowAiTestModal] = useState(false);
  const [currentTestToEdit, setCurrentTestToEdit] = useState<Test | undefined>(undefined);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const showToast = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'classrooms', label: 'Classrooms', icon: <Users size={20} /> },
    { id: 'attendance', label: 'Attendance', icon: <UserCheck size={20} /> },
    { id: 'monitoring', label: 'Live Monitoring', icon: <Monitor size={20} /> },
    { id: 'tests', label: 'Tests', icon: <FileText size={20} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const handleClassSelect = (id: string) => {
    setSelectedClassId(id);
    setActiveSection('classroom-detail');
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    setIsCreating(true);
    
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to environment variables.');
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const classroomData: any = {
        name: newClassName.trim(),
        code: code,
        students: 0,
        attendance: '0%',
        status: 'Active',
        user_id: currentUserId,
        created_at: new Date().toISOString()
      };

      const { data, error } = await (supabase.from('classrooms') as any).insert(classroomData).select();
      
      if (error) {
        if (error.message?.includes('relation "classrooms" does not exist')) {
          throw new Error('Database tables not initialized. Please run the schema.sql script in your Supabase SQL Editor.');
        }
        if (error.message?.includes('column') && error.message?.includes('not found')) {
           throw new Error('Database schema mismatch. Please update your classrooms table with a "code" column (text) or re-run the latest schema.sql.');
        }
        throw error;
      }

      setIsCreating(false);
      logClassroomCreated(newClassName);
      showToast(`Classroom "${newClassName}" created! Code: ${code}`, 'success');
      setCreateModalOpen(false);
      setNewClassName('');
      triggerRefresh();
    } catch (err: any) {
      console.error('[Classroom] Creation Failed:', err);
      setIsCreating(false);
      showToast(err.message || 'Failed to create classroom. Check console for details.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white/80 dark:bg-[#000000]/80 backdrop-blur-xl text-slate-900 dark:text-white flex flex-col font-sans overflow-hidden">
      {/* Background Glows (Futuristic Theme) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2" />
         <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/2" />
      </div>

    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "fixed top-24 right-10 z-[100] px-6 py-4 rounded-2xl border shadow-2xl backdrop-blur-3xl flex items-center gap-4",
            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 dark:text-emerald-400' :
            toast.type === 'warn' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400' :
            'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
          )}
        >
            <div className={cn(
              "w-2 h-2 rounded-full",
              toast.type === 'success' ? 'bg-emerald-500' :
              toast.type === 'warn' ? 'bg-rose-500' : 'bg-blue-500'
            )} />
            <span className="text-xs font-bold uppercase tracking-widest">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Classroom Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-[#0a0a0a] rounded-[32px] border border-black/10 dark:border-white/10 p-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-light tracking-tight text-slate-900 dark:text-white">New Classroom</h3>
                <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classroom Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Advanced AI Theory" 
                    className="w-full px-6 py-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <button 
                  onClick={handleCreateClass}
                  disabled={isCreating}
                  className="w-full py-5 rounded-3xl bg-blue-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Instance'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <header className="h-20 border-b border-black/5 dark:border-white/5 px-8 flex items-center justify-between bg-white/80 dark:bg-black/40 backdrop-blur-3xl z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4">
             <img src="/logo-light.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain block dark:hidden drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
             <img src="/logo-dark.png" alt="NeuroClass Logo" className="h-9 w-auto object-contain hidden dark:block drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
             <div>
               <h1 className="text-sm font-bold tracking-[0.2em] uppercase text-slate-900 dark:text-white">NeuroClass</h1>
               <div className="flex items-center gap-2">
                 <p className="text-[10px] text-slate-500 dark:text-white/30 uppercase tracking-widest font-mono">System Active</p>
                 <div className={cn(
                   "w-1.5 h-1.5 rounded-full animate-pulse",
                   isSupabaseConfigured() ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                 )} title={isSupabaseConfigured() ? "Supabase Connected" : "Connection Required"} />
               </div>
             </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/10 group focus-within:border-blue-500/50 transition-all">
            <Search size={16} className="text-slate-400 dark:text-white/20 group-focus-within:text-blue-500" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent border-none focus:ring-0 text-xs w-64 placeholder:text-slate-400 dark:placeholder:text-white/10 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              await supabase.auth.signOut();
              localStorage.removeItem('neuroclass_role');
              window.location.reload();
            }}
            className="px-5 py-2 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-500 dark:text-white/40 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-white/10"
          >
            Sign Out
          </button>
          <button 
            onClick={onOpenAICore}
            className="px-5 py-2 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-indigo-600/20 border border-indigo-500/20 flex items-center gap-2"
          >
            <BrainCircuit size={14} /> AI Core
          </button>
          <button 
            onClick={() => setShowAiTestModal(true)}
            className="px-5 py-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-widest transition-all border border-amber-500/30 flex items-center gap-2"
          >
            <Zap size={14} /> AI Test Generator (x402)
          </button>
          <button 
            onClick={() => setCreateModalOpen(true)}
            className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            Create Classroom
          </button>
          <div className="w-px h-8 bg-black/10 dark:bg-white/10" />
          <button className="p-2 text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
          </button>
          <div className="flex items-center gap-3">
             <img src="https://picsum.photos/seed/teacher/100/100" className="w-9 h-9 rounded-full grayscale border border-black/10 dark:border-white/10" alt="Avatar" referrerPolicy="no-referrer" />
             <button 
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside 
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
          className={cn(
            "relative z-40 border-r border-black/5 dark:border-white/5 bg-slate-50/80 dark:bg-black/80 backdrop-blur-3xl transition-all duration-500 flex flex-col group",
            isSidebarHovered ? "w-64" : "w-20"
          )}
        >
          <div className="flex-1 py-10 px-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id as ActiveSection);
                  if (item.id !== 'classroom-detail') setSelectedClassId(null);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden group/btn",
                  activeSection === item.id 
                    ? "text-blue-600 dark:text-white" 
                    : "text-slate-400 dark:text-white/30 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {activeSection === item.id && (
                  <motion.div 
                    layoutId="active-bg" 
                    className="absolute inset-0 bg-blue-600/10 dark:bg-gradient-to-r dark:from-blue-600/20 dark:to-purple-600/10 border border-blue-500/20"
                  />
                )}
                <div className="relative z-10 flex items-center gap-4">
                  <motion.div 
                    whileHover={{ rotate: 12, scale: 1.15 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className={cn(
                       "transition-all duration-500",
                       activeSection === item.id 
                        ? "text-blue-500" 
                        : "group-hover/btn:text-slate-900 dark:group-hover/btn:text-white"
                    )}
                  >
                    {item.icon}
                  </motion.div>
                  <AnimatePresence>
                    {isSidebarHovered && (
                      <motion.span 
                        initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950/10 relative p-10">
          <AnimatePresence mode="wait">
             <motion.div
              key={activeSection + (selectedClassId || '') + refreshKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto"
             >
                {activeSection === 'dashboard' && <DashboardView user={user} key={refreshKey} onManageClick={() => setActiveSection('classrooms')} />}
                {activeSection === 'classrooms' && <ClasslistView user={user} key={refreshKey} onClassSelect={handleClassSelect} />}
                {activeSection === 'classroom-detail' && (
                  <ClassroomDetailView 
                    key={`${selectedClassId}-${refreshKey}`}
                    user={user}
                    classId={selectedClassId!} 
                    onShowToast={showToast} 
                    onOpenDesigner={() => setShowTestDesigner(true)}
                    onEditTest={(test) => {
                      setCurrentTestToEdit(test);
                      setShowTestDesigner(true);
                    }}
                    refreshKey={refreshKey}
                  />
                )}
                {activeSection === 'attendance' && <GeneralSection title="Attendance Logs" icon={<UserCheck />} />}
                {activeSection === 'monitoring' && <GeneralSection title="Live Monitoring" icon={<Monitor />} />}
                {activeSection === 'tests' && <GlobalTestsView user={user} onEditTest={(test) => {
                  setCurrentTestToEdit(test);
                  setShowTestDesigner(true);
                }} />}
                {activeSection === 'reports' && <ReportsView user={user} />}
                {activeSection === 'settings' && <SettingsView onShowToast={showToast} />}
             </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Full Screen Test Designer Portal */}
      <AnimatePresence>
        {showTestDesigner && (
          <TestDesignerPortal
            initialTest={currentTestToEdit}
            onShowToast={showToast}
            onClose={() => {
              setShowTestDesigner(false);
              setCurrentTestToEdit(undefined);
            }}
            onSave={async (testData) => {
              if (!selectedClassId) {
                showToast('No classroom selected. Cannot save.', 'warn');
                return;
              }
              try {
                const testId = testData.id || uuidv4();
                
                if (!testData.settings?.title) {
                  showToast('Test title is required.', 'warn');
                  return;
                }

                const { error } = await (supabase.from('tests') as any).upsert({
                  id: testId,
                  classroom_id: selectedClassId,
                  user_id: currentUserId,
                  title: testData.settings.title,
                  test_data: { ...testData, id: testId, classroom_id: selectedClassId },
                  status: 'draft',
                  created_at: new Date().toISOString()
                }, { onConflict: 'id' });
                
                if (error) throw error;
                showToast('Draft progress saved to cloud.', 'info');
              } catch (err: any) {
                console.error('[DATABASE ERROR] Failed to save draft:', err);
                showToast(`Database Error: ${err.message || 'Check console for details'}`, 'error');
              }
            }}
            onPublish={async (testData) => {
              if (!selectedClassId) {
                showToast('No classroom selected. Cannot publish.', 'warn');
                return;
              }
              try {
                const testId = testData.id || uuidv4();

                if (!testData.settings?.title) {
                  showToast('Test title is required before publishing.', 'warn');
                  return;
                }

                const { error } = await (supabase.from('tests') as any).upsert({
                  id: testId,
                  classroom_id: selectedClassId,
                  user_id: currentUserId,
                  title: testData.settings.title,
                  test_data: { ...testData, id: testId, classroom_id: selectedClassId },
                  status: 'published',
                  created_at: new Date().toISOString()
                }, { onConflict: 'id' });
                
                if (error) throw error;
                showToast('Test published and assigned successfully!', 'success');
                setShowTestDesigner(false);
                setCurrentTestToEdit(undefined);
                triggerRefresh();
              } catch (err: any) {
                console.error('[DATABASE ERROR] Failed to publish test:', err);
                showToast(`Publish Failure: ${err.message || 'Check console for details'}`, 'error');
              }
            }}
          />
        )}
      </AnimatePresence>

      <AITestGeneratorModal
        isOpen={showAiTestModal}
        onClose={() => setShowAiTestModal(false)}
        onTestGenerated={(generatedTest) => {
          showToast(`AI Test Generated: "${generatedTest.title}" (${generatedTest.questions?.length || 0} questions)`, 'success');
        }}
      />
    </div>
  );
};

// --- SUB COMPONENTS ---

const GlassCard = ({ children, className, glow = false, onClick, ...props }: { children: React.ReactNode, className?: string, glow?: boolean, onClick?: () => void, [key: string]: any }) => (
  <motion.div 
    onClick={onClick} 
    animate={{ 
      y: [0, -4, 0],
    }}
    transition={{ 
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut"
    }}
    whileHover={{ 
      y: -8, 
      scale: 1.03,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    }}
    whileTap={{ scale: 0.97 }}
    {...props} 
    className={cn(
      "relative rounded-3xl border border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/60 backdrop-blur-3xl overflow-hidden group/card transition-all duration-700 hover:border-blue-500/30 dark:hover:border-blue-400/30 hover:bg-white/70 dark:hover:bg-black/70 shadow-sm hover:shadow-2xl dark:shadow-none",
      glow && "hover:shadow-[0_20px_80px_rgba(59,130,246,0.15)]",
      className
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-500/0 to-blue-500/0 group-hover/card:via-blue-500/5 group-hover/card:to-blue-500/10 transition-all duration-700 pointer-events-none" />
    {children}
  </motion.div>
);

const SectionHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <motion.header 
    initial="hidden"
    whileInView="visible"
    viewport={{ once: false, margin: "-50px" }}
    variants={{
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: { staggerChildren: 0.15 }
      }
    }}
    className="mb-12 text-left"
  >
    <div className="flex flex-wrap gap-x-4 mb-4 overflow-visible">
       {title.split(" ").map((word, i) => (
         <motion.h2 
           key={i}
           variants={{
             hidden: { opacity: 0, y: 80, filter: 'blur(20px)', scale: 0.3, rotateX: 90 },
             visible: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, rotateX: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
           }}
           className="text-[48px] font-light tracking-tighter leading-none text-slate-900 dark:text-white will-change-[transform,opacity,filter] transform-gpu"
         >
           {word}
         </motion.h2>
       ))}
    </div>
    <motion.p 
      variants={{
        hidden: { opacity: 0, x: -60, filter: 'blur(10px)' },
        visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 1.2, delay: 0.3 } }
      }}
      className="text-slate-500 dark:text-white/40 font-light tracking-wide max-w-xl will-change-[transform,opacity,filter] transform-gpu"
    >
      {subtitle}
    </motion.p>
  </motion.header>
);

// --- 1. DASHBOARD ---

const DashboardView: React.FC<{ user: any, onManageClick: () => void }> = ({ user, onManageClick }) => {
  const currentUserId = user?.id || user?.uid;
  const { theme } = useTheme();
  const [stats, setStats] = useState({ rooms: 0, students: 0, testCount: 0, attendance: '0%' });
  const [logs, setLogs] = useState<any[]>([]);
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        console.log('[Dashboard] Fetching data from Supabase...');
        
        let classQuery = supabase.from('classrooms' as any).select('*').eq('user_id', currentUserId);
        const { data: classrooms, error: classErr } = await classQuery;
        if (classErr) throw classErr;
        
        let studQuery = supabase.from('students' as any).select('*').eq('user_id', currentUserId);
        const { data: students, error: studErr } = await studQuery;
        if (studErr) throw studErr;

        let testQuery = supabase.from('tests' as any).select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(5);
        const { data: tests, error: testErr } = await testQuery;
        if (testErr) console.warn('Failed to fetch recent tests:', testErr);
        
        let attQuery = supabase.from('attendance' as any).select('*, students(*)').eq('user_id', currentUserId);
        const { data: attendance, error: attErr } = await attQuery;
        if (attErr) {
          console.warn('[Dashboard] Join failed, fetching attendance without students join...');
          let simpleAttQuery = supabase.from('attendance' as any).select('*').eq('user_id', currentUserId);
          const { data: simpleAtt, error: simpleErr } = await simpleAttQuery;
          if (simpleErr) throw simpleErr;
          
          // Map students manually
          const mappedAtt = (simpleAtt || []).map((a: any) => ({
            ...a,
            students: (students || []).find((s: any) => s.id === a.student_id)
          }));
          setLogs(mappedAtt.slice(0, 8));
          processAttendance(mappedAtt, students || []);
        } else {
          setLogs((attendance || []).slice(0, 8));
          processAttendance(attendance || [], students || []);
        }
        
        const safeClassrooms = classrooms || [];
        const totalRooms = safeClassrooms.length;
        const totalStudents = (students || []).length;
        const testCount = (tests || []).length;
        setStats(prev => ({ ...prev, rooms: totalRooms, students: totalStudents, testCount }));
        setRecentTests(tests || []);

      } catch (err: any) {
        console.error('[Dashboard] Fetch full error:', err);
        setError(err.message || 'Failed to connect to Supabase. Check your tables and RLS policies.');
      }
    };

    const processAttendance = (safeAttendance: any[], safeStudents: any[]) => {
      const totalStudents = safeStudents.length;
      const today = new Date().toISOString().split('T')[0];
      const todaysLogs = safeAttendance.filter((a: any) => a.created_at?.startsWith(today));
      
      const rate = totalStudents > 0 ? (todaysLogs.length / totalStudents) * 100 : 0;
      setStats(prev => ({ ...prev, attendance: `${rate.toFixed(1)}%` }));

      const hourCounts: Record<string, number> = {};
      safeAttendance.forEach((a: any) => {
        const createdAt = new Date(a.created_at);
        const hour = createdAt.getHours().toString().padStart(2, '0') + ':00';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const trend = Object.keys(hourCounts).sort().map(hour => ({
        time: hour,
        rate: (hourCounts[hour] / (totalStudents || 1)) * 100
      }));
      setAttendanceTrend(trend.length > 0 ? trend : [{ time: '08:00', rate: 0 }]);
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-12">
      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-4 text-left"
        >
          <AlertCircle className="shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest">Database Error</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        </motion.div>
      )}
      <div className="flex justify-between items-end">
         <SectionHeader 
          title="Dashboard"
          subtitle="Overview of all classroom activity and student performance."
         />
         <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onManageClick}
          className="mb-12 px-8 py-3 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-[10px] uppercase font-bold tracking-widest transition-all shadow-lg dark:shadow-none"
         >
           View Classrooms
         </motion.button>
      </div>

      <motion.div 
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
        }}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { label: 'Total Classrooms', value: stats.rooms.toString(), icon: <Layout />, desc: 'Active instances', color: 'blue' },
          { label: 'Total Students', value: stats.students.toString(), icon: <Users />, desc: 'Current enrollment', color: 'purple' },
          { label: 'Today\'s Attendance', value: stats.attendance, icon: <Activity />, desc: 'Real-time sync', color: 'emerald' },
          { label: 'Active Tests', value: stats.testCount.toString(), icon: <FileText />, desc: 'Live exams', color: 'pink' },
        ].map((stat, i) => (
          <motion.div 
            key={`stat-card-${i}`}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
            }}
          >
            <GlassCard className="p-8 group/card text-left" glow>
              <div className="flex justify-between items-start mb-10">
                 <div className={cn("p-3 rounded-2xl bg-black/5 dark:bg-white/5 transition-transform group-hover/card:scale-110", 
                   stat.color === 'blue' ? 'text-blue-600 dark:text-blue-400' : 
                   stat.color === 'purple' ? 'text-purple-600 dark:text-purple-400' : 
                   stat.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-pink-600 dark:text-pink-400'
                 )}>
                   {stat.icon}
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 dark:text-white/20 group-hover/card:text-slate-900 dark:group-hover/card:text-white/60 transition-colors">Live</span>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-[0.2em]">{stat.label}</p>
                <div className="flex items-baseline justify-between transition-transform duration-500 group-hover/card:translate-x-1">
                  <span className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white">{stat.value}</span>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{stat.desc}</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <GlassCard className="lg:col-span-2 p-10 flex flex-col space-y-10 text-left">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-white/40">Real-time Activity Trend</h4>
              <div className="flex gap-2">
                 <button className="text-[9px] font-bold uppercase tracking-widest text-blue-500 hover:opacity-100 opacity-60">AI Sync Live</button>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ 
                        backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)', 
                        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
                        borderRadius: '12px',
                        color: theme === 'dark' ? '#fff' : '#000'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#fff' : '#000', fontSize: '10px' }}
                  />
                  <XAxis dataKey="time" hide />
                  <Area 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRate)" 
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
         </GlassCard>

         <GlassCard className="p-8 flex flex-col space-y-6 text-left">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/40">System Log</h4>
                <Activity size={14} className="text-blue-500" />
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
                {logs.map((log, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex gap-4 items-center group/item transition-all hover:bg-black/10 dark:hover:bg-white/10">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-500 group-hover/item:scale-150 transition-transform" />
                        <div className="flex-1">
                           <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase truncate">{log.students?.name || 'Unknown'}</p>
                           <p className="text-[9px] text-slate-400 dark:text-white/20 uppercase tracking-widest">{log.status} • {new Date(log.created_at).toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))}
                {logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4 py-20 grayscale">
                     <Shield size={32} />
                     <p className="text-[10px] font-bold uppercase tracking-widest">No Activity</p>
                  </div>
                )}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 text-[10px] font-bold uppercase tracking-widest border border-black/10 dark:border-white/10 rounded-2xl hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all"
            >
                Refresh Logs
            </button>
         </GlassCard>
      </div>
    </div>
  );
};

// --- 2. CLASSROOM LIST ---

const ClasslistView: React.FC<{ user: any, onClassSelect: (id: string) => void }> = ({ user, onClassSelect }) => {
  const currentUserId = user?.id || user?.uid;
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setError(null);
        if (!isSupabaseConfigured()) {
           throw new Error('Supabase project configuration is required to view classrooms.');
        }
        let query = supabase.from('classrooms' as any).select('*').eq('user_id', currentUserId);
        const { data, error: dbErr } = await query;
        if (dbErr) throw dbErr;
        setClassrooms(data || []);
      } catch (err: any) {
        console.error('Failed to fetch classrooms:', err);
        let msg = err.message || 'Connection failed';
        if (msg.includes('relation "classrooms" does not exist')) {
          msg = 'Database tables not found. Please run schema.sql first.';
        } else if (msg.includes('column') && msg.includes('not found')) {
          msg = 'Database schema mismatch. Please re-run the latest schema.sql script in Supabase.';
        }
        setError(msg);
      }
      setLoading(false);
    };
    fetchClasses();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 text-left">
      <SectionHeader 
        title="Classrooms" 
        subtitle="Manage and monitor all your assigned student groups."
      />
      
      {error && (
        <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-4">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      <motion.div 
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {classrooms.map((room) => (
          <motion.div
            key={room.id}
            variants={{
              hidden: { opacity: 0, scale: 0.95, y: 20 },
              visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
            }}
          >
            <GlassCard 
              onClick={() => onClassSelect(room.id)}
              className="p-8 cursor-pointer ring-0 hover:ring-2 hover:ring-blue-500/50 transition-all"
              glow
            >
              <div className="space-y-8">
                <div className="flex justify-between items-start">
                   <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center group-hover/card:bg-blue-600/10 dark:group-hover/card:bg-blue-500/20 group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors">
                      <Users size={24} />
                   </div>
                   <span className={cn("text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full border", 
                     room.status === 'Active' ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'text-slate-300 dark:text-white/20 border-black/5 dark:border-white/10'
                   )}>
                     {room.status}
                   </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">{room.name}</h3>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-white/30">
                      <Users size={12} />
                      <span className="text-[10px] uppercase font-bold tracking-widest">{room.students} Students</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Activity size={12} />
                      <span className="text-[10px] uppercase font-bold tracking-widest">{room.attendance} Attendance</span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-black/5 dark:border-white/5 flex justify-between items-center group-hover/card:border-blue-500/30 transition-colors">
                   <div className="flex flex-col">
                     <p className="text-[9px] font-mono tracking-widest uppercase text-slate-400 dark:text-white/40">Reference: {(room._id || room.id).toString().substring(0, 8)}</p>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 shadow-sm shadow-blue-500/10">CODE: {room.code || '------'}</span>
                     </div>
                   </div>
                   <div className="w-10 h-10 rounded-full border border-black/5 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover/card:bg-blue-600 group-hover/card:text-white transition-all group-hover/card:translate-x-1">
                      <ArrowRight size={18} />
                   </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

// --- 3. CLASSROOM DETAIL ---

const ClassroomDetailView: React.FC<{ 
  user: any,
  classId: string, 
  onShowToast: any,
  onOpenDesigner: () => void,
  onEditTest: (test: Test) => void,
  refreshKey?: number
}> = ({ user, classId, onShowToast, onOpenDesigner, onEditTest, refreshKey }) => {
  const currentUserId = user?.id || user?.uid;
  const [activeTab, setActiveTab] = useState<'attendance' | 'group' | 'monitoring' | 'test' | 'students' | 'tests_list' | 'ocr' | 'rubric' | 'analytics' | 'rag' | 'admin'>('attendance');
  const [classroom, setClassroom] = useState<any>(null);
  const [isAddStudentOpen, setAddStudentOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', faceData: '' });
  const [isCapturing, setIsCapturing] = useState(false);
  const enrollVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchClass = async () => {
      try {
        const { data, error } = await (supabase.from('classrooms') as any).select('*').eq('id', classId).single();
        if (error) throw error;
        setClassroom(data);
      } catch (err: any) {
        console.error('Failed to fetch class:', err);
        onShowToast('Failed to load classroom details. Schema may be out of sync.', 'error');
      }
    };
    fetchClass();
  }, [classId]);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (e) {
      onShowToast('Camera access denied for enrollment.', 'warn');
    }
  };

  const takePhoto = () => {
    if (enrollVideoRef.current && canvasRef.current) {
      const video = enrollVideoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setNewStudent(prev => ({ ...prev, faceData: dataUrl }));
        stopCapture();
      }
    }
  };

  const stopCapture = () => {
    if (enrollVideoRef.current?.srcObject) {
      const tracks = (enrollVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(t => t.stop());
    }
    setIsCapturing(false);
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.email) return;
    
    const studentData: any = {
      name: newStudent.name,
      email: newStudent.email,
      classroom_id: classId,
      user_id: currentUserId,
      avatar: newStudent.faceData || null,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await (supabase.from('students') as any).insert(studentData);
      
      if (error) throw error;

      onShowToast('Student enrolled successfully', 'success');
      setAddStudentOpen(false);
      setNewStudent({ name: '', email: '', faceData: '' });
      
      if (classroom) {
        await (supabase.from('classrooms') as any)
          .update({ students: (classroom.students || 0) + 1 })
          .eq('id', classId);
      }
    } catch (error: any) {
      console.error('Error adding student:', error);
      onShowToast('Error adding student', 'warn');
    }
  };

  const tabs = [
    { id: 'attendance', label: 'Face Attendance', icon: <Scan size={18} /> },
    { id: 'students', label: 'Students', icon: <Users size={18} /> },
    { id: 'monitoring', label: 'Test Monitoring', icon: <Eye size={18} /> },
    { id: 'tests_list', label: 'Manage Tests', icon: <Library size={18} /> },
    { id: 'test', label: 'Create Test', icon: <FileText size={18} /> },
    { id: 'ocr', label: 'OCR Grader', icon: <BrainCircuit size={18} /> },
    { id: 'rubric', label: 'Rubric AI', icon: <BookOpen size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <TrendingUp size={18} /> },
  ];

  return (
    <div className="space-y-12 h-full flex flex-col text-left">
       <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
         <div className="space-y-2">
            <button 
              onClick={() => window.location.reload()}
              className="text-[10px] text-slate-400 dark:text-white/40 font-bold uppercase tracking-widest hover:text-slate-900 dark:hover:text-white"
            >
              ← Back to Classrooms
            </button>
            <h1 className="text-[48px] font-light tracking-tighter leading-none text-slate-900 dark:text-white">Classroom</h1>
            <p className="text-slate-500 dark:text-white/40 font-light truncate">Class: {classroom?.name || 'Loading...'}</p>
         </div>
         
         <div className="flex flex-wrap gap-4 mb-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'test') {
                    onOpenDesigner();
                    return;
                  }
                  setActiveTab(tab.id as any);
                }}
                className={cn(
                  "px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 transition-all",
                  activeTab === tab.id ? "bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg dark:shadow-none" : "bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-400 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
            <button 
              onClick={() => setAddStudentOpen(true)}
              className="px-6 py-3 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
            >
               <UserPlus size={18} /> Add Student
            </button>
         </div>
       </header>

       <AnimatePresence>
        {isAddStudentOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-[#0a0a0a] rounded-[32px] border border-black/10 dark:border-white/10 p-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-light tracking-tight text-slate-900 dark:text-white">Add Student</h3>
                <button onClick={() => setAddStudentOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                  <input 
                    type="text" 
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    placeholder="Enter student name" 
                    className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</label>
                  <input 
                    type="email" 
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                    placeholder="student@example.com" 
                    className="w-full px-6 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Biometric Face Enrollment</label>
                  {!isCapturing && !newStudent.faceData && (
                    <button 
                      onClick={startCapture}
                      className="w-full py-4 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl flex flex-col items-center gap-2 text-slate-400 dark:text-white/20 hover:text-blue-500 hover:border-blue-500/50 transition-all"
                    >
                      <Camera size={24} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Open Camera to Enroll</span>
                    </button>
                  )}
                  {isCapturing && (
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black ring-2 ring-blue-500">
                      <video ref={enrollVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <button 
                        onClick={takePhoto}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-blue-600 text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-xl"
                      >
                        Capture Biometrics
                      </button>
                    </div>
                  )}
                  {newStudent.faceData && !isCapturing && (
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black ring-2 ring-emerald-500">
                      <img src={newStudent.faceData} className="w-full h-full object-cover" alt="Captured" referrerPolicy="no-referrer" />
                      <div className="absolute top-4 right-4 bg-emerald-500 text-black px-2 py-1 rounded text-[8px] font-bold uppercase">Ready</div>
                      <button 
                        onClick={() => { setNewStudent(prev => ({...prev, faceData: ''})); setIsCapturing(false); }}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-rose-600 text-white rounded-full text-[9px] font-bold uppercase tracking-widest shadow-xl"
                      >
                        Recapture
                      </button>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <button 
                  onClick={handleAddStudent}
                  className="w-full py-5 rounded-3xl bg-blue-600 text-white font-bold uppercase tracking-widest text-[11px] hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                >
                  Confirm Enrollment
                </button>
              </div>
            </motion.div>
          </div>
        )}
       </AnimatePresence>

       <div className="flex-1">
          {activeTab === 'attendance' && <FaceIdModule user={user} classId={classId} onShowToast={onShowToast} />}
          {activeTab === 'students' && <StudentsListView classId={classId} onShowToast={onShowToast} />}
          {activeTab === 'monitoring' && <ProctoringModule classId={classId} onShowToast={onShowToast} />}
          {activeTab === 'tests_list' && <TestsListView 
            user={user}
            classId={classId} 
            onShowToast={onShowToast} 
            onEditTest={onEditTest} 
            refreshKey={refreshKey}
          />}
          {activeTab === 'ocr' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-black/5 dark:border-white/5 pb-4">
                 <h3 className="text-xl font-bold">OCR Answer Sheet Evaluator</h3>
                 <p className="text-xs text-slate-400">Scan, parse, and verify handwritten paper answers with AI guidance.</p>
              </div>
              <TestPaperEvaluator />
            </div>
          )}
          {activeTab === 'rubric' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-black/5 dark:border-white/5 pb-4">
                 <h3 className="text-xl font-bold">Rubric Assessment Hub</h3>
                 <p className="text-xs text-slate-400">Run structured guidelines assessments on criteria depth and mechanics.</p>
              </div>
              <AssignmentEvaluator />
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-black/5 dark:border-white/5 pb-4">
                 <h3 className="text-xl font-bold">Insights & Performance Analytics</h3>
                 <p className="text-xs text-slate-400">Interactive trends, scores distribution, and feedback tracking.</p>
              </div>
              <AnalyticsDashboard />
            </div>
          )}

          {activeTab === 'test' && (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center animate-in fade-in zoom-in duration-500">
               <div className="w-24 h-24 rounded-[40px] bg-blue-600/10 text-blue-600 flex items-center justify-center mb-10 shadow-inner">
                  <FileText size={40} />
               </div>
               <h2 className="text-3xl font-light text-slate-900 dark:text-white mb-4">Designer Ready</h2>
               <p className="text-slate-500 dark:text-white/30 max-w-md mx-auto mb-12 text-sm leading-relaxed font-light">
                 Launch the full-screen immersive architect to design, proctor, and configure your examination with precision.
               </p>
               <button 
                 onClick={() => onOpenDesigner()}
                 className="px-12 py-5 rounded-3xl bg-blue-600 text-white font-bold uppercase tracking-[0.2em] transform transition-all hover:bg-blue-500 hover:shadow-[0_0_40px_rgba(37,99,235,0.3)] active:scale-95"
               >
                 Launch Test Architect
               </button>
            </div>
          )}
       </div>
    </div>
  );
};

const GlobalTestsView: React.FC<{ user: any, onEditTest: (test: Test) => void }> = ({ user, onEditTest }) => {
  const currentUserId = user?.id || user?.uid;
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllTests = async () => {
      try {
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase configuration missing.');
        }
        let query = (supabase.from('tests') as any).select('*, classrooms(name)').eq('user_id', currentUserId);
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        setTests(data || []);
      } catch (err: any) {
        console.error('Failed to fetch all tests:', err);
        setError(err.message || 'Data retrieval failed');
      }
      setLoading(false);
    };
    fetchAllTests();
  }, []);

  if (loading) return <div className="py-20 text-center opacity-40 uppercase text-[10px] tracking-widest">Gathering all examinations...</div>;

  if (error) {
    return (
      <div className="py-20 text-center">
        <AlertTriangle className="mx-auto text-amber-500 mb-4" size={32} />
        <h3 className="text-xl font-bold mb-2">Sync Interrupted</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full font-bold uppercase text-[10px] tracking-widest"
        >
          Check Settings
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-[32px] font-light tracking-tighter leading-none text-slate-900 dark:text-white">Central Repository</h2>
           <p className="text-slate-500 dark:text-white/40 font-light mt-2 uppercase text-[10px] tracking-widest">All active and draft assessments across all domains.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.map(test => (
          <GlassCard key={test.id} className="p-8 flex flex-col space-y-6" glow>
            <div className="flex justify-between items-start">
               <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center overflow-hidden">
                   {test.test_data?.settings?.logoUrl ? (
                      <img src={test.test_data.settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <>
                        <img src="/logo-light.png" alt="Logo" className="w-full h-full object-contain block dark:hidden p-0.5" />
                        <img src="/logo-dark.png" alt="Logo" className="w-full h-full object-contain hidden dark:block p-0.5" />
                      </>
                    )}
                </div>
               <div className="flex gap-2">
                  <button 
                    onClick={() => onEditTest({ ...(test.test_data || {}), id: test.id, classroom_id: test.classroom_id })}
                    className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                  <span className={cn(
                    "text-[8px] font-black tracking-[0.2em] uppercase px-2 py-1 rounded-md",
                    test.status === 'published' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 text-slate-400'
                  )}>
                    {test.status}
                  </span>
               </div>
            </div>
            <div>
               <div className="text-[8px] font-black uppercase tracking-widest text-indigo-600 mb-1">{test.classrooms?.name || 'Unassigned'}</div>
               <h4 className="text-xl font-bold tracking-tight mb-2">{test.title}</h4>
               <div className="flex flex-col gap-2 opacity-50">
                  <div className="flex items-center gap-2">
                     <Clock size={12} />
                     <span className="text-[10px] font-bold uppercase tracking-widest">{test.test_data?.settings?.duration || 0} MINUTES</span>
                  </div>
               </div>
            </div>
          </GlassCard>
        ))}
        {tests.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center gap-4">
             <Library size={48} />
             <p className="uppercase text-[10px] tracking-widest font-bold">No global tests found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TestsListView: React.FC<{ user: any, classId: string, onShowToast: any, onEditTest: (test: Test) => void, refreshKey?: number }> = ({ user, classId, onShowToast, onEditTest, refreshKey }) => {
  const currentUserId = user?.id || user?.uid;
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        let query = (supabase.from('tests') as any).select('*').eq('classroom_id', classId);
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        setTests(data || []);
      } catch (error) {
        console.error('Failed to fetch tests:', error);
      }
      setLoading(false);
    };
    fetchTests();
  }, [classId, refreshKey]);

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test? All attempts will also be deleted.')) return;
    try {
      const { error } = await (supabase.from('tests') as any).delete().eq('id', testId);
      if (error) throw error;
      setTests(prev => prev.filter(t => t.id !== testId));
      onShowToast('Test deleted successfully', 'success');
    } catch (error) {
      onShowToast('Failed to delete test', 'warn');
    }
  };

  if (loading) return <div className="py-20 text-center opacity-40 uppercase text-[10px] tracking-widest">Loading tests...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       {tests.map(test => (
         <GlassCard key={test.id} className="p-8 flex flex-col space-y-6" glow>
            <div className="flex justify-between items-start">
               <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center overflow-hidden">
                   {test.test_data?.settings?.logoUrl ? (
                      <img src={test.test_data.settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <>
                        <img src="/logo-light.png" alt="Logo" className="w-full h-full object-contain block dark:hidden p-0.5" />
                        <img src="/logo-dark.png" alt="Logo" className="w-full h-full object-contain hidden dark:block p-0.5" />
                      </>
                    )}
                </div>
               <div className="flex gap-2">
                  <button 
                    onClick={() => onEditTest({ ...(test.test_data || {}), id: test.id, classroom_id: test.classroom_id })}
                    className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                 <span className={cn(
                   "text-[8px] font-black tracking-[0.2em] uppercase px-2 py-1 rounded-md",
                   test.status === 'published' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 text-slate-400'
                 )}>
                   {test.status}
                 </span>
                 <button 
                  onClick={() => handleDeleteTest(test.id)}
                  className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all"
                 >
                   <Trash2 size={14} />
                 </button>
               </div>
            </div>
            <div>
               <h4 className="text-xl font-bold tracking-tight mb-2">{test.title}</h4>
               <div className="flex flex-col gap-2 opacity-50">
                  <div className="flex items-center gap-2">
                     <Clock size={12} />
                     <span className="text-[10px] font-bold uppercase tracking-widest">{test.test_data.settings.duration} MINUTES</span>
                  </div>
                  <div className="text-[9px] font-medium">
                     {test.start_time && <div>Starts: {new Date(test.start_time).toLocaleString()}</div>}
                     {test.end_time && <div>Ends: {new Date(test.end_time).toLocaleString()}</div>}
                  </div>
               </div>
            </div>
         </GlassCard>
       ))}
       {tests.length === 0 && (
         <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center gap-4">
            <FileText size={48} />
            <p className="uppercase text-[10px] tracking-widest font-bold">No tests found for this classroom</p>
         </div>
       )}
    </div>
  );
};

const StudentsListView: React.FC<{ classId: string, onShowToast: any }> = ({ classId, onShowToast }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await (supabase.from('students') as any).select('*').eq('classroom_id', classId);
        if (error) throw error;
        setStudents(data || []);
      } catch (error) {
        console.error('Failed to fetch students:', error);
      }
      setLoading(false);
    };
    fetchStudents();
  }, [classId]);

  if (loading) return <div className="py-20 text-center opacity-40 uppercase text-[10px] tracking-widest">Loading students...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       {students.map(student => (
         <GlassCard key={student.id} className="p-6 flex items-center justify-between" glow>
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                 {student.avatar ? (
                   <img src={student.avatar} className="w-full h-full object-cover" alt={student.name} referrerPolicy="no-referrer" />
                 ) : (
                   student.name.charAt(0)
                 )}
               </div>
               <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] text-slate-400 dark:text-white/20">{student.email}</p>
                    {student.roll_number && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[9px] font-mono font-bold text-blue-500 uppercase">#{student.roll_number}</span>
                    )}
                  </div>
               </div>
            </div>
            <button 
              onClick={async () => {
                try {
                  const { error } = await (supabase.from('students') as any).delete().eq('id', student.id);
                  if (error) throw error;
                  setStudents(prev => prev.filter(s => s.id !== student.id));
                  onShowToast('Student removed', 'info');
                } catch (error) {
                  onShowToast('Failed to remove student', 'warn');
                }
              }}
              className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-xl transition-all"
            >
               <Trash2 size={16} />
            </button>
         </GlassCard>
       ))}
       {students.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center gap-4">
             <Users size={48} />
             <p className="uppercase text-[10px] tracking-widest font-bold">No students enrolled</p>
          </div>
       )}
    </div>
  );
};

const FaceIdModule: React.FC<{ user: any, classId: string, onShowToast: any }> = ({ user, classId, onShowToast }) => {
  const currentUserId = user?.id || user?.uid;
  const [isScanning, setScanning] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [identified, setIdentified] = useState<any[]>([]);
  const [pendingMatch, setPendingMatch] = useState<any | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionBox, setDetectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const scanActiveRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const seenStudentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await (supabase.from('students') as any).select('*').eq('classroom_id', classId);
        if (error) throw error;
        setStudents(data || []);
      } catch (e) {
        console.error('Failed to fetch students for scanning:', e);
      }
    };
    fetchStudents();
  }, [classId]);

  const logAttendance = async (studentId: string, studentName: string): Promise<boolean> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error('Your teacher session has expired.');

      const { data: openSession, error: sessionError } = await (supabase.from('attendance_sessions') as any)
        .select('id')
        .eq('classroom_id', classId)
        .eq('teacher_id', currentUserId)
        .eq('status', 'open')
        .gt('ends_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!openSession?.id) {
        onShowToast('Open a teacher attendance session before scanning students.', 'warn');
        return false;
      }

      const response = await fetch(getApiUrl('/api/attendance/teacher-mark'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          classroomId: classId,
          sessionId: openSession.id,
          studentId,
          studentName,
          mode: 'face-scan'
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && String(payload.error || '').includes('already marked')) return true;
        throw new Error(payload.error || 'Attendance could not be saved.');
      }
      return true;
    } catch (err: any) {
      console.error('Failed to log attendance:', err);
      onShowToast(err?.message || 'Attendance could not be saved. Check the database connection.', 'error');
      return false;
    }
  };

  const confirmMatch = async () => {
    if (pendingMatch) {
      const saved = await logAttendance(pendingMatch.id, pendingMatch.name);
      if (!saved) return;
      seenStudentIdsRef.current.add(pendingMatch.id);
      setIdentified(prev => [pendingMatch, ...prev]);
      onShowToast(`Verified match: ${pendingMatch.name}`, 'success');
      setPendingMatch(null);
      setDetectionBox(null);
    }
  };

  const rejectMatch = () => {
    onShowToast('Identification rejected.', 'info');
    setPendingMatch(null);
    setDetectionBox(null);
  };

  const toggleScan = async () => {
    if (isScanning) {
      if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
      scanActiveRef.current = false;
      isRecognizingRef.current = false;
      CameraService.stopCamera((videoRef.current?.srcObject as MediaStream | null) || null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setScanning(false);
      setPendingMatch(null);
      setDetectionBox(null);
      setCameraError(null);
      return;
    }

    try {
      if (!students.length) {
        onShowToast('Enroll students before starting attendance.', 'warn');
        return;
      }
      setCameraError(null);
      onShowToast('Loading on-device face recognition models...', 'info');
      await LocalMLService.loadModels();
      const stream = await CameraService.startCamera();
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      scanActiveRef.current = true;
      setScanning(true);
      seenStudentIdsRef.current = new Set();
      onShowToast('Face attendance is active. Look at the camera.', 'success');

      const runRecognition = async () => {
        if (!videoRef.current?.srcObject || !scanActiveRef.current || isRecognizingRef.current) return;
        isRecognizingRef.current = true;
        try {
          const enrolled = students
            .map(student => ({
              id: student.id,
              name: student.name,
              descriptor: parseFaceDescriptor(student.face_descriptor)
            }))
            .filter((student): student is { id: string; name: string; descriptor: Float32Array } => Boolean(student.descriptor));

          if (!enrolled.length) {
            onShowToast('No enrolled face descriptors found. Ask students to re-enroll biometrics.', 'warn');
            return;
          }

          const match = await LocalMLService.matchFace(videoRef.current, enrolled);
          if (!match?.studentId || !match.name) {
            setDetectionBox(null);
            return;
          }

          const box = match.box;
          if (box && videoRef.current.videoWidth && videoRef.current.videoHeight) {
            setDetectionBox({
              x: (box.x / videoRef.current.videoWidth) * 100,
              y: (box.y / videoRef.current.videoHeight) * 100,
              w: (box.width / videoRef.current.videoWidth) * 100,
              h: (box.height / videoRef.current.videoHeight) * 100
            });
          }

          if (seenStudentIdsRef.current.has(match.studentId) || pendingMatch) return;
          const student = students.find(candidate => candidate.id === match.studentId);
          const matchData = {
            ...student,
            id: match.studentId,
            name: match.name,
            confidence: match.confidence,
            time: new Date().toLocaleTimeString(),
            uniqueId: uuidv4()
          };

          if (match.confidence >= 80) {
            const saved = await logAttendance(match.studentId, match.name);
            if (saved) {
              seenStudentIdsRef.current.add(match.studentId);
              setIdentified(prev => [matchData, ...prev]);
              onShowToast(`Student recognized: ${match.name} (${match.confidence}%)`, 'success');
            }
          } else {
            setPendingMatch(matchData);
            onShowToast('Potential match detected. Manual confirmation required.', 'warn');
          }
        } catch (error) {
          console.error('[Attendance] Recognition error:', error);
          onShowToast('Face recognition temporarily unavailable.', 'warn');
        } finally {
          isRecognizingRef.current = false;
          if (videoRef.current?.srcObject && scanActiveRef.current) {
            scanTimeoutRef.current = window.setTimeout(runRecognition, 1800);
          }
        }
      };

      scanTimeoutRef.current = window.setTimeout(runRecognition, 800);
    } catch (e: any) {
      CameraService.stopCamera((videoRef.current?.srcObject as MediaStream | null) || null);
      setCameraError(e.message || 'Camera access denied.');
      onShowToast(e.message || 'Camera access denied.', 'warn');
    }
  };

  useEffect(() => {
    return () => {
      scanActiveRef.current = false;
      if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
      CameraService.stopCamera((videoRef.current?.srcObject as MediaStream | null) || null);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
       <div className="md:col-span-8 flex flex-col gap-6">
          <GlassCard className="relative aspect-video flex-1 overflow-hidden" glow>
             {cameraError ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-rose-500 p-10 text-center">
                  <AlertCircle size={64} className="animate-pulse" />
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-widest">Camera Permission Error</p>
                    <p className="text-[10px] opacity-60 max-w-xs">{cameraError}</p>
                  </div>
                  <button onClick={toggleScan} className="px-6 py-2 rounded-full border border-rose-500/30 text-[9px] uppercase font-bold tracking-widest hover:bg-rose-500/10 active:scale-95 transition-all">Retry Access</button>
               </div>
             ) : !isScanning ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 opacity-20">
                  <Camera size={64} />
                  <p className="text-[12px] font-bold uppercase tracking-[0.4em]">Camera Standby</p>
               </div>
             ) : (
               <>
                 <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale opacity-60" />
                 <div className="absolute inset-0 flex items-center justify-center p-20 pointer-events-none">
                    <div className="w-full h-full border border-blue-500/20 relative overflow-hidden">
                       <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }} 
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute left-0 right-0 h-1 bg-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,1)]" 
                       />
                       <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/50" />
                       <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/50" />
                       <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/50" />
                       <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/50" />
                    </div>
                 </div>
                 {detectionBox && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     style={{ 
                        top: `${detectionBox.y}%`, 
                        left: `${detectionBox.x}%`, 
                        width: `${detectionBox.w}%`, 
                        height: `${detectionBox.h}%` 
                     }}
                     className="absolute border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10"
                   >
                     <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[8px] font-bold px-2 py-0.5 uppercase">
                        Analyzing Face...
                     </div>
                   </motion.div>
                 )}

                 {pendingMatch && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center p-8">
                       <GlassCard className="p-8 w-full max-w-sm text-center space-y-6" glow>
                          <div className="mx-auto w-24 h-24 rounded-full border-4 border-amber-500/50 p-1">
                             <img src={pendingMatch.avatar || "https://picsum.photos/seed/user/200/200"} className="w-full h-full object-cover rounded-full" alt="Potential Match" referrerPolicy="no-referrer" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Potential Match</p>
                             <h3 className="text-xl font-light text-white">{pendingMatch.name}</h3>
                             <p className="text-[10px] text-white/40 uppercase tracking-widest leading-loose">Confidence: {pendingMatch.confidence}% <br/> Manual verification required</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <button onClick={rejectMatch} className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Reject</button>
                             <button onClick={confirmMatch} className="py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">Confirm</button>
                          </div>
                       </GlassCard>
                    </div>
                 )}

                 {identified.length > 0 && !pendingMatch && !detectionBox && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-emerald-500/50 bg-emerald-500/5 backdrop-blur-sm flex flex-col items-center justify-end p-6"
                   >
                      <div className="bg-emerald-500 text-black px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest mb-2 whitespace-nowrap">{identified[0].confidence}% MATCH</div>
                      <p className="text-sm font-bold text-white uppercase tracking-widest">{identified[0].name}</p>
                   </motion.div>
                 )}
               </>
             )}
          </GlassCard>
          <div className="space-y-4">
             <p className="text-[12px] text-slate-500 dark:text-white/40 italic">Use camera to mark attendance for arriving students.</p>
             <button 
                onClick={toggleScan}
                className={cn(
                "w-full py-6 rounded-3xl font-bold uppercase tracking-widest text-[11px] transition-all",
                isScanning ? "bg-rose-500/10 border border-rose-500/30 text-rose-500" : "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/10"
                )}
             >
                {isScanning ? 'Stop Attendance' : 'Start Attendance'}
             </button>
          </div>
       </div>

       <div className="md:col-span-4 flex flex-col gap-6">
          <GlassCard className="p-8 flex-1 flex flex-col space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Verified List</h4>
            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
               <motion.div 
                 variants={containerVariants}
                 initial="hidden"
                 animate="visible"
                 className="space-y-4"
               >
                 <AnimatePresence mode="popLayout">
                   {identified.map((id, index) => (
                     <motion.div 
                      key={id.uniqueId || `${id.id}-${index}`}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, scale: 0.8, x: -20 }}
                      className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between"
                     >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                            {id.avatar ? (
                              <img src={id.avatar} className="w-full h-full object-cover" alt={id.name} referrerPolicy="no-referrer" />
                            ) : (
                              id.name.charAt(0)
                            )}
                          </div>
                          <div>
                             <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">{id.name}</p>
                             <p className="text-[10px] text-slate-400 dark:text-white/20 uppercase tracking-widest">Conf: {id.confidence}% • {id.time}</p>
                          </div>
                        </div>
                        <CheckCircle2 size={20} className="text-emerald-500" />
                     </motion.div>
                   ))}
                 </AnimatePresence>
                 {identified.length === 0 && (
                   <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center opacity-10 py-20 text-center gap-4"
                   >
                     <UserSearchIcon size={48} />
                     <p className="text-[10px] uppercase font-bold tracking-widest">Waiting for students...</p>
                   </motion.div>
                 )}
               </motion.div>
            </div>
            <div className="pt-6 border-t border-black/5 dark:border-white/5">
                <p className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[0.2em] mb-4 text-center">Attendance marked. Please confirm.</p>
                <button 
                    onClick={() => onShowToast('Attendance saved.', 'success')}
                    className="w-full py-4 text-[10px] font-bold uppercase tracking-[0.2em] border border-black/10 dark:border-white/10 rounded-2xl hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all"
                >
                    Confirm Session
                </button>
            </div>
          </GlassCard>
       </div>
    </div>
  );
};

const UserSearchIcon = ({ size }: { size: number }) => <span style={{ width: size, height: size }} className="flex items-center justify-center"><Users size={size} /></span>;

// GroupScanModule removed as it relied on mock data

const ProctoringModule: React.FC<{ classId: string, onShowToast: any }> = ({ classId, onShowToast }) => {
  const [active, setActive] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await (supabase.from('students') as any).select('*').eq('classroom_id', classId);
        if (error) throw error;
        setStudents(data || []);
      } catch (e) {
        console.error('Failed to fetch students for proctoring:', e);
      }
    };
    fetchStudents();
  }, [classId]);

  const toggle = () => {
    setActive(!active);
    onShowToast(!active ? 'Monitoring started' : 'Monitoring stopped', !active ? 'success' : 'warn');
  };

  useEffect(() => {
    if (!active) return;

    const channel = supabase
      .channel('proctoring-alerts')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'attempts' 
      }, (payload: any) => {
        const newAttempt = payload.new;
        const oldAttempt = payload.old;

        // Check if violations were added
        if (newAttempt.violations && 
            (!oldAttempt.violations || newAttempt.violations.length > oldAttempt.violations.length)) {
            
            const latestViolation = newAttempt.violations[newAttempt.violations.length - 1];
            const student = students.find(s => s.id === newAttempt.student_id);
            
            if (student) {
                setAlerts(prev => [{
                    id: `${newAttempt.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    student: student.name,
                    type: latestViolation.type,
                    time: latestViolation.time
                }, ...prev].slice(0, 10));
            }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [active, students]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 text-left">
       <div className="lg:col-span-12 flex justify-between items-center mb-4">
          <div className="flex items-center gap-6">
              <div>
                <h3 className="text-2xl font-light text-slate-900 dark:text-white mb-1">Test Monitoring</h3>
                <p className="text-[10px] text-slate-500 dark:text-white/30 uppercase font-bold tracking-[0.3em]">Monitor students during tests using camera</p>
              </div>
              {active && <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />}
          </div>
          <button 
           onClick={toggle}
           className={cn(
             "px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all",
             active ? "bg-rose-500/10 border border-rose-500/20 text-rose-500" : "bg-slate-900 dark:bg-white text-white dark:text-black"
           )}
          >
            {active ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
       </div>

       <GlassCard className="lg:col-span-9 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950 shadow-inner min-h-[500px]">
          {students.map((student, i) => (
             <div key={student.id} className="relative aspect-video bg-white dark:bg-black/40 rounded-xl overflow-hidden border border-black/5 dark:border-white/5 border-dashed flex flex-col justify-end group">
                {student.avatar ? (
                  <img src={student.avatar} className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt="student" referrerPolicy="no-referrer" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-10">
                    <User size={48} />
                  </div>
                )}
                <div className="relative p-3 bg-white/90 dark:bg-black/80 backdrop-blur-md flex items-center justify-between">
                   <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/50 truncate max-w-[80%]">{student.name}</span>
                   <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10")} />
                </div>
                {active && alerts.some(a => a.student === student.name) && (
                    <div className="absolute inset-0 bg-rose-600/20 border-2 border-rose-600 flex items-center justify-center animate-pulse">
                        <AlertCircle size={32} className="text-rose-600" />
                    </div>
                )}
             </div>
          ))}
          {students.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center opacity-10 gap-4 py-20 grayscale">
               <Users size={64} />
               <p className="text-[12px] font-bold uppercase tracking-[0.4em]">No Students Found</p>
            </div>
          )}
       </GlassCard>

       <GlassCard className="lg:col-span-3 p-8 flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Live Alerts</h4>
            <span className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
             <AnimatePresence initial={false} mode="popLayout">
               {alerts.map((a, i) => (
                 <motion.div 
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-2 relative overflow-hidden"
                 >
                    <motion.div 
                      initial={{ left: '-100%' }}
                      animate={{ left: '100%' }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-rose-500/10 to-transparent pointer-events-none"
                    />
                    <div className="flex justify-between items-center relative z-10">
                        <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">{a.student}</span>
                        <span className="text-[8px] text-slate-400 dark:text-white/20 font-mono">{a.time}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-white/70 italic leading-tight relative z-10">{a.type}</p>
                 </motion.div>
               ))}
               {alerts.length === 0 && (
                 <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center opacity-10 gap-4 py-20 grayscale"
                 >
                    <Shield size={48} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No Alerts</p>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
       </GlassCard>
    </div>
  );
};

const CreateTestModule: React.FC<{ user: any, onShowToast: any, classId?: string }> = ({ user, onShowToast, classId }) => {
  const currentUserId = user?.id || user?.uid;
  const [activeTab, setActiveTab] = useState<'builder' | 'designer' | 'proctoring' | 'settings' | 'preview'>('builder');
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [test, setTest] = useState<Test>({
    settings: {
      title: 'Midterm Examination 2026',
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
        content: 'APPLIED CALCULUS II',
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

  const handlePublish = async () => {
    if (!classId) return;
    setIsPublishing(true);
    try {
      const testId = test.id || crypto.randomUUID();
      const { error } = await (supabase.from('tests') as any).upsert({
        id: testId,
        classroom_id: classId,
        user_id: currentUserId,
        title: test.settings.title,
        test_data: { ...test, id: testId, classroom_id: classId },
        status: 'published',
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
      onShowToast('Test published and assigned successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to publish test:', err);
      onShowToast(`Publish Error: ${err.message}`, 'warn');
    } finally {
      setIsPublishing(false);
    }
  };

  const tabs = [
    { id: 'builder', label: 'Builder', icon: <FileText size={16} /> },
    { id: 'designer', label: 'Designer', icon: <LayoutTemplate size={16} /> },
    { id: 'proctoring', label: 'Proctoring', icon: <ShieldCheck size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
    { id: 'preview', label: 'Preview', icon: <PlayCircle size={16} /> }
  ];

  return (
    <div className="space-y-6">
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h3 className="text-3xl font-light text-slate-900 dark:text-white mb-2">Test Architecture</h3>
            <p className="text-[10px] text-slate-500 dark:text-white/30 uppercase font-bold tracking-[0.3em]">Design, configure, and proctor your examinations</p>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={() => onShowToast('Draft saved.', 'success')}
              className="px-6 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5"
             >
               Save Draft
             </button>
             <button 
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center gap-2"
             >
               {isPublishing ? 'Publishing...' : 'Publish Test'}
             </button>
          </div>
       </div>

       <div className="flex gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl w-fit mb-10 overflow-x-auto max-w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-xl transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-800" 
                  : "text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/60"
              )}
            >
              {tab.icon}
              <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
       </div>

       <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="min-h-[600px]"
          >
            {activeTab === 'builder' && <BuilderTab test={test} setTest={setTest} onShowToast={onShowToast} />}
            {activeTab === 'designer' && <DesignerTab test={test} setTest={setTest} selectedModuleId={selectedModuleId} setSelectedModuleId={setSelectedModuleId} />}
            {activeTab === 'proctoring' && <ProctoringTab test={test} setTest={setTest} />}
            {activeTab === 'settings' && <SettingsTab test={test} setTest={setTest} />}
            {activeTab === 'preview' && <PreviewTab test={test} />}
          </motion.div>
       </AnimatePresence>
    </div>
  );
};

const SettingsView = ({ onShowToast }: { onShowToast: any }) => {
  const [toggles, setToggles] = useState<Record<number, boolean>>({ 0: true, 1: false, 2: true });

  const toggle = (i: number) => {
    setToggles(prev => ({ ...prev, [i]: !prev[i] }));
  };

  return (
    <div className="max-w-2xl space-y-12 text-left">
      <SectionHeader title="Settings" subtitle="Manage your account preferences and global system configurations." />
      <div className="space-y-6">
        <GlassCard className="p-8 border-amber-500/20 bg-amber-500/5" glow>
           <div className="flex items-start gap-6">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><AlertCircle /></div>
              <div className="flex-1">
                 <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-wider">Database Sync Status</h4>
                 <p className="text-xs text-slate-500 dark:text-white/40 font-light mb-4">
                   {isSupabaseConfigured() 
                     ? "Environment variables detected. Platform is ready for persistent sync." 
                     : "Configuration missing. Supabase URL and Anon Key are required for saving data."}
                 </p>
                 <div className="flex flex-wrap gap-3">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase border",
                      isSupabaseConfigured() ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    )}>
                      {isSupabaseConfigured() ? "CONNECTED" : "DISCONNECTED"}
                    </div>
                    <div className="px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase border bg-blue-500/10 text-blue-500 border-blue-500/20">
                      SCHEMA V1.2.0
                    </div>
                 </div>
              </div>
           </div>
        </GlassCard>

        {[
          { label: 'Auto-save Logs', desc: 'Sync session records automatically.', icon: <Activity /> },
          { label: 'Cloud Backup', desc: 'Secure storage for test footage.', icon: <Lock /> },
          { label: 'Email Reports', desc: 'Send daily digests to instructors.', icon: <Mail /> }
        ].map((item, i) => (
          <GlassCard 
            key={`setting-row-${i}`} 
            className="p-8 flex items-center justify-between cursor-pointer" 
            glow 
            onClick={() => toggle(i)}
          >
            <div className="flex items-center gap-6">
               <div className="p-3 bg-black/5 dark:bg-white/5 text-blue-600 dark:text-blue-400 rounded-xl">{item.icon}</div>
               <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-wider">{item.label}</h4>
                  <p className="text-xs text-slate-500 dark:text-white/30 font-light">{item.desc}</p>
               </div>
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full flex items-center px-1 border border-black/10 dark:border-white/20 transition-all",
              toggles[i] ? "bg-blue-600 justify-end" : "bg-slate-200 dark:bg-white/10 justify-start"
            )}>
               <div className="w-4 h-4 bg-white rounded-full shadow-lg" />
            </div>
          </GlassCard>
        ))}
      </div>
      <button 
        onClick={() => onShowToast('Settings saved.', 'success')}
        className="w-full py-5 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-[11px] hover:scale-[1.02] transition-all shadow-lg"
      >
        Save Changes
      </button>
    </div>
  );
};

const ReportsView: React.FC<{ user: any }> = ({ user }) => {
    const currentUserId = user?.id || user?.uid;
    const { theme } = useTheme();
    const [stats, setStats] = useState({ present: 0, late: 0, absent: 0 });
    const [classrooms, setClassrooms] = useState<any[]>([]);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                const { data: attendance } = await (supabase.from('attendance') as any).select('*').eq('user_id', currentUserId);
                const { data: rooms } = await (supabase.from('classrooms') as any).select('*').eq('user_id', currentUserId);

                const s = { present: 0, late: 0, absent: 0 };
                (attendance || []).forEach((d: any) => {
                    if (d.status === 'Present') s.present++;
                    else if (d.status === 'Late') s.late++;
                    else s.absent++;
                });
                setStats(s);
                setClassrooms(rooms || []);
            } catch (e) {
                console.error('Failed to fetch report data:', e);
            }
        };
        fetchAttendance();
    }, []);

    return (
    <div className="space-y-12 text-left">
        <SectionHeader title="Reports" subtitle="Analyze attendance and scores across all your classrooms." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GlassCard className="p-10 h-[400px]" glow>
                 <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 mb-8">Attendance Distribution</h4>
                 <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                            {n:'Present', v: stats.present}, 
                            {n:'Late', v: stats.late}, 
                            {n:'Absent', v: stats.absent}
                        ]}>
                            <XAxis dataKey="n" fontSize={10} axisLine={false} tickLine={false} />
                            <Bar 
                            dataKey="v" 
                            fill="#3b82f6" 
                            radius={[4,4,0,0]} 
                            animationDuration={1500}
                            />
                            <Tooltip contentStyle={{ 
                                backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)', 
                                border: theme === 'dark' ? '1px solid #333' : '1px solid #ddd', 
                                borderRadius: '12px',
                                color: theme === 'dark' ? '#fff' : '#000'
                            }} />
                        </BarChart>
                    </ResponsiveContainer>
                 </div>
            </GlassCard>
            <div className="space-y-8">
               <GlassCard className="p-8 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                     <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">Last Report Sent</p>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-white/30">Just now</span>
               </GlassCard>
               <GlassCard className="p-8 flex-1 space-y-6 overflow-y-auto max-h-[300px]">
                  <div className="space-y-4">
                     {classrooms.map(room => (
                         <div key={room.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl">
                            <div className="flex items-center gap-4">
                               <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center"><ArrowRight size={14} /></div>
                               <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase truncate max-w-[150px]">{room.name}</p>
                            </div>
                            <button className="text-[10px] text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white uppercase font-bold">Export</button>
                         </div>
                      ))}
                      {classrooms.length === 0 && (
                        <p className="text-[10px] text-center opacity-20 uppercase tracking-widest py-10 font-bold">No Records</p>
                      )}
                  </div>
               </GlassCard>
        </div>
     </div>
    </div>
    );
};

const GeneralSection = ({ title, icon }: { title: string, icon: React.ReactNode }) => (
    <div className="space-y-8 text-left">
        <SectionHeader title={title} subtitle={`View and manage ${title.toLowerCase()} for all classroom instances.`} />
        <GlassCard className="p-20 flex flex-col items-center justify-center opacity-20 grayscale text-center gap-6 min-h-[400px]" glow>
            <div className="w-20 h-20 rounded-[320x] border-2 border-dashed border-black/10 dark:border-white/20 flex items-center justify-center overflow-visible text-slate-900 dark:text-white">
                {icon}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-slate-900 dark:text-white">No data records found</p>
        </GlassCard>
    </div>
);
