import React from 'react';
import { motion } from 'motion/react';
import { Plus, UserPlus, Scan, ShieldCheck, Database } from 'lucide-react';

const steps = [
  {
    title: 'Create Classroom',
    desc: 'Teachers set up a workspace in seconds.',
    icon: <Plus />,
  },
  {
    title: 'Input Students',
    desc: 'Add face data and email verification.',
    icon: <UserPlus />,
  },
  {
    title: 'Smart Attendance',
    desc: 'Single or group AI facial recognition.',
    icon: <Scan />,
  },
  {
    title: 'Run AI Exams',
    desc: 'Activate proctored tests for students.',
    icon: <ShieldCheck />,
  },
  {
    title: 'Review Insights',
    desc: 'Get automated performance analytics.',
    icon: <Database />,
  },
];

export const Process: React.FC = () => {
  return (
    <section id="how-it-works" className="py-20 bg-slate-50/30 dark:bg-slate-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">How It Works</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">Five simple steps to a smarter classroom.</p>
        </div>

        <div className="relative">
          {/* Connector Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 -translate-y-1/2" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
                className="relative z-10 flex flex-col items-center text-center px-4"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full editorial-glass border border-black/5 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white mb-5 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors duration-200">
                  {step.icon}
                </div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-xs text-slate-600 dark:text-white/50 leading-relaxed font-light">
                  {step.desc}
                </p>
                <div className="mt-3 text-[10px] font-bold text-slate-400 dark:text-white/20 uppercase tracking-wider">PHASE {index + 1}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

interface DashboardPreviewProps {
  onLaunch?: () => void;
}

export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ onLaunch }) => {
  return (
    <section id="dashboard" className="py-20 sm:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex-1"
          >
            <span className="text-slate-400 dark:text-white/40 font-bold uppercase tracking-[0.25em] text-[10px]">Simple Control</span>
            <h2 className="text-4xl sm:text-5xl md:text-[56px] leading-[1.05] font-light text-slate-900 dark:text-white mt-4 mb-8">
              Complete <span className="italic font-serif">Classroom</span> <br />
              <span className="gradient-text font-bold">Dashboard</span>
            </h2>
            <div className="space-y-8">
              {[
                { title: 'Unified Classrooms', desc: 'Manage all your classes from a single high-fidelity view.' },
                { title: 'Attendance Trends', desc: 'Real-time attendance logs mapped against student engagement.' },
                { title: 'Secure Monitoring', desc: 'Protect test integrity with automated suspicious activity alerts.' },
              ].map((item) => (
                <div 
                  key={item.title} 
                  className="flex gap-5 group"
                >
                  <div className="w-[2px] h-12 bg-black/10 dark:bg-white/10 group-hover:bg-blue-500 transition-colors" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white mb-1.5">{item.title}</h4>
                    <p className="text-sm font-light text-slate-500 dark:text-white/50 max-w-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={onLaunch}
              className="mt-10 px-8 py-3.5 rounded-full border border-black/10 dark:border-white/20 text-xs font-bold uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all text-slate-900 dark:text-white"
            >
              Launch Dashboard
            </button>
          </motion.div>
          
          <div className="flex-1 relative w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative p-1 rounded-3xl editorial-glass overflow-hidden shadow-xl border border-black/5 dark:border-white/10"
            >
              <img 
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop" 
                alt="AI Dashboard Analytics" 
                loading="lazy"
                decoding="async"
                className="w-full h-auto rounded-[22px] opacity-100 dark:opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
                referrerPolicy="no-referrer"
              />
              {/* Overlay element */}
              <div className="absolute top-6 right-6 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white/90 dark:bg-black/85 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg z-20">
                <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-white/40 font-bold uppercase tracking-widest mb-1">Attendance Rate</div>
                <div className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white tracking-tighter">98.4% <span className="text-xs text-emerald-500 align-top ml-1">↑</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

