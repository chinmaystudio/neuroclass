import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../database/supabase';
import { AlertCircle } from '../ui/icons-compat';

interface SessionGuardianProps {
  children: React.ReactNode;
  allowedRole?: 'teacher' | 'student';
}

const MissingConfigMessage = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-2 px-4 py-20 overflow-y-auto">
    <div className="max-w-md w-full space-y-6 text-center bg-surface p-8 rounded-card border border-line shadow-raised">
      <div className="w-16 h-16 bg-warning-bg text-warning-ink rounded-card flex items-center justify-center mx-auto">
        <AlertCircle size={32} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-ink ">Database Not Configured</h2>
        <p className="text-xs text-ink-2 leading-relaxed">
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
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-soft border-t-primary rounded-full animate-spin" />
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
