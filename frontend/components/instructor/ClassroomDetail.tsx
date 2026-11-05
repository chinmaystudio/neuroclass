import React, { useState, useEffect } from 'react';
import { Copy, ShieldCheck, Users } from '../ui/icons-compat';
import { Avatar, Breadcrumbs, Button, buttonClasses, Card, CardFooter, CardHeader, ClassroomBanner, DataTable, EmptyState, ErrorState, Meta, SearchInput, Skeleton, SkeletonText, StatusBadge, TabPanel, Tabs, useToast } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { supabase } from '../../database/supabase';
import { AttendanceSystem } from '../ai/AttendanceSystem';
import { ClassroomMaterialsPanel } from './ClassroomMaterialsPanel';
import { ClassroomLearningAnalytics } from './ClassroomLearningAnalytics';
import { useLocation } from 'react-router-dom';
import { TeacherTestsPanel } from '../../features/tests/TeacherTestsPanel';
import { TeacherAssignmentsPanel } from '../../features/assignments/TeacherAssignmentsPanel';

type Tab = 'students' | 'tests' | 'assignments' | 'materials' | 'attendance' | 'proctoring' | 'settings';

interface ClassroomDetailProps {
  classroomId: string;
  onBack: () => void;
  initialTab?: Tab;
}

