import React, { Suspense, lazy, useEffect, useState } from 'react';
import { EnrolledClasses } from './EnrolledClasses';
import { JoinClassWizard } from './JoinClassWizard';
import { StudentTestsPanel } from '../../features/tests/StudentTestsPanel';
import { StudentOverview } from './StudentOverview';
import { StudentPerformance } from './StudentPerformance';
import { StudentHistory } from './StudentHistory';
import { StudentSettings } from './StudentSettings';
import { IntegrationsPage } from '../../features/integrations/IntegrationsPage';
import { ProjectAdvisor } from './ProjectAdvisor';
import { ClassroomLearningBot } from './ClassroomLearningBot';
import { StudentAttendanceModal } from './StudentAttendanceModal';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/apiConfig';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, Clock, FileText, LayoutDashboard, Lightbulb, MessageCircle, Settings } from '../ui/icons-compat';
import { Button, buttonClasses, Modal, PageHeader, Spinner, type NavSectionDef } from '../ui';
import { RoleShell, PageBody } from '../../features/shell/RoleShell';

type Section = 'dashboard' | 'classes' | 'tests' | 'performance' | 'history' | 'project-advisor' | 'learning-bot' | 'settings' | 'integrations';
const SECTIONS: Section[] = ['dashboard', 'classes', 'tests', 'performance', 'history', 'project-advisor', 'learning-bot', 'settings', 'integrations'];

// The secure exam is code-split: it pulls in the camera/vision and IDE bundles.
const SecureExam = lazy(() => import('../../features/exam/SecureExam'));

