import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CHART, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonText, StatCard } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../features/lms/api';
import type { StudentTest } from '../../features/lms/types';

/** Only released results count; nothing is estimated or invented. */
export const StudentPerformance: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalExams: 0,
    averagePercent: 0,
    highestPercent: 0,
    awaiting: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPerformanceData();
    }
  }, [user]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { tests } = await api.get<{ tests: StudentTest[] }>('me/tests');
      const finished = tests.filter((t) => t.lastAttemptId);
      const released = finished
        .filter((t) => t.result && t.result.percentage !== null)
        .sort((a, b) => new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime());
      const formatted = released.map((t) => ({
        name: t.title,
        score: t.result!.score ?? 0,
        total: t.result!.maxScore ?? t.totalMarks,
        percentage: Math.max(0, Math.min(100, Math.round(t.result!.percentage ?? 0))),
        classroom: t.classroomName || 'Class',
      }));
      const sum = formatted.reduce((acc, r) => acc + r.percentage, 0);
      setChartData(formatted);
      setSummary({
        totalExams: finished.length,
        averagePercent: formatted.length ? Math.round(sum / formatted.length) : 0,
        highestPercent: formatted.reduce((m, r) => Math.max(m, r.percentage), 0),
        awaiting: finished.length - formatted.length,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not load your results.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageBody>
        <SkeletonText lines={2} />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-28" rounded="card" />)}</div>
        <Skeleton className="mt-6 h-80" rounded="card" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader title="Performance" description="Results your teachers have released, across all your classes." />
      {error && <ErrorState className="mt-6" title="Couldn’t load your results" message={error} onRetry={() => void fetchPerformanceData()} />}

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tests submitted" value={summary.totalExams} />
        <StatCard label="Average score" value={chartData.length ? `${summary.averagePercent}%` : '—'} tone="info" hint={chartData.length ? 'Released results' : 'No results yet'} />
        <StatCard label="Best score" value={chartData.length ? `${summary.highestPercent}%` : '—'} tone="success" />
        <StatCard label="Waiting for results" value={summary.awaiting} tone="warning" hint="Submitted, not yet released" />
      </section>

      <Card as="section" className="mt-6" aria-labelledby="scores-heading">
        <CardHeader title={<span id="scores-heading">Scores by test</span>} subtitle="Percentage score for each released result." />
        {chartData.length === 0 ? (
          <div className="mt-4"><EmptyState compact title="No released results yet" body="Your scores appear here once your teacher releases them." /></div>
        ) : (
          <div className="mt-6 h-72 w-full" role="img" aria-label={`Bar chart of your scores: ${chartData.map((d: any) => `${d.name} ${d.percentage}%`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="name" tick={CHART.tick} stroke={CHART.grid} tickLine={false} />
                <YAxis domain={[0, 100]} tick={CHART.tick} stroke={CHART.grid} tickLine={false} unit="%" />
                <Tooltip {...CHART.tooltip} formatter={(value: any) => [`${value}%`, 'Score']} />
                <Bar dataKey="percentage" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </PageBody>
  );
};
