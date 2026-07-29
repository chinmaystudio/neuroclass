import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Play, ArrowRight, Shield, UserCheck, Eye, Zap, Activity } from 'lucide-react';

interface HeroProps {
  onLaunch: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onLaunch }) => {
  return (
    <section className="relative pt-40 pb-20 overflow-hidden min-h-[90vh] flex flex-col justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.1 }}
          className="will-change-[transform,opacity,filter] transform-gpu"
          variants={{
            hidden: { opacity: 0, scale: 0.5, rotateX: 45, filter: 'blur(20px)', y: 100 },
            visible: { 
              opacity: 1, 
              scale: 1, 
              rotateX: 0, 
              filter: 'blur(0px)', 
              y: 0,
              transition: { 
                staggerChildren: 0.12, 
                duration: 1, 
                ease: [0.16, 1, 0.3, 1] 
              }
            }
          }}
        >
          <motion.span 
            variants={{
              hidden: { opacity: 0, y: 30, scale: 0.9 },
              visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
            }}
            className="inline-block px-6 py-2 mb-8 text-[11px] font-bold tracking-[0.3em] uppercase rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 backdrop-blur-3xl shadow-[0_0_30px_rgba(59,130,246,0.15)] will-change-transform transform-gpu"
          >
            Intelligence in Every Frame
          </motion.span>
          <motion.h1 
            variants={{
              hidden: { opacity: 0 },
              visible: { 
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.2 }
              }
            }}
            className="text-[64px] md:text-[96px] font-light tracking-tight text-slate-900 dark:text-white leading-[0.9] mb-10 will-change-[transform,opacity]"
          >
            {"Reinvent Classroom Intelligence".split(" ").map((word, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0, scale: 0.4, filter: 'blur(20px)', y: 80, rotateZ: i % 2 === 0 ? -15 : 15, rotateX: 90 },
                  visible: { 
                    opacity: 1, 
                    scale: 1, 
                    filter: 'blur(0px)', 
                    y: 0, 
                    rotateZ: 0,
                    rotateX: 0,
                    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
                  }
                }}
                className={`inline-block mr-[0.2em] will-change-[transform,opacity,filter] transform-gpu ${word === "Intelligence" ? "gradient-text font-bold" : i === 1 ? "italic font-serif" : ""}`}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>
          <motion.p 
            variants={{
              hidden: { opacity: 0, y: 100, scale: 0.8, filter: 'blur(10px)', skewY: 5 },
              visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', skewY: 0, transition: { duration: 1.2, ease: "easeOut" } }
            }}
            className="max-w-xl mx-auto text-xl text-slate-600 dark:text-white/50 leading-relaxed mb-16 font-light will-change-[transform,opacity,filter] transform-gpu"
          >
            AI-powered attendance, smart exam supervision, and fully automated 
            classroom management — all in one platform.
          </motion.p>
...

          <motion.div 
            variants={{
              hidden: { opacity: 0, scale: 0.5, y: 100, rotateY: 45 },
              visible: { opacity: 1, scale: 1, y: 0, rotateY: 0, transition: { type: "spring", stiffness: 300, damping: 15 } }
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 will-change-transform transform-gpu"
          >
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLaunch}
              className="glow-btn px-8 py-4 text-lg"
            >
              Launch Classroom
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 rounded-full border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors text-slate-900 dark:text-white"
            >
              Explore Features
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-blue-500 to-transparent" />
        </motion.div>
      </div>

      <HeroVisual />
    </section>
  );
};

const HeroVisual: React.FC = () => {
  return (
    <div className="mt-20 relative max-w-6xl mx-auto px-4 h-[500px] md:h-[600px] [perspective:2000px]">
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.1 }}
        variants={{
          hidden: { rotateX: 60, y: 200, opacity: 0, scale: 0.2, rotateY: 30, filter: 'blur(40px)' },
          visible: { rotateX: 0, y: 0, opacity: 1, scale: 1, rotateY: 0, filter: 'blur(0px)', transition: { duration: 2, ease: [0.16, 1, 0.3, 1] } }
        }}
        className="absolute inset-0 flex items-center justify-center translate-z-0"
      >
        <HeroVisualContent />
      </motion.div>
    </div>
  );
};

const HeroVisualContent = () => {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const y4 = useTransform(scrollYProgress, [0, 1], [0, -200]);

  return (
    <>
        {/* Main Central Container with parallax */}
        <motion.div 
          style={{ y: y1 }}
          className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] flex items-center justify-center z-10"
        >
           <img 
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop" 
            alt="Students in Classroom" 
            className="w-full h-full object-cover opacity-50 dark:opacity-40 grayscale group-hover:grayscale-0 transition-all duration-1000"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
          
          {/* AI Detection Overlay Simulation with draw effect */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-blue-500/40 rounded-lg flex flex-col justify-between p-2"
          >
            <motion.div 
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-blue-500/10"
            />
            <span className="text-[10px] font-bold text-slate-900/70 dark:text-white/70 self-start px-1 relative z-10">ID: 4829</span>
            <span className="text-[10px] font-bold text-slate-900/70 dark:text-white/70 self-end px-1 italic relative z-10">98.4% MATCH</span>
          </motion.div>
        </motion.div>

        {/* Floating Panels with varying parallax speeds */}
        <motion.div style={{ y: y2 }} className="absolute top-0 -left-10 md:left-0 z-20">
          <FloatingPanel 
            delay={0}
            icon={<UserCheck className="text-blue-400" size={18} />}
            label="Live Attendance"
            value="42 Students Present"
            color="blue"
          />
        </motion.div>
        
        <motion.div style={{ y: y3 }} className="absolute bottom-10 -right-10 md:right-0 z-20">
          <FloatingPanel 
            delay={1}
            icon={<Shield className="text-purple-400" size={18} />}
            label="Test Monitoring"
            value="Room 102 Active"
            color="purple"
          />
        </motion.div>

        <motion.div style={{ y: y4 }} className="absolute top-20 -right-5 md:right-10 z-20">
          <FloatingPanel 
            delay={0.5}
            icon={<Zap className="text-pink-400" size={18} />}
            label="Verified Results"
            value="Syncing classroom records"
            color="pink"
          />
        </motion.div>
    </>
  );
};

const FloatingPanel: React.FC<{ 
  className?: string; 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  delay: number;
  color: string;
}> = ({ className = "", icon, label, value, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        y: [0, -10, 0],
        scale: 1,
      }}
      transition={{ 
        opacity: { duration: 0.5, delay },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: delay * 0.5 },
      }}
      className={`absolute z-20 p-5 editorial-glass flex flex-col gap-3 min-w-[220px] ${className}`}
    >
      <div className="flex justify-between items-center w-full">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 dark:text-white/50">{label}</p>
        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-600 dark:text-white">
          {icon}
        </div>
        <p className="text-sm font-light text-slate-900 dark:text-white leading-tight">{value}</p>
      </div>
    </motion.div>
  );
};
