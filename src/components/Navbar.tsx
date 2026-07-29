import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, GraduationCap, Menu, X } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  onLaunch: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLaunch }) => {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Dashboard', href: '#dashboard' },
    { name: 'Monitoring', href: '#exams' },
    { name: 'How It Works', href: '#how-it-works' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-black/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <motion.div 
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            />
            <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white">
              NEUROCLASS
            </span>
          </motion.div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-white/70 hover:text-blue-500 dark:hover:text-white transition-all"
              >
                {link.name}
              </a>
            ))}
            <div className="flex items-center gap-4 border-l border-white/10 pl-10">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-300"
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </motion.button>
              <motion.button 
                whileHover={{ 
                  scale: 1.05, 
                  y: -2,
                  boxShadow: "0 0 20px rgba(59,130,246,0.3)"
                }}
                whileTap={{ scale: 0.98 }}
                onClick={onLaunch}
                className="px-8 py-2.5 rounded-full border border-blue-500/30 dark:border-white/20 text-[11px] font-bold uppercase tracking-[0.2em] bg-blue-600 dark:bg-transparent text-white hover:bg-blue-700 dark:hover:bg-white dark:hover:text-black transition-all duration-500"
              >
                Launch Dashboard
              </motion.button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-600 dark:text-slate-300"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/10 px-4 py-6 flex flex-col gap-4"
        >
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="text-lg font-medium text-slate-600 dark:text-slate-300"
            >
              {link.name}
            </a>
          ))}
          <button 
            onClick={onLaunch}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-semibold"
          >
            Launch App
          </button>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
