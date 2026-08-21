import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, BookOpen, Clock, 
  FileText, BarChart3, Settings, LogOut, Home, Sparkles, MessageCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isHovered: boolean;
  setHovered: (hovered: boolean) => void;
}

export const StudentSidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection, isHovered, setHovered }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'classes', label: 'My Classes', icon: <BookOpen size={20} /> },
    { id: 'tests', label: 'Active Tests', icon: <FileText size={20} /> },
    { id: 'performance', label: 'Performance', icon: <BarChart3 size={20} /> },
    { id: 'history', label: 'History', icon: <Clock size={20} /> },
    { id: 'project-advisor', label: 'Project Advisor', icon: <Sparkles size={20} /> },
    { id: 'learning-bot', label: 'Classroom AI', icon: <MessageCircle size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <motion.aside 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 bg-white/60 dark:bg-black/60 backdrop-blur-2xl border-r border-black/5 dark:border-white/10 transition-all duration-500 flex flex-col py-6",
        isHovered ? "w-64" : "w-20"
      )}
    >
      {/* Brand Header */}
      <div className="px-4 mb-8 flex items-center gap-3 overflow-hidden">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src="/logo-dark.png" className="w-8 h-8 hidden dark:block" alt="Logo" />
          <img src="/logo-light.png" className="w-8 h-8 block dark:hidden" alt="Logo" />
        </Link>

        {isHovered && (
          <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap animate-in fade-in">
            NEURO<span className="text-purple-600 dark:text-purple-400 font-light">STUDENT</span>
          </span>
        )}
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-2 scrollbar-hide">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 relative group",
              activeSection === item.id 
                ? "bg-purple-600 shadow-lg shadow-purple-500/30 text-white" 
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
                layoutId="studentActiveNav"
                className="absolute inset-0 bg-purple-600 rounded-2xl z-0"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="px-3 mt-auto pt-6 border-t border-black/5 dark:border-white/10 space-y-2">
        <Link to="/">
          <button className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all">
            <Home size={18} />
            {isHovered && <span className="text-[11px] font-bold uppercase tracking-widest">Homepage</span>}
          </button>
        </Link>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all"
        >
          <LogOut size={18} />
          {isHovered && <span className="text-[11px] font-bold uppercase tracking-widest">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
};
