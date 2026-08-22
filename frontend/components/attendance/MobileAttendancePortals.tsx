import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle, LoaderCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../database/supabase';
import { AttendanceSystem } from '../ai/AttendanceSystem';
import { StudentAttendanceModal } from '../student/StudentAttendanceModal';

type AttendancePortalQuery = {
  classroomId: string | null;
  returnTo: string | null;
};

function parseAttendancePortalQuery(search: string): AttendancePortalQuery {
  const query = new URLSearchParams(search);
  const classroomId = query.get('classroomId');
  const candidate = query.get('return_to');
  if (!candidate) return { classroomId, returnTo: null };
  try {
    const target = new URL(candidate);
    return {
      classroomId,
      returnTo: target.protocol === 'neuroclass:' && target.hostname === 'attendance-return' ? target.toString() : null,
    };
  } catch {
    return { classroomId, returnTo: null };
  }
}

function useAttendanceClassroom() {
  const location = useLocation();
  const { classroomId, returnTo } = parseAttendancePortalQuery(location.search);
  const [classroomName, setClassroomName] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(classroomId));

  useEffect(() => {
    let cancelled = false;
    if (!classroomId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const { data } = await supabase
          .from('classrooms')
          .select('name')
          .eq('id', classroomId)
          .maybeSingle();
        if (!cancelled) setClassroomName(data?.name || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classroomId]);

  return { classroomId, classroomName, loading, returnTo };
}

const PortalLoading = () => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 px-6 text-center text-white">
    <div className="space-y-4">
      <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-indigo-300" />
      <p className="text-sm font-bold tracking-wide">Opening classroom attendance…</p>
    </div>
  </div>
);

const PortalError = ({ onReturn }: { onReturn: () => void }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 px-6 text-center text-white">
    <div className="max-w-sm space-y-5 rounded-3xl border border-white/10 bg-white/5 p-7">
      <AlertCircle className="mx-auto h-10 w-10 text-amber-300" />
      <div><h1 className="text-xl font-black">Attendance unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-300">This classroom attendance link is incomplete or is no longer available.</p></div>
      <button type="button" onClick={onReturn} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-950"><ArrowLeft size={15} /> Return to NeuroClass app</button>
    </div>
  </div>
);

export const MobileTeacherAttendancePortal: React.FC = () => {
  const navigate = useNavigate();
  const { classroomId, classroomName, loading, returnTo } = useAttendanceClassroom();
  const returnToApp = useCallback(() => {
    if (returnTo) window.location.assign(returnTo);
    else navigate('/teacher', { replace: true });
  }, [navigate, returnTo]);

  if (loading) return <PortalLoading />;
  if (!classroomId || !classroomName) return <PortalError onReturn={returnToApp} />;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0a0a0a] dark:text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/40 sm:px-6">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">NeuroClass attendance</p><h1 className="mt-0.5 text-base font-black">{classroomName}</h1></div>
        <button type="button" onClick={returnToApp} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white dark:bg-white dark:text-slate-900"><ArrowLeft size={14} /> Return to app</button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><AttendanceSystem classId={classroomId} className={classroomName} /></main>
    </div>
  );
};

export const MobileStudentAttendancePortal: React.FC = () => {
  const navigate = useNavigate();
  const { classroomId, classroomName, loading, returnTo } = useAttendanceClassroom();
  const returnToApp = useCallback(() => {
    if (returnTo) window.location.assign(returnTo);
    else navigate('/student', { replace: true });
  }, [navigate, returnTo]);

  if (loading) return <PortalLoading />;
  if (!classroomId || !classroomName) return <PortalError onReturn={returnToApp} />;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950">
      <button type="button" onClick={returnToApp} className="fixed left-4 top-4 z-[110] inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-950 shadow-xl"><ArrowLeft size={14} /> Return to app</button>
      <StudentAttendanceModal isOpen classroomId={classroomId} classroomName={classroomName} onClose={returnToApp} onSuccess={returnToApp} />
    </div>
  );
};
