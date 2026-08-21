import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Menu, X, LogOut, UserPlus, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  onLogin?: (mode: 'signin' | 'signup') => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLogin }) => {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const { user, userRole, logout } = useAuth();
  const location = useLocation();

  // Do not render top navbar on dashboard portals
  if (location.pathname.startsWith('/student') || location.pathname.startsWith('/teacher')) {
    return null;
  }

  // Only show nav links on the homepage
  const isHome = location.pathname === '/';

  const navLinks = isHome ? [
    { name: 'Features', href: '#features' },
    { name: 'Dashboard', href: '#dashboard' },
    { name: 'Monitoring', href: '#exams' },
    { name: 'How It Works', href: '#how-it-works' },
  ] : [];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-black/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <img 
                src="/logo-light.png" 
                alt="NeuroClass Logo" 
                className="h-10 w-auto object-contain block dark:hidden drop-shadow-[0_0_10px_rgba(59,130,246,0.2)] transition-transform group-hover:scale-105" 
              />
              <img 
                src="/logo-dark.png" 
                alt="NeuroClass Logo" 
                className="h-10 w-auto object-contain hidden dark:block drop-shadow-[0_0_12px_rgba(59,130,246,0.4)] transition-transform group-hover:scale-105" 
              />
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                NEURO<span className="text-blue-600 dark:text-blue-400 font-light">CLASS</span>
              </span>
            </motion.div>
          </Link>

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
            <div className="flex items-center gap-4 border-l border-black/10 dark:border-white/10 pl-10">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-300"
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </motion.button>
              
              {user ? (
                <div className="flex items-center gap-3">
                  {isHome && (
                    <Link to={`/${userRole}`}>
                      <motion.button 
                        whileHover={{ scale: 1.05, y: -2, boxShadow: "0 0 20px rgba(59,130,246,0.3)" }}
                        whileTap={{ scale: 0.98 }}
                        className="px-6 py-2.5 rounded-full border border-blue-500/30 text-[11px] font-bold uppercase tracking-[0.2em] bg-blue-600 text-white hover:bg-blue-700 transition-all"
                      >
                        Go to Portal
                      </motion.button>
                    </Link>
                  )}
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-rose-500/30 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <LogOut size={14} />
                    Logout
                  </motion.button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onLogin?.('signin')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-slate-300 dark:border-white/20 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    <LogIn size={14} />
                    Sign In
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05, y: -2, boxShadow: "0 0 20px rgba(168,85,247,0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onLogin?.('signup')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-purple-500/30 text-[11px] font-bold uppercase tracking-[0.2em] bg-purple-600 text-white hover:bg-purple-700 transition-all"
                  >
                    <UserPlus size={14} />
                    Create Account
                  </motion.button>
                </div>
              )}
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
          {user ? (
             <>
                {isHome && (
                  <Link to={`/${userRole}`} onClick={() => setIsOpen(false)}>
                    <button className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold">
                      Go to Portal
                    </button>
                  </Link>
                )}
                <button 
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-600 font-semibold"
                >
                  Logout
                </button>
             </>
          ) : (
             <>
                <button 
                  onClick={() => { onLogin?.('signin'); setIsOpen(false); }}
                  className="w-full py-3 rounded-xl border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-semibold"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { onLogin?.('signup'); setIsOpen(false); }}
                  className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold"
                >
                  Create Account
                </button>
             </>
          )}
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;

