import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import { Landing } from './features/landing/Landing';
import { AuthCallbackPage, RoleChooser } from './features/auth/GoogleAuth';
import { AboutPage, ContactPage, NotFoundPage, PrivacyPage, TermsPage } from './features/public/InfoPages';
import { GuidePage, HelpIndexPage } from './features/public/HelpPages';
import { AnimatePresence } from 'motion/react';
import { AuthModal } from './components/auth/AuthModal';
import { SessionGuardian } from './components/auth/SessionGuardian';
import { FeedbackProvider, Spinner } from './components/ui';

// When a user has the app open across a deploy, their current index.html
// references chunk filenames that no longer exist on the server. The server
// returns the SPA fallback (HTML) for the missing chunk, the browser rejects
// it as a module (MIME mismatch), and the lazy import rejects. `lazyWithReload`
// catches that specific failure and reloads the page once, so the new
// index.html (with the fresh chunk names) takes over. One-shot, flag-gated via
// sessionStorage to prevent reload loops.
const lazyWithReload = <T extends React.ComponentType<unknown>>(loader: () => Promise<{ default: T }>) =>
  lazy(() =>
    loader().catch((err) => {
      const msg = String(err?.message || err);
      const isChunkLoadFailure = /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|MIME type|module script/i.test(msg);
      if (isChunkLoadFailure && typeof window !== 'undefined' && !sessionStorage.getItem('nc_chunk_reload')) {
        sessionStorage.setItem('nc_chunk_reload', '1');
        window.location.reload();
        // Keep React happy: return a never-resolving promise so Suspense shows
        // the fallback until the reload takes over.
        return new Promise(() => {});
      }
      throw err;
    })
  );

// Dashboards pull in TensorFlow, camera and attendance code. Loading them on
// demand keeps the public landing page small.
const InstructorDashboard = lazyWithReload(() => import('./components/instructor/InstructorDashboard').then((m) => ({ default: m.InstructorDashboard })));
const StudentDashboard = lazyWithReload(() => import('./components/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const AIModuleDashboard = lazyWithReload(() => import('./components/ai/AIModuleDashboard').then((m) => ({ default: m.AIModuleDashboard })));
const UIKitShowcase = lazyWithReload(() => import('./features/ui-kit/UIKitShowcase'));
const MobileAttendanceHandoff = lazyWithReload(() => import('./components/auth/MobileAttendanceHandoff').then((m) => ({ default: m.MobileAttendanceHandoff })));
const MobileStudentAttendancePortal = lazyWithReload(() => import('./components/attendance/MobileAttendancePortals').then((m) => ({ default: m.MobileStudentAttendancePortal })));
const MobileTeacherAttendancePortal = lazyWithReload(() => import('./components/attendance/MobileAttendancePortals').then((m) => ({ default: m.MobileTeacherAttendancePortal })));

const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center"><Spinner label="Loading…" /></div>
);

const Home = ({ onLaunchAuth }: { onLaunchAuth: (mode: 'signin' | 'signup') => void }) => (
  <Landing onSignIn={() => onLaunchAuth('signin')} onSignUp={() => onLaunchAuth('signup')} />
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
    <div className="relative min-h-screen bg-canvas font-sans text-ink">

      <Navbar onLogin={openAuth} />
      <RoleChooser />

      <main className="relative z-10">
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home onLaunchAuth={openAuth} />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/help" element={<HelpIndexPage />} />
          <Route path="/help/:slug" element={<GuidePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/ui-kit" element={<UIKitShowcase />} />
          <Route path="/attendance/mobile-handoff" element={<MobileAttendanceHandoff />} />
          <Route
            path="/attendance/teacher"
            element={<SessionGuardian><MobileTeacherAttendancePortal /></SessionGuardian>}
          />
          <Route
            path="/attendance/student"
            element={<SessionGuardian><MobileStudentAttendancePortal /></SessionGuardian>}
          />
          
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

          {/* Unknown URLs get a real "not found" page (noindex) instead of a silent redirect. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </main>

      <AnimatePresence>
        {showAIModule && (
          <Suspense fallback={null}>
            <AIModuleDashboard onClose={() => setShowAIModule(false)} />
          </Suspense>
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
          <FeedbackProvider>
            <AppContent />
          </FeedbackProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
