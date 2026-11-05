import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClassroomList } from './ClassroomList';
import { ClassroomDetail } from './ClassroomDetail';
import { StripeDashboard } from './stripe/StripeDashboard';
import { InstructorSettings } from './InstructorSettings';
import { AttendanceSystem } from '../ai/AttendanceSystem';
import { ProctoringSystem } from '../ai/ProctoringSystem';
import { AnalyticsDashboard } from '../evaluation/AnalyticsDashboard';
import { FEATURES } from '../../config/features';
import { PageHeader, type NavSectionDef } from '../ui';
import { BarChart3, ClipboardList, CreditCard, Settings, ShieldCheck, UserCheck, Users } from '../ui/icons-compat';
import { RoleShell, PageBody } from '../../features/shell/RoleShell';

type Section = 'classrooms' | 'attendance' | 'tests' | 'proctoring' | 'reports' | 'settings' | 'stripe';
const SECTIONS: Section[] = ['classrooms', 'attendance', 'tests', 'proctoring', 'reports', 'settings', 'stripe'];
// Older links and nav ids that pointed at duplicate screens.
const ALIASES: Record<string, Section> = { dashboard: 'classrooms', monitoring: 'proctoring', 'classroom-detail': 'classrooms' };

export const InstructorDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const handoffClassroomId = params.get('classroomId');
  const classroomHandoff = Boolean(handoffClassroomId) && (params.get('attendance') === '1' || ['connected', 'denied', 'error'].includes(params.get('drive') || ''));

  // /teacher/<section>[/<classroomId>[/<tab>]]
  const [, , rawSection, pathId, pathTab] = location.pathname.split('/');
  const section: Section = classroomHandoff ? 'classrooms' : (SECTIONS.includes(rawSection as Section) ? rawSection as Section : ALIASES[rawSection] ?? 'classrooms');
  const classroomId = classroomHandoff ? handoffClassroomId : section === 'classrooms' || section === 'attendance' ? pathId ?? null : null;

  const go = (next: string) => navigate(`/teacher/${next}`);
  const openClassroom = (id: string, tab?: string) => navigate(`/teacher/classrooms/${id}${tab ? `/${tab}` : ''}`);

  const sections: NavSectionDef[] = [
    {
      id: 'teach',
      items: [
        { id: 'classrooms', label: 'Classrooms', icon: <Users size={20} />, href: '/teacher/classrooms' },
        { id: 'tests', label: 'Tests and assignments', icon: <ClipboardList size={20} />, href: '/teacher/tests' },
        { id: 'attendance', label: 'Attendance', icon: <UserCheck size={20} />, href: '/teacher/attendance' },
        { id: 'proctoring', label: 'Proctoring', icon: <ShieldCheck size={20} />, href: '/teacher/proctoring' },
        { id: 'reports', label: 'Analytics', icon: <BarChart3 size={20} />, href: '/teacher/reports' },
      ],
    },
    {
      id: 'account',
      items: [
        ...(FEATURES.payments ? [{ id: 'stripe', label: 'Payments', icon: <CreditCard size={20} />, href: '/teacher/stripe' }] : []),
        { id: 'settings', label: 'Settings', icon: <Settings size={20} />, href: '/teacher/settings' },
      ],
    },
  ];

  const content = (() => {
    if (section === 'classrooms' && classroomId) {
      return (
        <ClassroomDetail
          key={classroomId}
          classroomId={classroomId}
          initialTab={pathTab === 'tests' ? 'tests' : undefined}
          onBack={() => go('classrooms')}
        />
      );
    }
    switch (section) {
      case 'tests':
        return (
          <PageBody>
            <PageHeader title="Tests and assignments" description="Tests and assignments belong to a classroom. Choose a classroom to create, publish and grade its work. Only students enrolled in that classroom can see it." />
            <div className="mt-6"><ClassroomList embedded onSelect={(id) => openClassroom(id, 'tests')} /></div>
          </PageBody>
        );
      case 'attendance':
        return classroomId ? (
          <PageBody>
            <PageHeader
              breadcrumbs={[{ label: 'Attendance', onClick: () => go('attendance') }, { label: 'Session' }]}
              title="Attendance"
              description="Start a teacher-authorized session for this classroom."
            />
            <div className="mt-6"><AttendanceSystem classId={classroomId} className="Selected classroom" /></div>
          </PageBody>
        ) : (
          <PageBody>
            <PageHeader title="Attendance" description="Choose a classroom to start a verified attendance session. Attendance is only ever recorded against your real classrooms." />
            <div className="mt-6"><ClassroomList embedded onSelect={(id) => navigate(`/teacher/attendance/${id}`)} /></div>
          </PageBody>
        );
      case 'proctoring':
        return <PageBody><ProctoringSystem /></PageBody>;
      case 'reports':
        return <PageBody><AnalyticsDashboard /></PageBody>;
      case 'settings':
        return <InstructorSettings />;
      case 'stripe':
        return FEATURES.payments ? <StripeDashboard /> : <ClassroomList onSelect={(id) => openClassroom(id)} />;
      default:
        return <ClassroomList onSelect={(id) => openClassroom(id)} />;
    }
  })();

  return (
    <RoleShell roleLabel="Teacher" sections={sections} activeId={section} onNavigate={go} onOpenSettings={() => go('settings')}>
      {content}
    </RoleShell>
  );
};
