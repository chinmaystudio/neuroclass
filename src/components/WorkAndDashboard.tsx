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
    <section id="how-it-works" className="py-24 bg-slate-50/30 dark:bg-slate-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">How It Works</h2>
          <p className="text-slate-600 dark:text-slate-400">Five simple steps to a smarter classroom.</p>
        </div>

        <div className="relative">
          {/* Connector Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 -translate-y-1/2" />
          
        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 will-change-[transform,opacity] transform-gpu"
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              variants={{
                hidden: { opacity: 0, y: 100, scale: 0.2, rotateY: 90, filter: 'blur(20px)' },
                visible: { opacity: 1, y: 0, scale: 1, rotateY: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } }
              }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="relative z-10 flex flex-col items-center text-center px-4 will-change-[transform,opacity,filter] transform-gpu"
            >
              <div className="w-16 h-16 rounded-full editorial-glass border-black/5 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white mb-6 group hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all">
                {step.icon}
              </div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-[12px] text-slate-600 dark:text-white/40 leading-relaxed font-light">
                {step.desc}
              </p>
              <div className="mt-4 text-[10px] font-bold text-slate-400 dark:text-white/10 italic">PHASE {index + 1}</div>
            </motion.div>
          ))}
        </motion.div>
        </div>
      </div>
    </section>
  );
};

interface DashboardPreviewProps {
  onLaunch: () => void;
}

export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ onLaunch }) => {
  return (
    <section id="dashboard" className="py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.2 }}
            variants={{
              hidden: { opacity: 0, x: -150, scale: 0.5, rotateY: -30, filter: 'blur(15px)' },
              visible: { opacity: 1, x: 0, scale: 1, rotateY: 0, filter: 'blur(0px)', transition: { duration: 1, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.1 } }
            }}
            className="flex-1 will-change-[transform,opacity,filter] transform-gpu"
          >
            <motion.span variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="text-slate-400 dark:text-white/40 font-bold uppercase tracking-[0.3em] text-[10px]">Simple Control</motion.span>
            <motion.h2 variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0 } }} className="text-[56px] leading-[0.95] font-light text-slate-900 dark:text-white mt-6 mb-10">
              Complete <span className="italic font-serif">Classroom</span> <br />
              <span className="gradient-text font-bold">Dashboard</span>
            </motion.h2>
            <div className="space-y-10">
              {[
                { title: 'Unified Classrooms', desc: 'Manage all your classes from a single high-fidelity view.' },
                { title: 'Attendance Trends', desc: 'Real-time attendance logs mapped against student engagement.' },
                { title: 'Secure Monitoring', desc: 'Protect test integrity with automated suspicious activity alerts.' },
              ].map((item) => (
                <motion.div 
                  key={item.title} 
                  variants={{ hidden: { opacity: 0, x: -50 }, visible: { opacity: 1, x: 0 } }}
                  className="flex gap-6 group"
                >
                  <div className="w-[1px] h-12 bg-black/10 dark:bg-white/10 group-hover:bg-slate-900 dark:group-hover:bg-white transition-colors" />
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-900 dark:text-white mb-2">{item.title}</h4>
                    <p className="text-sm font-light text-slate-500 dark:text-white/40 max-w-sm">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.button 
              variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1 } }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLaunch}
              className="mt-14 px-10 py-3.5 rounded-full border border-black/10 dark:border-white/20 text-xs font-bold uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all text-slate-900 dark:text-white"
            >
              Launch Dashboard
            </motion.button>
          </motion.div>
          
          <div className="flex-1 relative">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0, x: 150, scale: 0.3, rotateY: 45, filter: 'blur(20px)' },
                visible: { opacity: 1, x: 0, scale: 1, rotateY: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } }
              }}
              style={{ perspective: 1000 }}
              className="relative p-1 rounded-[32px] editorial-glass overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] dark:shadow-none will-change-[transform,opacity,filter] transform-gpu"
            >
              <motion.img 
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
                alt="AI Dashboard Analytics" 
                className="w-full h-auto rounded-[28px] opacity-100 dark:opacity-40 grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              {/* Overlay elements with parallax */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 1 }}
                className="absolute top-8 right-8 p-6 rounded-2xl bg-white/90 dark:bg-black/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-2xl z-20"
              >
                <div className="text-[10px] text-slate-400 dark:text-white/40 font-bold uppercase tracking-widest mb-1">Attendance Rate</div>
                <div className="text-3xl font-light text-slate-900 dark:text-white tracking-tighter">98.4% <span className="text-xs text-green-600 dark:text-green-400 align-top ml-1">↑</span></div>
              </motion.div>
              
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 2, 0]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
