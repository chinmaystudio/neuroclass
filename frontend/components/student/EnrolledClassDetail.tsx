import React, { useEffect, useState } from 'react';
import { ShieldCheck } from '../ui/icons-compat';
import { Breadcrumbs, Button, Card, CardHeader, ClassroomBanner, DataTable, EmptyState, Field, InfoCard, Meta, SkeletonText, StatusBadge, TabPanel, Tabs, Textarea } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../config/apiConfig';
import { StudentAttendanceModal } from './StudentAttendanceModal';
import { StudentClassroomMaterials } from './StudentClassroomMaterials';
import { StudentTestsPanel } from '../../features/tests/StudentTestsPanel';
import { StudentAssignmentsPanel } from '../../features/assignments/StudentAssignmentsPanel';

interface EnrolledClassDetailProps {
  classroom: any;
  onBack: () => void;
  onStartTest: (testId: string) => void;
}

export const EnrolledClassDetail: React.FC<EnrolledClassDetailProps> = ({
  classroom,
  onBack,
  onStartTest,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tests' | 'assignments' | 'materials' | 'attendance'>('tests');
  const [loading, setLoading] = useState(true);
  const [testCount, setTestCount] = useState<number | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealMessage, setAppealMessage] = useState('');
  const [activeAttendanceSession, setActiveAttendanceSession] = useState<any>(null);
  const [isFacePortalOpen, setIsFacePortalOpen] = useState(false);

  useEffect(() => {
    if (classroom && user) {
      fetchClassroomData();
    }
  }, [classroom, user]);

  const fetchClassroomData = async () => {
    setLoading(true);
    try {
      // Tests are loaded through the API (StudentTestsPanel); answer keys are never sent to the browser.
      // Fetch the student's enrolment for this classroom
      const { data: profile } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user!.id)
        .eq('classroom_id', classroom.id)
        .single();

      if (profile) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('classroom_id', classroom.id)
          .eq('student_id', profile.id)
          .order('verified_at', { ascending: false });

        setAttendanceLogs(attData || []);

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          const activeResponse = await fetch(`${getApiUrl('/api/attendance/active')}?classroomId=${encodeURIComponent(classroom.id)}`, {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          });
          const activePayload = await activeResponse.json().catch(() => ({}));
          if (activeResponse.ok) setActiveAttendanceSession(activePayload.session || null);
        }
      }
    } catch (e) {
      console.error('Error fetching classroom detail:', e);
    } finally {
      setLoading(false);
    }
  };

  const submitAttendanceAppeal = async () => {
    if (!user || !appealReason.trim() || attendanceLogs.length === 0) return;
    setAppealSubmitting(true);
    setAppealMessage('');
    try {
      const { error } = await (supabase.from('attendance_appeals') as any).insert({
        attendance_id: attendanceLogs[0].id,
        classroom_id: classroom.id,
        student_id: user.id,
        reason: appealReason.trim(),
      });
      if (error) throw error;
      setAppealReason('');
      setAppealMessage('Sent. Your teacher will review it.');
    } catch (error: any) {
      setAppealMessage('Couldn’t send your request. Try again.');
    } finally {
      setAppealSubmitting(false);
    }
  };

  const tabs = [
    { id: 'tests', label: 'Tests', count: testCount ?? undefined },
    { id: 'assignments', label: 'Assignments' },
    { id: 'materials', label: 'Materials' },
    { id: 'attendance', label: 'Attendance', count: attendanceLogs.length },
  ];

  return (
    <PageBody>
      <Breadcrumbs items={[{ label: 'Classes', onClick: onBack }, { label: classroom.name }]} />
      <Card padding="none" className="mt-3 overflow-hidden">
        <ClassroomBanner className="min-h-[120px]">
          <div className="flex h-full flex-col justify-end gap-1 pt-6">
            <h1 className="text-[1.75rem] font-semibold leading-9 text-white">{classroom.name}</h1>
            {classroom.subject && <p className="text-body text-white/95">{classroom.subject}</p>}
          </div>
        </ClassroomBanner>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 sm:px-6">
          <Meta>Class code <span className="font-mono font-semibold text-ink">{classroom.code}</span></Meta>
          <Meta icon={<ShieldCheck size={16} />}>Attendance is verified by your teacher</Meta>
        </div>
      </Card>

      {activeAttendanceSession && (
        <InfoCard
          className="mt-4"
          tone="success"
          title="Attendance is open now"
          action={<Button size="sm" onClick={() => setIsFacePortalOpen(true)}>Mark attendance</Button>}
        >
          Allow location access, then confirm with Face ID on this device. The server checks you’re inside the classroom area before recording it.
        </InfoCard>
      )}

      <Tabs className="mt-4" items={tabs} value={activeTab} onChange={(id) => setActiveTab(id as typeof activeTab)} label="Class sections" idPrefix="class" />

      <TabPanel tabId={activeTab} idPrefix="class" className="pt-6">
        {activeTab === 'tests' ? (
          <StudentTestsPanel classroomId={classroom.id} onCountChange={setTestCount} />
        ) : activeTab === 'assignments' ? (
          <StudentAssignmentsPanel classroomId={classroom.id} />
        ) : activeTab === 'materials' ? (
          <StudentClassroomMaterials classroomId={classroom.id} />
        ) : loading ? (
          <SkeletonText lines={4} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card padding="none">
              <div className="border-b border-line-2 px-5 py-4"><h2 className="text-card text-ink">Your attendance</h2></div>
              <DataTable
                caption={`Your attendance in ${classroom.name}`}
                rows={attendanceLogs}
                rowKey={(log: any) => log.id}
                primaryColumn="date"
                empty={<div className="p-4"><EmptyState compact title="No attendance recorded yet" body="Your teacher records attendance by opening a session for this class." /></div>}
                columns={[
                  { key: 'date', header: 'Date', cell: (log: any) => new Date(log.verified_at || log.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) },
                  { key: 'status', header: 'Status', cell: (log: any) => <StatusBadge status={String(log.status || 'present').toLowerCase()} label={log.status || 'Present'} /> },
                  { key: 'method', header: 'Verified by', cell: (log: any) => log.verified_method || 'Face ID', hideOnMobile: true },
                ]}
              />
            </Card>
            <Card as="section" aria-labelledby="appeal-heading">
              <CardHeader title={<span id="appeal-heading">Request a correction</span>} subtitle="If a session you attended was missed, tell your teacher what happened." />
              <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitAttendanceAppeal(); }}>
                <Field label="Reason" hint={attendanceLogs.length === 0 ? 'You can request a correction once a session has been recorded.' : 'Include the date and class session.'}>
                  <Textarea rows={4} value={appealReason} onChange={(event) => setAppealReason(event.target.value)} disabled={attendanceLogs.length === 0} maxLength={1000} />
                </Field>
                {appealMessage && <p role="status" className="text-support text-ink-2">{appealMessage}</p>}
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" loading={appealSubmitting} disabled={!appealReason.trim() || attendanceLogs.length === 0}>Send to teacher</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </TabPanel>

      <StudentAttendanceModal
        isOpen={isFacePortalOpen}
        classroomId={classroom.id}
        classroomName={classroom.name}
        onClose={() => setIsFacePortalOpen(false)}
        onSuccess={() => {
          setIsFacePortalOpen(false);
          fetchClassroomData();
        }}
      />
    </PageBody>
  );
};
