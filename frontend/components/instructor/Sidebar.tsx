import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, Users, UserCheck, Monitor, 
  FileText, BarChart3, Settings, BrainCircuit, ShieldCheck,
  Zap, ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isHovered: boolean;
  setHovered: (hovered: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection, isHovered, setHovered }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'classrooms', label: 'Classrooms', icon: <Users size={20} /> },
    { id: 'stripe', label: 'Payments (Test)', icon: <Zap size={20} /> }, // Algorand Settlements
    { id: 'attendance', label: 'Attendance', icon: <UserCheck size={20} /> },
    { id: 'monitoring', label: 'Live Monitoring', icon: <Monitor size={20} /> },
    { id: 'tests', label: 'Test Designer', icon: <BrainCircuit size={20} /> },
    { id: 'proctoring', label: 'Proctoring', icon: <ShieldCheck size={20} /> },
    { id: 'reports', label: 'Analytics', icon: <BarChart3 size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <>
    <motion.aside 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "hidden md:flex fixed left-0 top-20 bottom-0 z-40 bg-white/50 dark:bg-black/50 backdrop-blur-2xl border-r border-black/5 dark:border-white/10 transition-all duration-500 flex-col py-6",
        isHovered ? "w-64" : "w-20"
      )}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-2 scrollbar-hide">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 relative group",
              activeSection === item.id 
                ? "bg-blue-600 shadow-lg shadow-blue-500/30 text-white" 
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <div className="relative z-10">{item.icon}</div>
            
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-300",
              isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 absolute left-14"
            )}>
              {item.label}
            </span>
            
            {activeSection === item.id && (
              <motion.div 
                layoutId="activeNav"
                className="absolute inset-0 bg-blue-600 rounded-2xl z-0"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 mt-auto pt-6 border-t border-black/5 dark:border-white/10">
        <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity">
          <ArrowRight size={18} className={cn("transition-transform", isHovered ? "" : "rotate-180")} />
        </button>
      </div>
    </motion.aside>

    <nav aria-label="Teacher navigation" className="fixed bottom-3 left-3 right-3 z-50 flex items-center gap-1 overflow-x-auto rounded-2xl border border-black/10 bg-white/90 px-2 py-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#111]/90 md:hidden scrollbar-hide">
      {navItems.map((item) => (
        <button
          key={`mobile-${item.id}`}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={() => setActiveSection(item.id)}
          className={cn(
            "flex min-w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-[9px] font-bold uppercase tracking-wide transition-colors active:scale-95",
            activeSection === item.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-slate-500 dark:text-slate-300"
          )}
        >
          {React.cloneElement(item.icon, { size: 18 })}
          <span>{item.label.split(' ')[0]}</span>
        </button>
      ))}
    </nav>
    </>
  );
};
