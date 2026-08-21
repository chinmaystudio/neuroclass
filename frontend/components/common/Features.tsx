import React from 'react';
import { motion } from 'motion/react';
import { Camera, Users, ShieldAlert, Mail, Settings, CheckCircle2 } from 'lucide-react';

const features = [
  {
    title: 'Face ID Attendance',
    description: 'Instant student identification using high-precision biometric scanning.',
    icon: <Camera className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-400',
  },
  {
    title: 'Group Scanning',
    description: 'Scan entire rows of students in seconds with multi-face detection AI.',
    icon: <Users className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: 'AI Proctored Exams',
    description: 'Detect tab switches, eye movement, and suspicious behavior automatically.',
    icon: <ShieldAlert className="w-6 h-6" />,
    color: 'from-rose-500 to-orange-500',
  },
  {
    title: 'Auto Email Verification',
    description: 'Seamless verification system with automated email alerts for parents.',
    icon: <Mail className="w-6 h-6" />,
    color: 'from-emerald-500 to-teal-400',
  },
  {
    title: 'Custom Test Builder',
    description: 'Fully brandable test interface with granular UI and security controls.',
    icon: <Settings className="w-6 h-6" />,
    color: 'from-blue-600 to-indigo-600',
  },
  {
    title: 'Instant Reporting',
    description: 'Get detailed attendance and performance analytics in real-time.',
    icon: <CheckCircle2 className="w-6 h-6" />,
    color: 'from-amber-500 to-yellow-500',
  },
];

const Features: React.FC = () => {
  return (
    <section id="features" className="py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Master Every Aspect of Your <span className="text-blue-500">Classroom</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-base sm:text-lg">
            Our suite of AI tools is designed to eliminate manual tracking and 
            provide a secure, intelligent environment for both teachers and students.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: index * 0.05, duration: 0.4, ease: 'easeOut' }}
              className="group relative p-8 sm:p-10 editorial-glass border border-black/5 dark:border-white/5 hover:border-blue-500/30 dark:hover:border-blue-400/30 cursor-pointer rounded-3xl shadow-sm hover:shadow-xl dark:shadow-none hover:-translate-y-1 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-500/0 to-blue-500/5 group-hover:to-blue-500/10 transition-all duration-300 pointer-events-none rounded-3xl" />
              
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-8 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-[11px] font-bold tracking-[0.25em] uppercase text-slate-400 dark:text-white/40 mb-3 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">{feature.title}</h3>
              <p className="text-xl sm:text-2xl font-light text-slate-700 dark:text-white/70 leading-snug group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;

