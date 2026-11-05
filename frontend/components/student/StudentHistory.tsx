import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, formatDateTime } from '../../features/lms/api';
import type { StudentTest } from '../../features/lms/types';
import { useAsync } from '../../features/lms/ui';
import { Card, DataTable, EmptyState, ErrorState, PageHeader, SkeletonText, StatusBadge } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { ResultModal } from '../../features/tests/StudentTestsPanel';

/**
 * Exam history comes from the API: scores appear only after the teacher
 * releases results, and correct answers only if the teacher allows it.
 */
export const StudentHistory: React.FC = () => {
  const { user } = useAuth();
  const tests = useAsync(() => (user ? api.get<{ tests: StudentTest[] }>('me/tests') : Promise.resolve({ tests: [] })), [user?.id]);
  const [resultFor, setResultFor] = useState<string | null>(null);

  const items = useMemo(
    () => (tests.data?.tests ?? [])
      .filter((t) => t.lastAttemptId)
      .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()),
    [tests.data],
  );

  if (tests.loading && !tests.data) return <PageBody><SkeletonText lines={2} /><div className="mt-6"><SkeletonText lines={6} /></div></PageBody>;

  return (
    <PageBody className="max-w-5xl">
      <PageHeader title="History" description="Every test you’ve submitted. Scores appear once your teacher releases them." />
      {tests.error && <ErrorState className="mt-6" message={tests.error} onRetry={tests.reload} />}
      <div className="mt-6">
        {items.length === 0 && !tests.error ? (
          <EmptyState title="No submitted tests yet" body="Tests you submit will be listed here with their results." />
        ) : (
          <Card padding="none">
            <DataTable
              caption="Submitted tests"
              rows={items}
              rowKey={(item) => item.id}
              primaryColumn="title"
              onRowClick={(item) => setResultFor(item.lastAttemptId!)}
              columns={[
                { key: 'title', header: 'Test', cell: (item) => <span className="min-w-0"><span className="block truncate font-medium text-ink">{item.title}</span><span className="block truncate text-support text-ink-2">{item.classroomName ?? 'Class'}</span></span> },
                { key: 'submitted', header: 'Submitted', cell: (item) => formatDateTime(item.submittedAt), hideOnMobile: true },
                { key: 'result', header: 'Result', align: 'right', cell: (item) => item.result
                  ? <span className="tabular-nums"><span className="font-semibold text-ink">{item.result.score} / {item.result.maxScore}</span> <span className="text-ink-2">· {item.result.percentage}%</span></span>
                  : <StatusBadge status="pending" label="Waiting for results" /> },
              ]}
            />
          </Card>
        )}
      </div>
      {resultFor && <ResultModal attemptId={resultFor} onClose={() => setResultFor(null)} />}
    </PageBody>
  );
};
