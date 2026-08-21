import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../database/supabase';
import { AlertCircle } from 'lucide-react';

interface SessionGuardianProps {
  children: React.ReactNode;
  allowedRole?: 'teacher' | 'student';
}

const MissingConfigMessage = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black px-4 py-20 overflow-y-auto">
    <div className="max-w-md w-full space-y-6 text-center bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl">
      <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
        <AlertCircle size={32} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Database Not Configured</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The Supabase credentials are missing.
        </p>
      </div>
    </div>
  </div>
);

export const SessionGuardian: React.FC<SessionGuardianProps> = ({ children, allowedRole }) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured()) {
    return <MissingConfigMessage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    // Redirect to home page with intended path in state (optional)
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // A session without a resolved role is not authorized to enter either portal.
  // This prevents a stale or tampered client-side role from granting access.
  if (!userRole) {
    return <Navigate to="/" state={{ from: location, authError: 'role_unresolved' }} replace />;
  }

  if (allowedRole && userRole !== allowedRole) {
    return <Navigate to={`/${userRole}`} replace />;
  }

  return <>{children}</>;
};