export const StudentDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const rawSection = location.pathname.split('/')[2] as Section;
  const activeSection: Section = SECTIONS.includes(rawSection) ? rawSection : 'dashboard';
  const setActiveSection = (next: string) => navigate(`/student/${next === 'dashboard' ? '' : next}${location.search}`);
  const [isJoinWizardOpen, setJoinWizardOpen] = useState(false);
    const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [attendanceAlert, setAttendanceAlert] = useState<{ sessionId: string; classroomId: string; classroomName: string; sessionCode?: string; radiusMeters?: number } | null>(null);
  const [isAttendancePortalOpen, setIsAttendancePortalOpen] = useState(false);
  const [attendancePortal, setAttendancePortal] = useState<{ sessionId: string; classroomId: string; classroomName: string; sessionCode?: string; radiusMeters?: number } | null>(null);
  const { user } = useAuth();

  const handoffParams = new URLSearchParams(location.search);
  const handoffClassroomId = handoffParams.get('attendance') === '1' ? handoffParams.get('classroomId') : null;
  const returnTo = handoffParams.get('return_to');
  const hasReturnToApp = returnTo?.startsWith('neuroclass://attendance-return') === true;

  useEffect(() => {
    if (!user?.id || !handoffClassroomId) return;
    let cancelled = false;
    void (async () => {
      const [{ data: authData }, { data: classroom }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('classrooms').select('name').eq('id', handoffClassroomId).maybeSingle(),
      ]);
      const token = authData.session?.access_token;
      if (!token || cancelled) return;
      const response = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(handoffClassroomId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (cancelled || !payload.session) return;
      const portal = { sessionId: payload.session.id, classroomId: handoffClassroomId, classroomName: classroom?.name || 'your classroom', sessionCode: payload.session.session_code, radiusMeters: payload.session.radius_meters };
      setAttendancePortal(portal);
      setIsAttendancePortalOpen(true);
    })();
    return () => { cancelled = true; };
  }, [handoffClassroomId, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: number | null = null;
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
          setAttendanceAlert({ sessionId: alreadyActive.id, classroomId: alreadyActive.classroomId, classroomName: classroomMap.get(alreadyActive.classroomId) || 'your classroom', sessionCode: alreadyActive.session_code, radiusMeters: alreadyActive.radius_meters });
        }
      }

      const pollForActiveAttendance = async () => {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession?.access_token || cancelled) return;
        const activeSessions = await Promise.all(classroomIds.map(async (classroomId) => {
          const response = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(classroomId)}`, { headers: { Authorization: `Bearer ${authSession.access_token}` } });
          const payload = await response.json().catch(() => ({}));
          return payload.session ? { ...payload.session, classroomId } : null;
        }));
        const active = activeSessions.find(Boolean) as any;
        if (!cancelled && active) setAttendanceAlert({ sessionId: active.id, classroomId: active.classroomId, classroomName: classroomMap.get(active.classroomId) || 'your classroom', sessionCode: active.session_code, radiusMeters: active.radius_meters });
      };
      pollTimer = window.setInterval(() => void pollForActiveAttendance(), 15000);

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
              radiusMeters: announcement.radius_meters,
            });
          },
        )
        .subscribe();
    };

    void subscribeToAttendanceAnnouncements();
    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
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
        return (
          <PageBody>
            <PageHeader title="Tests" description="Tests from every classroom you have joined. Only tests your teachers have published appear here." />
            <div className="mt-6"><StudentTestsPanel /></div>
          </PageBody>
        );
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
      case 'integrations':
        return <IntegrationsPage />;
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

  const sections: NavSectionDef[] = [
    {
      id: 'learn',
      items: [
        { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} />, href: '/student' },
        { id: 'classes', label: 'Classes', icon: <BookOpen size={20} />, href: '/student/classes' },
        { id: 'tests', label: 'Tests', icon: <FileText size={20} />, href: '/student/tests' },
        { id: 'performance', label: 'Performance', icon: <BarChart3 size={20} />, href: '/student/performance' },
        { id: 'history', label: 'History', icon: <Clock size={20} />, href: '/student/history' },
      ],
    },
    {
      id: 'help',
      label: 'Study help',
      items: [
        { id: 'project-advisor', label: 'Project advisor', icon: <Lightbulb size={20} />, href: '/student/project-advisor' },
        { id: 'learning-bot', label: 'Class assistant', icon: <MessageCircle size={20} />, href: '/student/learning-bot' },
      ],
    },
    { id: 'account', items: [{ id: 'settings', label: 'Settings', icon: <Settings size={20} />, href: '/student/settings' }] },
  ];

  return (
    <RoleShell roleLabel="Student" sections={sections} activeId={activeSection} onNavigate={setActiveSection} onOpenSettings={() => setActiveSection('settings')}>
      {hasReturnToApp && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
          <a href={returnTo!} className={buttonClasses('outline', 'sm')}>Return to the NeuroClass app</a>
        </div>
      )}
      {renderContent()}

      <Modal
        open={Boolean(attendanceAlert)}
        onClose={() => setAttendanceAlert(null)}
        title="Your teacher started attendance"
        description={attendanceAlert ? <>Confirm you’re present for <strong className="font-semibold text-ink">{attendanceAlert.classroomName}</strong>. You’ll need to allow location access and complete Face ID on this device.</> : undefined}
        footer={
          <>
            <Button variant="text" onClick={() => setAttendanceAlert(null)}>Later</Button>
            <Button onClick={() => { setAttendancePortal(attendanceAlert); setIsAttendancePortalOpen(true); setAttendanceAlert(null); }}>Mark attendance</Button>
          </>
        }
      >
        {attendanceAlert?.sessionCode && <p className="text-support text-ink-2">Session code <span className="font-mono font-semibold text-ink">{attendanceAlert.sessionCode}</span></p>}
      </Modal>

      {isAttendancePortalOpen && attendancePortal && (
        <StudentAttendanceModal
          isOpen={isAttendancePortalOpen}
          classroomId={attendancePortal.classroomId}
          classroomName={attendancePortal.classroomName}
          sessionId={attendancePortal.sessionId}
          sessionCode={attendancePortal.sessionCode}
          radiusMeters={attendancePortal.radiusMeters}
          onClose={() => { setIsAttendancePortalOpen(false); setAttendancePortal(null); }}
          onSuccess={() => { setIsAttendancePortalOpen(false); setAttendancePortal(null); }}
        />
      )}

      <JoinClassWizard
        isOpen={isJoinWizardOpen}
        onClose={() => setJoinWizardOpen(false)}
        onSuccess={() => setActiveSection('classes')}
      />

      {activeTestId && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-canvas"><Spinner label="Opening the test…" /></div>}>
          <SecureExam
            testId={activeTestId}
            onExit={() => {
              setActiveTestId(null);
              setActiveSection('tests');
            }}
          />
        </Suspense>
      )}
    </RoleShell>
  );
};
