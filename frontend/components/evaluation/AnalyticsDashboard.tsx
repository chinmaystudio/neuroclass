import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../features/lms/api';
import type { TeacherTestSummary } from '../../features/lms/types';
import { Card, CardHeader, CHART, DataTable, EmptyState, ErrorState, Field, PageHeader, ProgressBar, Select, Skeleton, StatCard, StatusBadge } from '../ui';

type Classroom = { id: string; name: string };
type Row = TeacherTestSummary & { classroomName: string; metrics: { submitted: number; average: number; passRate: number | null; pendingManualReview: number } | null; percentages: number[]; weakest: Array<{ prompt: string; averagePercent: number }> };

const BANDS = ['0–39', '40–49', '50–59', '60–69', '70–79', '80–89', '90–100'];
const band = (p: number) => (p < 40 ? 0 : p >= 90 ? 6 : Math.floor(p / 10) - 3);

/**
 * Teacher analytics, computed from real tests and attempts via the API.
 * Nothing is estimated: a test with no submissions contributes nothing.
 */
export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = React.useState<Classroom[]>([]);
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState('all');
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setError(null);
    setRows(null);
    void (async () => {
      try {
        const { data, error: dbError } = await supabase.from('classrooms').select('id,name').eq('user_id', user.id).order('created_at', { ascending: false });
        if (dbError) throw dbError;
        const rooms = (data || []) as Classroom[];
        const lists = await Promise.all(rooms.map(async (c) => ((await api.get<{ tests: TeacherTestSummary[] }>(`classrooms/${c.id}/tests`)).tests || []).map((t) => ({ ...t, classroomName: c.name }))));
        const tests = lists.flat().filter((t) => t.status !== 'draft' && t.status !== 'archived');
        const withResults = await Promise.all(tests.map(async (t): Promise<Row> => {
          if (!t.stats?.submitted) return { ...t, metrics: null, percentages: [], weakest: [] };
          const r = await api.get<any>(`tests/${t.id}/results`);
          return {
            ...t,
            metrics: r.metrics,
            percentages: (r.attempts || []).map((a: any) => a.percentage).filter((p: unknown): p is number => typeof p === 'number'),
            weakest: [...(r.perQuestion || [])].sort((a: any, b: any) => a.averagePercent - b.averagePercent).slice(0, 3),
          };
        }));
        if (cancelled) return;
        setClassrooms(rooms);
        setRows(withResults.sort((a, b) => new Date(b.scheduledStart ?? b.createdAt).getTime() - new Date(a.scheduledStart ?? a.createdAt).getTime()));
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Check your connection and try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, reload]);

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.classroomId === filter);
  const graded = shown.filter((r) => r.metrics && r.metrics.submitted > 0);
  const submissions = graded.reduce((n, r) => n + (r.metrics?.submitted ?? 0), 0);
  const allScores = graded.flatMap((r) => r.percentages);
  const average = allScores.length ? Math.round(allScores.reduce((n, p) => n + p, 0) / allScores.length) : null;
  const pending = shown.reduce((n, r) => n + (r.metrics?.pendingManualReview ?? r.stats?.pendingReview ?? 0), 0);
  const distribution = BANDS.map((name) => ({ name, students: 0 }));
  graded.forEach((r) => r.percentages.forEach((p) => { distribution[band(p)].students += 1; }));
  const hasScores = distribution.some((d) => d.students > 0);
  const weakest = graded.flatMap((r) => r.weakest.map((q) => ({ ...q, test: r.title }))).sort((a, b) => a.averagePercent - b.averagePercent).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your classes are doing on published tests. Scores include evaluated attempts only."
        actions={classrooms.length > 1 ? (
          <Field label="Classroom" hideLabel>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-w-[220px]">
              <option value="all">All classrooms</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        ) : undefined}
      />

      {error ? (
        <ErrorState className="mt-6" title="Couldn’t load analytics" message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : rows === null ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-28" rounded="card" />)}</div>
          <Skeleton className="mt-6 h-80" rounded="card" />
        </>
      ) : shown.length === 0 ? (
        <EmptyState className="mt-6" title="No published tests yet" body="Analytics appear once you publish a test and students submit it." />
      ) : (
        <>
          <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Published tests" value={shown.length} />
            <StatCard label="Submissions" value={submissions} tone="info" />
            <StatCard label="Average score" value={average === null ? '—' : `${average}%`} tone="success" hint={average === null ? 'No evaluated attempts yet' : `${allScores.length} evaluated ${allScores.length === 1 ? 'attempt' : 'attempts'}`} />
            <StatCard label="Needs grading" value={pending} tone="warning" hint={pending ? 'Open the test’s results to grade' : 'All caught up'} />
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card as="section" aria-labelledby="dist-heading">
              <CardHeader title={<span id="dist-heading">Score distribution</span>} subtitle="Evaluated attempts by percentage band." />
              {hasScores ? (
                <div className="mt-6 h-64" role="img" aria-label={`Score distribution: ${distribution.map((d) => `${d.name}%: ${d.students}`).join(', ')}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} />
                      <XAxis dataKey="name" tick={CHART.tick} stroke={CHART.grid} tickLine={false} />
                      <YAxis allowDecimals={false} tick={CHART.tick} stroke={CHART.grid} tickLine={false} />
                      <Tooltip {...CHART.tooltip} formatter={(v: any) => [v, 'Attempts']} labelFormatter={(l) => `${l}%`} />
                      <Bar dataKey="students" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="mt-4"><EmptyState compact title="No evaluated attempts yet" /></div>}
            </Card>

            <Card as="section" aria-labelledby="weak-heading">
              <CardHeader title={<span id="weak-heading">Questions to revisit</span>} subtitle="Lowest average scores across your tests." />
              {weakest.length === 0 ? <div className="mt-4"><EmptyState compact title="Nothing to show yet" body="Question scores appear once attempts are evaluated." /></div> : (
                <ul className="mt-4 flex flex-col gap-4">
                  {weakest.map((q, i) => (
                    <li key={`${q.test}-${i}`} className="min-w-0">
                      <p className="truncate text-body text-ink" title={q.prompt}>{q.prompt}</p>
                      <p className="mb-1.5 truncate text-meta text-ink-2">{q.test}</p>
                      <ProgressBar value={q.averagePercent} label={`Average score for this question`} showValue tone={q.averagePercent < 40 ? 'danger' : q.averagePercent < 70 ? 'warning' : 'success'} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card as="section" padding="none" className="mt-6" aria-labelledby="tests-heading">
            <div className="border-b border-line-2 px-5 py-4"><h2 id="tests-heading" className="text-card text-ink">Tests</h2></div>
            <DataTable
              caption="Published tests and their results"
              rows={shown}
              rowKey={(r) => `${r.classroomId}-${r.id}`}
              primaryColumn="title"
              onRowClick={(r) => navigate(`/teacher/classrooms/${r.classroomId}/tests`)}
              columns={[
                { key: 'title', header: 'Test', cell: (r) => <span className="min-w-0"><span className="block truncate font-medium text-ink">{r.title}</span><span className="block truncate text-support text-ink-2">{r.classroomName}</span></span> },
                { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.availability === 'active' ? 'active' : r.availability === 'ended' ? 'completed' : 'scheduled'} label={r.availability === 'active' ? 'Live' : r.availability === 'ended' ? 'Ended' : 'Scheduled'} /> },
                { key: 'submitted', header: 'Submitted', align: 'right', cell: (r) => <span className="tabular-nums">{r.stats?.submitted ?? 0}</span> },
                { key: 'average', header: 'Average', align: 'right', cell: (r) => <span className="tabular-nums">{r.percentages.length ? `${Math.round(r.metrics!.average)}%` : '—'}</span> },
                { key: 'pass', header: 'Pass rate', align: 'right', hideOnMobile: true, cell: (r) => <span className="tabular-nums">{r.metrics?.passRate == null ? '—' : `${r.metrics.passRate}%`}</span> },
                { key: 'grading', header: 'To grade', align: 'right', cell: (r) => <span className="tabular-nums">{r.metrics?.pendingManualReview ?? r.stats?.pendingReview ?? 0}</span> },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
};
