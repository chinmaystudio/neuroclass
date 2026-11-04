import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, FileText, Hourglass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, formatDateTime } from '../../features/lms/api';
import type { StudentTest } from '../../features/lms/types';
import { useAsync, Spinner, ErrorNote } from '../../features/lms/ui';
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

  if (tests.loading && !tests.data) return <div className="p-8"><Spinner label="Loading your exam history…" /></div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Clock className="text-purple-500" size={30} /> Exam History
        </h1>
        <p className="text-slate-500 text-sm mt-1">Every test you have submitted. Scores appear once your teacher releases them.</p>
      </div>

      <ErrorNote message={tests.error} onRetry={tests.reload} />

      {items.length === 0 && !tests.error ? (
        <div className="py-16 flex flex-col items-center justify-center border border-dashed border-black/10 dark:border-white/10 rounded-3xl text-slate-400 text-sm">
          <FileText size={40} className="mb-2 opacity-50" />
          You haven’t submitted any tests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setResultFor(item.lastAttemptId!)}
              className="w-full text-left bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-400 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-purple-500">{item.classroomName ?? 'Classroom'}</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{item.title}</h3>
                <p className="text-xs text-slate-400">Submitted {formatDateTime(item.submittedAt)}</p>
              </div>
              {item.result ? (
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{item.result.score} / {item.result.maxScore}</p>
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle2 size={14} /> {item.result.percentage}%</p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-amber-600 flex items-center gap-1.5 shrink-0"><Hourglass size={16} /> Awaiting results</p>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {resultFor && <ResultModal attemptId={resultFor} onClose={() => setResultFor(null)} />}
    </div>
  );
};