export const ClassroomDetail: React.FC<ClassroomDetailProps> = ({ classroomId, onBack, initialTab }) => {
  const location = useLocation();
  const handoff = new URLSearchParams(location.search);
  const returnTo = handoff.get('return_to');
  const hasReturnToApp = returnTo?.startsWith('neuroclass://attendance-return') === true;
  const [classroom, setClassroom] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(() => initialTab ?? (handoff.get('attendance') === '1' ? 'attendance' : handoff.get('drive') ? 'materials' : 'students'));

  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchDetails = async () => {
      setLoadError(null);
      const { data, error } = await supabase.from('classrooms').select('*').eq('id', classroomId).maybeSingle();
      const { data: roster } = await (supabase.from('students') as any).select('id,name,email,roll_number,face_registration_status').eq('classroom_id', classroomId).order('name');
      if (cancelled) return;
      if (error || !data) { setLoadError(error ? 'Check your connection and try again.' : 'This classroom doesn’t exist or you don’t have access to it.'); return; }
      setClassroom(data);
      setStudents(roster || []);
    };
    void fetchDetails();
    return () => { cancelled = true; };
  }, [classroomId, reload]);

  const [query, setQuery] = useState('');
  const toast = useToast();

  if (loadError) return <PageBody><ErrorState title="Couldn’t open this classroom" message={loadError} onRetry={() => setReload((n) => n + 1)} /></PageBody>;
  if (!classroom) return (
    <PageBody>
      <Skeleton className="h-32 w-full" rounded="card" />
      <div className="mt-6"><SkeletonText lines={4} /></div>
    </PageBody>
  );

  // Tests and assignments are native NeuroClass modules (the separate
  // test_creation portal and its iframe handoff are no longer used).
  const biometricReady = students.filter((s) => s.face_registration_status === 'REGISTERED').length;
  const tabs = [
    { id: 'students', label: 'Students', count: students.length },
    { id: 'tests', label: 'Tests' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'materials', label: 'Materials' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'proctoring', label: 'Proctoring' },
    { id: 'settings', label: 'Settings' },
  ];
  const copyCode = () => void navigator.clipboard?.writeText(classroom.code).then(() => toast.success('Class code copied.'), () => toast.error('Couldn’t copy the code.'));
  const shown = students.filter((st) => !query.trim() || `${st.name} ${st.email ?? ''} ${st.roll_number ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <PageBody>
      <Breadcrumbs items={[{ label: 'Classrooms', onClick: onBack }, { label: classroom.name }]} />
      <Card padding="none" className="mt-3 overflow-hidden">
        <ClassroomBanner className="min-h-[120px] sm:min-h-[140px]">
          <div className="flex h-full flex-col justify-end gap-1 pt-6">
            <h1 className="text-[1.75rem] font-semibold leading-9 text-white">{classroom.name}</h1>
            {classroom.subject && <p className="text-body text-white/95">{classroom.subject}</p>}
          </div>
        </ClassroomBanner>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Meta icon={<Users size={16} />}>{students.length} {students.length === 1 ? 'student' : 'students'}</Meta>
            <Meta icon={<ShieldCheck size={16} />}>{biometricReady} with Face ID</Meta>
            <Meta>Class code <span className="font-mono font-semibold text-ink">{classroom.code}</span></Meta>
          </div>
          <Button variant="outline" size="sm" iconLeft={<Copy size={16} />} onClick={copyCode}>Copy class code</Button>
        </div>
      </Card>

      <Tabs className="mt-4" items={tabs} value={activeTab} onChange={(id) => setActiveTab(id as Tab)} label="Classroom sections" idPrefix="classroom" />

      <TabPanel tabId={activeTab} idPrefix="classroom" className="pt-6">
        {activeTab === 'students' && (
          <Card padding="none">
            <div className="flex flex-col gap-3 border-b border-line-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-card text-ink">Students</h2>
                <p className="text-support text-ink-2">Students join with the class code. Face ID is needed for verified attendance and proctored tests.</p>
              </div>
              {students.length > 6 && <div className="sm:w-64"><SearchInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} placeholder="Search students" aria-label="Search students" /></div>}
            </div>
            <DataTable
              caption={`Students in ${classroom.name}`}
              rows={shown}
              rowKey={(st: any) => st.id}
              primaryColumn="name"
              empty={<div className="p-4"><EmptyState compact title={students.length ? 'No students match your search' : 'No students yet'} body={students.length ? undefined : <>Share the class code <span className="font-mono font-semibold text-ink">{classroom.code}</span> with your students.</>} action={students.length ? undefined : <Button variant="outline" size="sm" onClick={copyCode}>Copy class code</Button>} /></div>}
              columns={[
                { key: 'name', header: 'Name', cell: (st: any) => <span className="flex items-center gap-3"><Avatar name={st.name || 'Student'} size="sm" /><span className="min-w-0"><span className="block truncate font-medium text-ink">{st.name}</span><span className="block truncate text-support text-ink-2 sm:hidden">{st.email}</span></span></span> },
                { key: 'email', header: 'Email', cell: (st: any) => st.email || <span className="text-ink-3">No email</span>, hideOnMobile: true },
                { key: 'roll', header: 'Roll number', cell: (st: any) => st.roll_number || '—' },
                { key: 'face', header: 'Face ID', cell: (st: any) => st.face_registration_status === 'REGISTERED' ? <StatusBadge status="completed" label="Registered" /> : <StatusBadge status="pending" label="Not registered" /> },
              ]}
            />
          </Card>
        )}

        {activeTab === 'tests' && <TeacherTestsPanel classroomId={classroom.id} classroomName={classroom.name} />}

        {activeTab === 'assignments' && <TeacherAssignmentsPanel classroomId={classroom.id} classroomName={classroom.name} />}

        {activeTab === 'materials' && (
          <div className="space-y-6"><ClassroomMaterialsPanel classroomId={classroom.id} /><ClassroomLearningAnalytics classroomId={classroom.id} /></div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {hasReturnToApp && <a href={returnTo!} className={buttonClasses('outline')}>Return to the NeuroClass app</a>}
            <AttendanceSystem classId={classroom.id} className={classroom.name} />
          </div>
        )}

        {activeTab === 'proctoring' && (
          <Card>
            <CardHeader title="Exam proctoring" subtitle="Proctoring is set for each test under Security and proctoring." />
            <div className="mt-3 space-y-3 text-body text-ink-2">
              <p>During a live test, choose <strong className="font-semibold text-ink">Monitor</strong> on the test to see who is taking it, their camera and identity status, and any warnings. After the test, each attempt has a proctoring timeline you can review, dismiss or flag.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Identity is checked against each student’s registered Face ID ({biometricReady} of {students.length} students registered).</li>
                <li>Face presence, head pose and gaze are analysed on the student’s device; only numeric signals reach the server.</li>
                <li>Signals help you review. Students are never failed automatically, and they can appeal.</li>
              </ul>
            </div>
            <CardFooter><Button onClick={() => setActiveTab('tests')}>Go to tests</Button></CardFooter>
          </Card>
        )}

        {activeTab === 'settings' && (
          <Card>
            <CardHeader title="Class code" subtitle="Share this code so students can join. Tests and assignments are only visible to enrolled students." />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-control border border-line bg-surface-2 px-4 py-2 font-mono text-[1.25rem] font-semibold tracking-wide text-ink">{classroom.code}</span>
              <Button variant="outline" iconLeft={<Copy size={16} />} onClick={copyCode}>Copy</Button>
            </div>
          </Card>
        )}
      </TabPanel>
    </PageBody>
  );
};
