import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import ParticleBackground from './components/common/ParticleBackground';
import { Hero } from './components/common/Hero';
import Features from './components/common/Features';
import { Process, DashboardPreview } from './components/common/WorkAndDashboard';
import { TestSystem, Footer } from './components/common/TestAndFooter';
import { InstructorDashboard } from './components/instructor/InstructorDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { AIModuleDashboard } from './components/ai/AIModuleDashboard';
import { AnimatePresence } from 'motion/react';
import { AuthModal } from './components/auth/AuthModal';
import { SessionGuardian } from './components/auth/SessionGuardian';

const Home = ({ onLaunchAuth }: { onLaunchAuth: (mode: 'signin' | 'signup') => void }) => (
  <>
    <Hero onLaunch={() => onLaunchAuth('signin')} />
    <Features />
    <Process />
    <DashboardPreview />
    <TestSystem />
    <Footer />
  </>
);

const AppContent = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showAIModule, setShowAIModule] = useState(false);
  const navigate = useNavigate();

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (role: 'teacher' | 'student') => {
    setIsAuthModalOpen(false);
    navigate(`/${role}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white selection:bg-blue-500 selection:text-white relative transition-colors duration-300 font-sans">
      <ParticleBackground />

      <Navbar onLogin={openAuth} />

      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<Home onLaunchAuth={openAuth} />} />
          
          <Route 
            path="/teacher/*" 
            element={
              <SessionGuardian allowedRole="teacher">
                <InstructorDashboard />
              </SessionGuardian>
            } 
          />
          
          <Route 
            path="/student/*" 
            element={
              <SessionGuardian allowedRole="student">
                <StudentDashboard />
              </SessionGuardian>
            } 
          />

          {/* Catch-all redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <AnimatePresence>
        {showAIModule && (
          <AIModuleDashboard onClose={() => setShowAIModule(false)} />
        )}
      </AnimatePresence>
      
      {/* Note: In AuthModal we might want to respect the 'authMode' passed from App.tsx */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSelectRole={handleAuthSuccess}
        initialMode={authMode}
      />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
