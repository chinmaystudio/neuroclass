import React from 'react';
import { motion } from 'motion/react';
import { Maximize2, ShieldCheck, Video, Layout, GraduationCap, Github, Twitter, Linkedin } from 'lucide-react';

export const TestSystem: React.FC = () => {
  return (
    <section id="exams" className="py-32 bg-slate-50/30 dark:bg-slate-900/40 text-slate-900 dark:text-white overflow-hidden relative transition-colors duration-500">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10 dark:opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#000000_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.2 }}
              variants={{
                hidden: { opacity: 0, scale: 0.5, rotateY: 90, x: -100, filter: 'blur(20px)' },
                visible: { opacity: 1, scale: 1, rotateY: 0, x: 0, filter: 'blur(0px)', transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } }
              }}
              className="relative p-1 rounded-[32px] editorial-glass shadow-2xl overflow-hidden aspect-square flex items-center justify-center bg-white/20 dark:bg-black/40 will-change-[transform,opacity,filter] transform-gpu"
            >
              <div className="absolute top-6 left-6 right-6 flex justify-between items-center px-5 py-3 rounded-xl bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-slate-500 dark:text-white opacity-70">NEURAL SESSION</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-white opacity-50 tracking-widest">01:24:12</div>
              </div>
              
              {/* Mock Test UI Container */}
              <div className="w-4/5 h-3/5 flex flex-col gap-6">
                <div className="h-1 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    whileInView={{ width: "65%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 2 }}
                    className="h-full bg-slate-900 dark:bg-white" 
                  />
                </div>
                <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <h4 className="text-2xl font-light mb-6 tracking-tight text-slate-900 dark:text-white">Question 14: Neural Networks</h4>
                  <p className="text-slate-500 dark:text-white/40 text-sm mb-8 font-light leading-relaxed">Describe the process of backpropagation in deep learning architectures and its mathematical foundations.</p>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={`mock-neural-opt-${i}`} className="py-4 px-5 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all cursor-pointer text-xs font-bold uppercase tracking-widest">
                        Option Instance {i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

               {/* AI Violation Alert Toast with Red Glow Pulse */}
              <motion.div
                initial={{ opacity: 0, x: 40, scale: 0.9 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ 
                  delay: 1.5, 
                  duration: 0.8, 
                  ease: [0.16, 1, 0.3, 1] 
                }}
                className="absolute bottom-10 right-10 p-6 rounded-2xl bg-red-500/10 border border-red-500/30 backdrop-blur-xl shadow-[0_0_40px_rgba(239,68,68,0.2)] z-30"
              >
                <motion.div 
                  animate={{ 
                    boxShadow: [
                      "0 0 20px rgba(239,68,68,0)",
                      "0 0 40px rgba(239,68,68,0.4)",
                      "0 0 20px rgba(239,68,68,0)"
                    ] 
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                />
                <div className="flex items-center gap-5 relative z-10">
                   <ShieldCheck size={28} className="text-red-500" />
                   <div className="text-xs text-slate-900 dark:text-white">
                     <div className="font-bold uppercase tracking-[0.3em] mb-1">Violation Alert</div>
                     <div className="opacity-60 font-light text-[10px]">Neural attention deviation detected.</div>
                   </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <div className="order-1 lg:order-2 text-left">
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-slate-400 dark:text-white opacity-40">Immortal Supervision</span>
            <h2 className="text-[56px] leading-[0.95] font-light mt-6 mb-10 text-slate-900 dark:text-white">Next-Gen <span className="italic font-serif">Assessment</span> <br /><span className="gradient-text font-bold">Protocols</span></h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {[
                { title: 'Vision Enforce', desc: 'Auto-submit on tab switch or ESC key detection.', icon: <Maximize2 /> },
                { title: 'Neural Biometry', desc: 'Detects unusual head positions or eye tracking.', icon: <ShieldCheck /> },
                { title: 'Capture Streams', desc: 'Brief high-fidelity video clips captured during moments of interest.', icon: <Video /> },
                { title: 'Modular Skins', desc: 'Full custom branding over the examination interface.', icon: <Layout /> },
              ].map((feature, i) => (
                <motion.div 
                  key={feature.title} 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: false, amount: 0.1 }}
                  variants={{
                    hidden: { opacity: 0, scale: 0, rotateZ: 45, x: 50 },
                    visible: { opacity: 1, scale: 1, rotateZ: 0, x: 0, transition: { delay: i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="p-8 rounded-3xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group cursor-pointer will-change-transform transform-gpu"
                >
                  <div className="text-slate-900 dark:text-white opacity-40 mb-6 group-hover:opacity-100 group-hover:scale-110 transition-all">{feature.icon}</div>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest mb-3 text-slate-900 dark:text-white">{feature.title}</h4>
                  <p className="text-sm text-slate-500 dark:text-white/40 font-light leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white/70 transition-colors">{feature.desc}</p>
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
    <footer className="py-24 bg-white/50 dark:bg-black/50 border-t border-black/5 dark:border-white/10 transition-colors duration-500 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.1 }}
          variants={{
            hidden: { opacity: 0, y: 100, scale: 0.8, rotateX: -30 },
            visible: { opacity: 1, y: 0, scale: 1, rotateX: 0, transition: { duration: 1.2, ease: "easeOut" } }
          }}
          className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20 will-change-transform transform-gpu"
        >
          <div className="space-y-6 max-w-sm">
             <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600"></div>
              <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white">
                NEUROCLASS
              </span>
            </div>
            <p className="text-sm font-light text-slate-500 leading-relaxed">
              Advancing classroom intelligence through semantic analysis and biometric verification protocols.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">System</h4>
              <div className="flex flex-col gap-2 text-sm font-light opacity-60">
                <a href="#" className="hover:opacity-100 transition-opacity">Classrooms</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Assessments</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Analytics</a>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Company</h4>
              <div className="flex flex-col gap-2 text-sm font-light opacity-60">
                <a href="#" className="hover:opacity-100 transition-opacity">About</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Privacy</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Terms</a>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Social</h4>
              <div className="flex flex-col gap-2 text-sm font-light opacity-60 text-blue-500">
                <a href="#" className="hover:opacity-100 transition-opacity">Twitter</a>
                <a href="#" className="hover:opacity-100 transition-opacity">Discord</a>
                <a href="#" className="hover:opacity-100 transition-opacity">GitHub</a>
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-black/5 dark:border-white/5 gap-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-30">© 2026 NEUROCLASS SYSTEMS LABS INC.</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-30 italic">Built for the future of education</p>
        </div>
      </div>
    </footer>
  );
};
