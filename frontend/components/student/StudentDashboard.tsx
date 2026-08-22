import React, { useEffect, useState } from 'react';
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
import { StudentAttendanceModal } from './StudentAttendanceModal';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/apiConfig';
import { Bell } from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [isJoinWizardOpen, setJoinWizardOpen] = useState(false);
    const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [attendanceAlert, setAttendanceAlert] = useState<{ sessionId: string; classroomId: string; classroomName: string; sessionCode?: string } | null>(null);
  const [isAttendancePortalOpen, setIsAttendancePortalOpen] = useState(false);
  const [attendancePortal, setAttendancePortal] = useState<{ sessionId: string; classroomId: string; classroomName: string; sessionCode?: string } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const subscribeToAttendanceAnnouncements = async () => {
      const { data: enrollments, error } = await supabase
        .from('students')
        .select('classroom_id')
        .eq('user_id', user.id)
        .limit(100);
      if (cancelled || error || !enrollments?.length) return;

      const classroomIds = [...new Set(enrollments.map((enrollment: any) => enrollment.classroom_id).filter(Boolean))];
      if (!classroomIds.length) return;
      const { data: classrooms } = await supabase.from('classrooms').select('id,name').in('id', classroomIds).limit(100);
      const classroomMap = new Map<string, string>((classrooms || []).map((classroom: any) => [classroom.id, classroom.name || 'your classroom']));

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const activeSessions = await Promise.all(classroomIds.map(async (classroomId) => {
          const response = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
          const payload = await response.json().catch(() => ({}));
          return payload.session ? { ...payload.session, classroomId } : null;
        }));
        const alreadyActive = activeSessions.find(Boolean) as any;
        if (!cancelled && alreadyActive) {
          setAttendanceAlert({ sessionId: alreadyActive.id, classroomId: alreadyActive.classroomId, classroomName: classroomMap.get(alreadyActive.classroomId) || 'your classroom', sessionCode: alreadyActive.session_code });
        }
      }

      channel = supabase
        .channel(`student-attendance-announcements-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'attendance_session_announcements' },
          (payload) => {
            const announcement: any = payload.new;
            if (announcement.event_type !== 'attendance_started' || !classroomMap.has(announcement.classroom_id)) return;
            setAttendanceAlert({
              sessionId: announcement.attendance_session_id,
              classroomId: announcement.classroom_id,
              classroomName: classroomMap.get(announcement.classroom_id) || 'your classroom',
              sessionCode: announcement.session_code,
            });
          },
        )
        .subscribe();
    };

    void subscribeToAttendanceAnnouncements();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user?.id]);

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

      {attendanceAlert && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center bg-black/40 p-4 pt-20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-purple-200 bg-white p-6 shadow-2xl dark:border-purple-500/20 dark:bg-[#121212]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-purple-500/10 p-3 text-purple-500"><Bell size={20} /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500">Attendance Verification</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Your teacher started attendance</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">Verify your presence now for <span className="font-bold">{attendanceAlert.classroomName}</span>. You will need to allow location and complete Face ID on your own device.</p>
                {attendanceAlert.sessionCode && <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-widest text-purple-500">Session: {attendanceAlert.sessionCode}</p>}
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setAttendanceAlert(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:bg-white/10 dark:text-slate-300">Later</button>
              <button type="button" onClick={() => { setAttendancePortal(attendanceAlert); setIsAttendancePortalOpen(true); setAttendanceAlert(null); }} className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white">Verify Attendance</button>
            </div>
          </div>
        </div>
      )}

      {isAttendancePortalOpen && attendancePortal && (
        <StudentAttendanceModal
          isOpen={isAttendancePortalOpen}
          classroomId={attendancePortal.classroomId}
          classroomName={attendancePortal.classroomName}
          onClose={() => { setIsAttendancePortalOpen(false); setAttendancePortal(null); }}
          onSuccess={() => { setIsAttendancePortalOpen(false); setAttendancePortal(null); }}
        />
      )}

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
