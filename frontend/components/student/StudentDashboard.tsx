import React, { useState } from 'react';
import { StudentSidebar } from './StudentSidebar';
import { EnrolledClasses } from './EnrolledClasses';
import { JoinClassWizard } from './JoinClassWizard';
import { ActiveTests } from './ActiveTests';
import { ExamTaker } from './ExamTaker';
import { StudentOverview } from './StudentOverview';
import { StudentPerformance } from './StudentPerformance';
import { StudentHistory } from './StudentHistory';
import { StudentSettings } from './StudentSettings';
import { ProjectAdvisor } from './ProjectAdvisor';
import { ClassroomLearningBot } from './ClassroomLearningBot';

export const StudentDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [isJoinWizardOpen, setJoinWizardOpen] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <StudentOverview
            onNavigate={(section) => setActiveSection(section)}
            onJoinClick={() => setJoinWizardOpen(true)}
            onStartTest={(testId) => setActiveTestId(testId)}
          />
        );
      case 'classes':
        return <EnrolledClasses onJoinClick={() => setJoinWizardOpen(true)} onStartTest={(testId) => setActiveTestId(testId)} />;
      case 'tests':
        return <ActiveTests onStartTest={(testId) => setActiveTestId(testId)} />;
      case 'performance':
        return <StudentPerformance />;
      case 'history':
        return <StudentHistory />;
      case 'project-advisor':
        return <ProjectAdvisor />;
      case 'learning-bot':
        return <ClassroomLearningBot />;
      case 'settings':
        return <StudentSettings onRegisterFaceClick={() => setJoinWizardOpen(true)} />;
      default:
        return (
          <StudentOverview
            onNavigate={(section) => setActiveSection(section)}
            onJoinClick={() => setJoinWizardOpen(true)}
            onStartTest={(testId) => setActiveTestId(testId)}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white flex font-sans overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px] translate-y-1/2 translate-x-1/2" />
      </div>

      <StudentSidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection} 
        isHovered={isSidebarHovered} 
        setHovered={setSidebarHovered} 
      />
      
      <main 
        className="flex-1 relative z-10 transition-all duration-500 overflow-y-auto bg-white/50 dark:bg-black/20 backdrop-blur-3xl border-l border-black/5 dark:border-white/10"
        style={{ marginLeft: isSidebarHovered ? '16rem' : '5rem' }}
      >
        {renderContent()}
      </main>

      {/* Biometric Join Wizard */}
      <JoinClassWizard 
        isOpen={isJoinWizardOpen} 
        onClose={() => setJoinWizardOpen(false)} 
        onSuccess={() => {
          setActiveSection('classes');
        }}
      />
      
      {activeTestId && (
        <ExamTaker 
          testId={activeTestId} 
          onExit={() => {
            setActiveTestId(null);
            setActiveSection('history');
          }} 
        />
      )}
    </div>
  );
};
