import React from 'react';
import { motion } from 'motion/react';
import { Maximize2, ShieldCheck, Video, Layout, GraduationCap, Github, Twitter, Linkedin } from 'lucide-react';

export const TestSystem: React.FC = () => {
  return (
    <section id="exams" className="py-20 sm:py-28 bg-slate-50/30 dark:bg-slate-900/40 text-slate-900 dark:text-white overflow-hidden relative transition-colors duration-500">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10 dark:opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#000000_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative p-1 rounded-3xl editorial-glass shadow-xl overflow-hidden aspect-square flex items-center justify-center bg-white/20 dark:bg-black/40 border border-black/5 dark:border-white/10"
            >
              <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex justify-between items-center px-4 py-2.5 rounded-xl bg-white/90 dark:bg-black/70 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 dark:text-white opacity-80">NEURAL SESSION</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-white opacity-60 tracking-widest">01:24:12</div>
              </div>
              
              {/* Mock Test UI Container */}
              <div className="w-4/5 h-3/5 flex flex-col gap-5">
                <div className="h-1 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 dark:bg-white w-[65%]" />
                </div>
                <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <h4 className="text-xl sm:text-2xl font-light mb-4 tracking-tight text-slate-900 dark:text-white">Question 14: Neural Networks</h4>
                  <p className="text-slate-500 dark:text-white/50 text-xs sm:text-sm mb-6 font-light leading-relaxed">Describe the process of backpropagation in deep learning architectures and its mathematical foundations.</p>
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div key={`mock-neural-opt-${i}`} className="py-3 px-4 rounded-xl sm:rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all cursor-pointer text-xs font-bold uppercase tracking-widest">
                        Option Instance {i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Violation Alert Toast */}
              <div className="absolute bottom-6 right-6 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-red-500/10 border border-red-500/30 backdrop-blur-md shadow-lg z-30">
                <div className="flex items-center gap-4 relative z-10">
                   <ShieldCheck size={24} className="text-red-500" />
                   <div className="text-xs text-slate-900 dark:text-white">
                     <div className="font-bold uppercase tracking-[0.2em] mb-0.5 text-[10px]">Violation Alert</div>
                     <div className="opacity-70 font-light text-[10px]">Neural attention deviation detected.</div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="order-1 lg:order-2 text-left">
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400 dark:text-white opacity-40">Immortal Supervision</span>
            <h2 className="text-4xl sm:text-5xl md:text-[56px] leading-[1.05] font-light mt-4 mb-8 text-slate-900 dark:text-white">Next-Gen <span className="italic font-serif">Assessment</span> <br /><span className="gradient-text font-bold">Protocols</span></h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { title: 'Vision Enforce', desc: 'Auto-submit on tab switch or ESC key detection.', icon: <Maximize2 size={20} /> },
                { title: 'Neural Biometry', desc: 'Detects unusual head positions or eye tracking.', icon: <ShieldCheck size={20} /> },
                { title: 'Capture Streams', desc: 'Brief high-fidelity video clips captured during moments of interest.', icon: <Video size={20} /> },
                { title: 'Modular Skins', desc: 'Full custom branding over the examination interface.', icon: <Layout size={20} /> },
              ].map((feature, i) => (
                <motion.div 
                  key={feature.title} 
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                  className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-blue-500/20 transition-all group cursor-pointer hover:-translate-y-0.5"
                >
                  <div className="text-slate-900 dark:text-white opacity-50 mb-4 group-hover:opacity-100 transition-opacity">{feature.icon}</div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-900 dark:text-white">{feature.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-white/50 font-light leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white/80 transition-colors">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="py-16 bg-white/50 dark:bg-black/50 border-t border-black/5 dark:border-white/10 transition-colors duration-500 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col md:flex-row justify-between items-start gap-10 mb-14"
        >
          <div className="space-y-4 max-w-sm">
             <div className="flex items-center gap-3">
              <img 
                src="/logo-light.png" 
                alt="NeuroClass Logo" 
                loading="lazy"
                decoding="async"
                className="h-9 w-auto object-contain block dark:hidden" 
              />
              <img 
                src="/logo-dark.png" 
                alt="NeuroClass Logo" 
                loading="lazy"
                decoding="async"
                className="h-9 w-auto object-contain hidden dark:block" 
              />
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                NEURO<span className="text-blue-600 dark:text-blue-400 font-light">CLASS</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm font-light text-slate-500 dark:text-white/50 leading-relaxed">
              Advancing classroom intelligence through semantic analysis and biometric verification protocols.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 sm:gap-16">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">System</h4>
              <div className="flex flex-col gap-2 text-xs font-light opacity-70">
                <a href="#features" className="hover:opacity-100 transition-opacity">Classrooms</a>
                <a href="#exams" className="hover:opacity-100 transition-opacity">Assessments</a>
                <a href="#dashboard" className="hover:opacity-100 transition-opacity">Analytics</a>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">Company</h4>
              <div className="flex flex-col gap-2 text-xs font-light opacity-70">
                <a href="#" className="hover:opacity-100 transition-opacity">About</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Privacy</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Terms</a>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">Social</h4>
              <div className="flex flex-col gap-2 text-xs font-light text-blue-500 dark:text-blue-400">
                <a href="#" className="hover:opacity-100 transition-opacity">Twitter</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Discord</a>
                <a href="#" className="hover:opacity-100 transition-opacity">GitHub</a>
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-black/5 dark:border-white/5 gap-3">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-40">© 2026 NEUROCLASS SYSTEMS LABS INC.</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-40 italic">Built for the future of education</p>
        </div>
      </div>
    </footer>
  );
};

