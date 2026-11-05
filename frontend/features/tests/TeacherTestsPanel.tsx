import React, { useState } from 'react';
import { Archive, BarChart3, CalendarClock, Code2, Copy, FileText, MoreHorizontal, Pencil, Plus, Radio, ShieldCheck, Square, Trash2, Undo2 } from '../../components/ui/icons-compat';
import { api, formatDateTime } from '../lms/api';
import type { TeacherTestSummary } from '../lms/types';
import { AVAILABILITY_BADGE, Badge, Button, Card, EmptyState, ErrorNote, Spinner, useAsync } from '../lms/ui';
import { TestEditor } from './TestEditor';
import { TestResults } from './TestResults';
import { useConfirm } from '../../components/ui';

/** Classroom → Tests tab for the classroom teacher. */
export const TeacherTestsPanel: React.FC<{ classroomId: string; classroomName: string }> = ({ classroomId, classroomName }) => {
  const askConfirm = useConfirm();
  const list = useAsync(() => api.get<{ role: string; tests: TeacherTestSummary[] }>(`classrooms/${classroomId}/tests`), [classroomId]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [viewing, setViewing] = useState<{ id: string; view: 'results' | 'monitor' } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, confirm?: string) => {
    if (confirm && !(await askConfirm({ title: 'Are you sure?', body: confirm, confirmLabel: 'Continue', tone: /delete|archive/i.test(confirm) ? 'danger' : 'default' }))) return;
    setError(null); setMenu(null);
    try { await fn(); list.reload(); } catch (e) { setError((e as Error).message); }
  };

  if (editing) return <TestEditor classroomId={classroomId} testId={editing === 'new' ? null : editing} onClose={(changed) => { setEditing(null); if (changed) list.reload(); }} />;
  if (viewing) return <TestResults testId={viewing.id} initialView={viewing.view} onBack={() => { setViewing(null); list.reload(); }} />;

  const tests = list.data?.tests ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">Tests</h3>
          <p className="text-sm text-ink-2">Create, schedule and proctor tests for {classroomName}. Only enrolled students can see published tests.</p>
        </div>
        <Button onClick={() => setEditing('new')} icon={<Plus size={14} />}>New test</Button>
      </div>
      <ErrorNote message={error || list.error} onRetry={list.error ? list.reload : undefined} />
      {list.loading && !list.data ? <Spinner label="Loading tests…" /> : tests.length === 0 ? (
        <EmptyState icon={<FileText size={36} />} title="No tests yet" body="Create a draft, add questions (including coding questions), set proctoring, then publish or schedule it." action={<Button onClick={() => setEditing('new')} icon={<Plus size={14} />}>Create your first test</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((t) => {
            const badge = AVAILABILITY_BADGE[t.availability] ?? AVAILABILITY_BADGE.draft;
            return (
              <Card key={t.id} className="relative flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={badge.tone}>{badge.label}</Badge>{t.examMode === 'coding' && <Badge tone="purple"><Code2 size={11} /> Coding</Badge>}{(t.security.liveProctoring || t.security.requireIdentityVerification) && <Badge tone="blue"><ShieldCheck size={11} /> Proctored</Badge>}</div>
                    <h4 className="mt-2 truncate text-lg font-bold" title={t.title}>{t.title}</h4>
                    <p className="text-xs text-ink-2">{t.questionCount ?? 0} questions · {t.totalMarks} marks · {t.durationMinutes} min</p>
                  </div>
                  <button type="button" aria-label="More actions" onClick={() => setMenu(menu === t.id ? null : t.id)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 "><MoreHorizontal size={16} /></button>
                  {menu === t.id && (
                    <div className="absolute right-4 top-14 z-20 w-48 overflow-hidden rounded-card border border-line bg-surface text-sm shadow-raised ">
                      <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={() => void act(() => api.post(`tests/${t.id}/duplicate`, {}))} />
                      {t.status === 'published' && <MenuItem icon={<Square size={14} />} label="Close now" onClick={() => void act(() => api.post(`tests/${t.id}/close`), 'Close this test? Students in progress keep their remaining time; no new attempts can start.')} />}
                      {t.status === 'published' && !(t.stats?.submitted || t.stats?.active) && <MenuItem icon={<Undo2 size={14} />} label="Unpublish" onClick={() => void act(() => api.post(`tests/${t.id}/unpublish`))} />}
                      {t.status === 'closed' && <MenuItem icon={<Undo2 size={14} />} label="Reopen" onClick={() => void act(() => api.post(`tests/${t.id}/reopen`))} />}
                      <MenuItem icon={<Archive size={14} />} label="Archive" onClick={() => void act(() => api.post(`tests/${t.id}/archive`), 'Archive this test? It will be hidden from the list.')} />
                      {t.status === 'draft' && <MenuItem icon={<Trash2 size={14} />} label="Delete draft" danger onClick={() => void act(() => api.del(`tests/${t.id}`), 'Delete this draft permanently?')} />}
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-xs text-ink-2">
                  {t.scheduledStart && <p className="flex items-center gap-1.5"><CalendarClock size={12} /> Opens {formatDateTime(t.scheduledStart)}</p>}
                  {t.scheduledEnd && <p className="flex items-center gap-1.5"><CalendarClock size={12} /> Closes {formatDateTime(t.scheduledEnd)}</p>}
                  {t.stats && (t.stats.submitted > 0 || t.stats.active > 0) && <p>{t.stats.submitted} submitted · {t.stats.active} in progress{t.stats.pendingReview ? ` · ${t.stats.pendingReview} to grade` : ''}</p>}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(t.id)} icon={<Pencil size={13} />}>{t.status === 'draft' ? 'Edit' : 'Settings'}</Button>
                  {t.status !== 'draft' && <Button size="sm" variant="secondary" onClick={() => setViewing({ id: t.id, view: 'results' })} icon={<BarChart3 size={13} />}>Results</Button>}
                  {t.availability === 'active' && <Button size="sm" onClick={() => setViewing({ id: t.id, view: 'monitor' })} icon={<Radio size={13} />}>Monitor</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-2 ${danger ? 'text-danger-ink' : ''}`}>{icon}{label}</button>
);
