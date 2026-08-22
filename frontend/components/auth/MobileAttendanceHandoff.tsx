import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../database/supabase';

const isRole = (value: string | null): value is 'teacher' | 'student' => value === 'teacher' || value === 'student';

export const MobileAttendanceHandoff: React.FC = () => {
  const location = useLocation();
  const [message, setMessage] = useState('Securing your attendance session…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const query = new URLSearchParams(location.search);
      const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
      const role = query.get('role');
      const classroomId = query.get('classroomId');
      const returnTo = query.get('return_to');
      const tokenHash = fragment.get('token_hash');
      if (!isRole(role) || !classroomId || !returnTo || !tokenHash) {
        if (!cancelled) setMessage('This attendance link is incomplete or has expired. Return to the NeuroClass app and try again.');
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (error) {
        if (!cancelled) setMessage('This secure attendance link has expired or was already used. Return to the NeuroClass app and open attendance again.');
        return;
      }
      const target = new URL(`/attendance/${role}`, window.location.origin);
      target.searchParams.set('classroomId', classroomId);
      target.searchParams.set('return_to', returnTo);
      window.location.replace(target.toString());
    })();
    return () => { cancelled = true; };
  }, [location.hash, location.search]);

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 px-6 text-center text-white"><div className="max-w-sm space-y-4"><div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-300/30 border-t-indigo-300" /><h1 className="text-xl font-black">Opening attendance</h1><p className="text-sm leading-6 text-slate-300">{message}</p></div></div>;
};
