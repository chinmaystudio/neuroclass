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

export const InstructorDashboard: React.FC = () => {
  const location = useLocation();
  const requestedClassroomId = new URLSearchParams(location.search).get('classroomId');
  const attendanceHandoff = new URLSearchParams(location.search).get('attendance') === '1' && Boolean(requestedClassroomId);
  const [activeSection, setActiveSection] = useState(() => attendanceHandoff ? 'classroom-detail' : 'classrooms');
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => attendanceHandoff ? requestedClassroomId : null);

  const handleSelectClass = (id: string) => {
    setSelectedClassId(id);
    setActiveSection('classroom-detail');
  };

  const renderContent = () => {
    if (activeSection === 'classroom-detail' && selectedClassId) {
      return <ClassroomDetail classroomId={selectedClassId} onBack={() => setActiveSection('classrooms')} />;
    }
    
    switch (activeSection) {
      case 'classrooms':
        return <ClassroomList onSelect={handleSelectClass} />;
      case 'dashboard':
        return <ClassroomList onSelect={handleSelectClass} />;
      case 'stripe':
        return <StripeDashboard />;
      case 'tests':
        return (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl border border-black/5 dark:border-white/10 shadow-2xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">Advanced Test Portal</h4>
                <p className="mt-2 text-sm text-slate-500">
                  The test designer is now hosted on its own dedicated high-performance infrastructure.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('classrooms')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-500/30"
              >
                Open a Classroom to Design Tests
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="m13 6 6 6-6 6"/></svg>
              </button>
            </div>
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
