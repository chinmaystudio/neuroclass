import React from 'react';
import { motion } from 'motion/react';
import { Play, ArrowRight, Shield, UserCheck, Eye, Zap, Activity } from 'lucide-react';

interface HeroProps {
  onLaunch: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onLaunch }) => {
  return (
    <section className="relative pt-32 pb-16 overflow-hidden min-h-[85vh] flex flex-col justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <span className="inline-block px-5 py-1.5 mb-6 text-[11px] font-bold tracking-[0.25em] uppercase rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm">
            Intelligence in Every Frame
          </span>

          <h1 className="text-5xl sm:text-6xl md:text-8xl font-light tracking-tight text-slate-900 dark:text-white leading-[1.05] mb-8">
            Reinvent Classroom <br className="hidden sm:inline" />
            <span className="gradient-text font-bold">Intelligence</span>
          </h1>

          <p className="max-w-xl mx-auto text-lg sm:text-xl text-slate-600 dark:text-white/60 leading-relaxed mb-12 font-light">
            AI-powered attendance, smart exam supervision, and fully automated 
            classroom management — all in one platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onLaunch}
              className="glow-btn px-8 py-4 text-base w-full sm:w-auto"
            >
              Launch Classroom
            </button>
            <button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 rounded-full border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors text-slate-900 dark:text-white text-base w-full sm:w-auto"
            >
              Explore Features
            </button>
          </div>
        </motion.div>
      </div>

      <HeroVisual />
    </section>
  );
};

const HeroVisual: React.FC = () => {
  return (
    <div className="mt-12 sm:mt-16 relative max-w-5xl mx-auto px-4 h-[350px] sm:h-[450px] md:h-[520px]">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full h-full flex items-center justify-center"
      >
        <HeroVisualContent />
      </motion.div>
    </div>
  );
};

const HeroVisualContent = () => {
  return (
    <div className="relative w-full max-w-4xl aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-purple-500/30 shadow-2xl shadow-purple-500/20 flex items-center justify-center z-10 group">
      <img 
        src="https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1600&auto=format&fit=crop" 
        alt="AI Powered Classroom & Biometric Proctoring" 
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-all duration-700 filter brightness-105 saturate-125"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-purple-950/20 to-transparent" />
      
      {/* Glowing Ambient Neons */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/30 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-blue-500/30 rounded-full blur-[80px] pointer-events-none" />

      {/* AI Detection Bounding Box Overlay */}
      <div className="absolute top-1/4 left-1/4 w-28 h-28 sm:w-36 sm:h-36 border-2 border-purple-400 rounded-2xl flex flex-col justify-between p-2.5 shadow-[0_0_20px_rgba(168,85,247,0.4)] backdrop-blur-[2px]">
        <div className="absolute inset-0 bg-purple-500/20 animate-pulse rounded-2xl" />
        <div className="flex items-center justify-between relative z-10">
          <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-full bg-purple-600 shadow-md">ID: 4829</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <span className="text-[10px] font-bold text-emerald-300 self-end px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md relative z-10">99.4% MATCH</span>
      </div>

      {/* Floating Panels */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 hidden xs:block">
        <FloatingPanel 
          icon={<UserCheck className="text-emerald-400" size={16} />}
          label="Live Attendance"
          value="42 Students Verified"
        />
      </div>
      
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20">
        <FloatingPanel 
          icon={<Shield className="text-purple-400" size={16} />}
          label="AI Proctoring"
          value="Biometric Security Active"
        />
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 hidden md:block">
        <FloatingPanel 
          icon={<Zap className="text-amber-400" size={16} />}
          label="Verified Results"
          value="x402 Micropayments Live"
        />
      </div>
    </div>
  );
};

const FloatingPanel: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
}> = ({ icon, label, value }) => {
  return (
    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl editorial-glass flex flex-col gap-2 min-w-[180px] sm:min-w-[200px] border border-white/10 shadow-lg backdrop-blur-md">
      <div className="flex justify-between items-center w-full">
        <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.15em] text-slate-500 dark:text-white/50">{label}</p>
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-slate-700 dark:text-white">
          {icon}
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white leading-tight">{value}</p>
      </div>
    </div>
  );
};
