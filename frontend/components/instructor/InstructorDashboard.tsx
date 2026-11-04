import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { ClassroomList } from './ClassroomList';
import { ClassroomDetail } from './ClassroomDetail';
import { StripeDashboard } from './stripe/StripeDashboard';

import { InstructorSettings } from './InstructorSettings';
import { AttendanceSystem } from '../ai/AttendanceSystem';
import { ProctoringSystem } from '../ai/ProctoringSystem';
import { AnalyticsDashboard } from '../evaluation/AnalyticsDashboard';
import { useLocation } from 'react-router-dom';
import { FEATURES } from '../../config/features';

export const InstructorDashboard: React.FC = () => {
  const location = useLocation();
  const requestedClassroomId = new URLSearchParams(location.search).get('classroomId');
  const attendanceHandoff = new URLSearchParams(location.search).get('attendance') === '1' && Boolean(requestedClassroomId);
  const driveHandoff = Boolean(requestedClassroomId) && ['connected', 'denied', 'error'].includes(new URLSearchParams(location.search).get('drive') || '');
  const classroomHandoff = attendanceHandoff || driveHandoff;
  const [activeSection, setActiveSection] = useState(() => classroomHandoff ? 'classroom-detail' : 'classrooms');
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => classroomHandoff ? requestedClassroomId : null);
  const [initialTab, setInitialTab] = useState<'tests' | undefined>(undefined);

  const handleSelectClass = (id: string) => {
    setSelectedClassId(id);
    setActiveSection('classroom-detail');
  };

  const renderContent = () => {
    if (activeSection === 'classroom-detail' && selectedClassId) {
      return <ClassroomDetail classroomId={selectedClassId} initialTab={initialTab} onBack={() => { setInitialTab(undefined); setActiveSection('classrooms'); }} />;
    }
    
    switch (activeSection) {
      case 'classrooms':
        return <ClassroomList onSelect={handleSelectClass} />;
      case 'dashboard':
        return <ClassroomList onSelect={handleSelectClass} />;
      case 'stripe':
        // Payments are temporarily disabled; fall back to the classroom list.
        return FEATURES.payments ? <StripeDashboard /> : <ClassroomList onSelect={handleSelectClass} />;
      case 'tests':
        return (
          <div className="h-full overflow-y-auto p-6 scrollbar-hide">
            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-sm text-slate-600 dark:text-slate-300">
              Tests and assignments belong to a classroom. Open a classroom and use its <strong>Tests</strong> or <strong>Assignments</strong> tab. Only students enrolled in that classroom can see them.
            </div>
            <ClassroomList onSelect={(id) => { setInitialTab('tests'); handleSelectClass(id); }} />
          </div>
        );
      case 'attendance':
        return selectedClassId ? (
          <div className="h-full overflow-y-auto p-6 scrollbar-hide">
            <AttendanceSystem classId={selectedClassId} className="Selected classroom" />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-6 scrollbar-hide">
            <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-sm text-slate-600 dark:text-slate-300">
              Choose one of your classrooms to open a teacher-authorized attendance session. Attendance is never recorded against a demo or hardcoded class.
            </div>
            <ClassroomList onSelect={handleSelectClass} />
          </div>
        );
      case 'monitoring':
      case 'proctoring':
        return (
          <div className="h-full overflow-y-auto p-6 scrollbar-hide">
            <ProctoringSystem />
          </div>
        );
      case 'reports':
        return (
          <div className="h-full overflow-y-auto p-6 scrollbar-hide">
            <AnalyticsDashboard />
          </div>
        );
      case 'settings':
        return <InstructorSettings />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest text-sm">
            {activeSection} - Work in Progress
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] min-w-0 bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white flex font-sans overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2" />
         <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <Sidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection} 
        isHovered={isSidebarHovered} 
        setHovered={setSidebarHovered} 
      />
      
      <main 
        className={`!ml-0 flex-1 min-w-0 relative z-10 pb-24 md:pb-0 transition-all duration-500 overflow-hidden bg-white/50 dark:bg-black/20 backdrop-blur-3xl border-l border-black/5 dark:border-white/10 ${isSidebarHovered ? 'md:!ml-64' : 'md:!ml-20'}`}
      >
        {renderContent()}
      </main>
    </div>
  );
};
