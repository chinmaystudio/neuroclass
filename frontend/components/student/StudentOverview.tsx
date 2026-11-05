import React, { useEffect, useState } from 'react';
import { ActivityCard, Button, buttonClasses, Card, ClassroomBanner, EmptyState, IconClock, IconPlus, Meta, Skeleton, SkeletonCard, StatCard, StatusBadge } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../features/lms/api';
import type { StudentTest } from '../../features/lms/types';

interface StudentOverviewProps {
  onNavigate: (section: string) => void;
  onJoinClick: () => void;
  onStartTest: (testId: string) => void;
}

export const StudentOverview: React.FC<StudentOverviewProps> = ({
  onNavigate,
  onJoinClick,
  onStartTest,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    enrolledCount: 0,
    activeTestsCount: 0,
    completedTestsCount: 0,
    averageScorePercent: 0,
    biometricVerified: false,
    releasedCount: 0,
  });
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchOverviewData();
    }
  }, [user]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      // 1. Get enrollments and biometric status
      const { data: studentProfiles } = await supabase
        .from('students')
        .select('id,classroom_id,user_id,name,roll_number,email,face_registration_status,joined_at')
        .eq('user_id', user!.id);

      const isBio = (studentProfiles || []).some(s => s.face_registration_status === 'REGISTERED');
      const enrolledCount = studentProfiles ? studentProfiles.length : 0;
      // 2. Tests come from the API: only published tests from the student's own
      // classrooms, without answer keys, and scores only once the teacher releases them.
      const myTests: StudentTest[] = enrolledCount > 0 ? (await api.get<{ tests: StudentTest[] }>('me/tests')).tests : [];
      const pendingTests = myTests
        .filter((t) => t.availability === 'active' && (t.canStart || t.openAttemptId))
        .map((t) => ({ ...t, classrooms: { name: t.classroomName }, duration_mins: t.durationMinutes, questions: [] }));
      const completedResults = myTests
        .filter((t) => ['submitted', 'evaluated', 'results_published'].includes(t.myStatus))
        .map((t) => ({ id: t.lastAttemptId ?? t.id, test_id: t.id, score: t.result?.score ?? null, released: Boolean(t.result), tests: { title: t.title, total_marks: t.totalMarks }, submitted_at: null, created_at: null, percentage: t.result?.percentage ?? null }));
      const released = completedResults.filter((r) => r.released && r.percentage !== null);
      const averageScorePercent = released.length > 0
        ? Math.round(released.reduce((sum, r) => sum + Number(r.percentage), 0) / released.length)
        : 0;

      setStats({
        enrolledCount,
        activeTestsCount: pendingTests.length,
        completedTestsCount: completedResults.length,
        averageScorePercent,
        biometricVerified: isBio,
        releasedCount: released.length,
      });

      setRecentTests(pendingTests.slice(0, 3));

      // Build activity timeline
      const activities: any[] = [];
      (studentProfiles || []).forEach(sp => {
        if (sp.joined_at) {
          activities.push({
            id: `enroll-${sp.id}`,
            type: 'enrollment',
            title: 'Joined a class',
            time: new Date(sp.joined_at).toLocaleDateString(),
          });
        }
      });
      completedResults.forEach(cr => {
        activities.push({
          id: `res-${cr.id}`,
          type: 'exam',
          title: `Submitted ${cr.tests?.title || 'a test'}`,
          detail: cr.released ? `Score ${cr.score} of ${cr.tests?.total_marks ?? '—'}` : 'Waiting for results',
          time: '',
        });
      });

      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivities(activities.slice(0, 5));

    } catch (e) {
      console.error('Error fetching overview data:', e);
    } finally {
      setLoading(false);
    }
  };

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const firstName = String(meta.displayname || meta.full_name || meta.name || '').trim().split(/\s+/)[0];

  if (loading) {
    return (
      <PageBody>
        <Skeleton className="h-36 w-full" rounded="card" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-28" rounded="card" />)}</div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]"><SkeletonCard /><SkeletonCard /></div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <Card padding="none" className="overflow-hidden">
        <ClassroomBanner className="px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[1.75rem] font-semibold leading-9 text-white">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
              <p className="mt-1 max-w-xl text-body text-white/95">
                {stats.activeTestsCount > 0
                  ? `You have ${stats.activeTestsCount} ${stats.activeTestsCount === 1 ? 'test' : 'tests'} open right now.`
                  : stats.enrolledCount > 0 ? 'You’re all caught up. New tests will appear here when they open.' : 'Join a class with the code your teacher gave you to get started.'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={onJoinClick} className={buttonClasses('secondary', 'md', 'bg-white text-primary-dark hover:bg-primary-light dark:bg-white dark:text-[#174ea6]')}>
                <IconPlus size={18} /> Join a class
              </button>
            </div>
          </div>
        </ClassroomBanner>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 sm:px-8">
          {stats.biometricVerified
            ? <StatusBadge status="completed" label="Face ID registered" />
            : <span className="flex flex-wrap items-center gap-2 text-support text-ink-2"><StatusBadge status="pending" label="Face ID not registered" /> Needed for verified attendance and proctored tests. <button type="button" className="font-medium text-primary hover:underline focus-ring rounded-control" onClick={() => onNavigate('settings')}>Set it up</button></span>}
        </div>
      </Card>

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Classes" value={stats.enrolledCount} hint="Joined" />
        <StatCard label="Open tests" value={stats.activeTestsCount} tone="warning" hint="Ready to take" />
        <StatCard label="Submitted" value={stats.completedTestsCount} tone="success" hint="Tests" />
        <StatCard label="Average score" value={stats.releasedCount > 0 ? `${stats.averageScorePercent}%` : '—'} tone="info" hint={stats.releasedCount > 0 ? `From ${stats.releasedCount} released ${stats.releasedCount === 1 ? 'result' : 'results'}` : 'No results released yet'} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card as="section" padding="none" aria-labelledby="open-tests">
          <div className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-4">
            <h2 id="open-tests" className="text-card text-ink">Open tests</h2>
            <Button variant="text" size="sm" onClick={() => onNavigate('tests')}>All tests</Button>
          </div>
          {recentTests.length === 0 ? (
            <div className="p-4"><EmptyState compact title="No open tests" body="When a teacher opens a test in one of your classes, it appears here." /></div>
          ) : (
            <ul className="divide-y divide-line-2">
              {recentTests.map((test) => (
                <li key={test.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink">{test.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <Meta>{test.classrooms?.name || 'Class'}</Meta>
                      {test.duration_mins ? <Meta icon={<IconClock size={16} />}>{test.duration_mins} min</Meta> : null}
                      {typeof test.totalMarks === 'number' && <Meta>{test.totalMarks} marks</Meta>}
                    </div>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => onStartTest(test.id)}>{test.openAttemptId ? 'Resume test' : 'Start test'}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ActivityCard
          title="Recent activity"
          items={recentActivities.map((a) => ({ id: a.id, title: a.title, detail: a.detail, time: a.time, tone: a.type === 'exam' ? 'success' : 'primary' }))}
        />
      </div>
    </PageBody>
  );
};
