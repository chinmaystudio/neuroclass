import React, { useState } from 'react';
import { BookOpen, GraduationCap } from '../ui/icons-compat';
import { Button, Field, InfoCard, Input, Modal, PasswordInput } from '../ui';
import { GoogleMark } from '../../features/auth/GoogleAuth';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: 'teacher' | 'student') => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSelectRole, initialMode = 'signin' }) => {
  const { setUserRole } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);

  // Sync state if prop changes
  React.useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = (selectedRole: 'teacher' | 'student') => {
    setRole(selectedRole);
    setStep(2);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let targetRole: 'teacher' | 'student' = role || 'student';

      if (authMode === 'signin') {
        const userResult = await authService.signInWithEmail(email, password);
        // The server-backed profile role is authoritative on sign-in; the UI tab
        // cannot switch an existing account into another portal.
        targetRole = await authService.getUserRole(userResult.id);
      } else {
        await authService.signUpWithEmail(email, password, name, phone, targetRole);
      }

      setUserRole(targetRole);
      onSelectRole(targetRole);
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep(authMode === 'signup' ? 1 : 2);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setError('');
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setStep(authMode === 'signup' ? 1 : 2);
    }
  }, [isOpen, authMode]);

  const isSignup = authMode === 'signup';
  const [googleBusy, setGoogleBusy] = useState(false);
  const continueWithGoogle = async () => {
    setGoogleBusy(true);
    setError('');
    try {
      // Redirects to Google; the page comes back to /auth/callback.
      await authService.signInWithGoogle(isSignup ? role : undefined);
    } catch (err: any) {
      setError(err.message || 'Google sign-in is not available right now.');
      setGoogleBusy(false);
    }
  };
  const googleButton = (
    <>
      <Button type="button" variant="outline" size="lg" className="w-full" loading={googleBusy} iconLeft={<GoogleMark />} onClick={() => void continueWithGoogle()}>
        {isSignup ? 'Sign up with Google' : 'Continue with Google'}
      </Button>
      <div className="flex items-center gap-3 text-support text-ink-2" aria-hidden><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
    </>
  );
  const switchMode = (next: 'signin' | 'signup') => { setAuthMode(next); setError(''); setStep(next === 'signup' ? 1 : 2); };

  return (
    <Modal
      open={isOpen}
      onClose={resetState}
      size="sm"
      title={isSignup ? (step === 1 ? 'Create your account' : `Create a ${role} account`) : 'Sign in to NeuroClass'}
      description={isSignup ? (step === 1 ? 'Choose how you’ll use NeuroClass.' : 'You can update your name and phone number later in Settings.') : 'Use Google or the email and password you signed up with.'}
    >
      {isSignup && step === 1 ? (
        <div className="flex flex-col gap-3">
          {([
            { id: 'teacher' as const, title: 'I’m a teacher', body: 'Create classrooms, tests and assignments, and take attendance.', icon: <GraduationCap size={22} /> },
            { id: 'student' as const, title: 'I’m a student', body: 'Join classes with a code, take tests and submit assignments.', icon: <BookOpen size={22} /> },
          ]).map((opt) => (
            <button key={opt.id} type="button" onClick={() => handleRoleSelect(opt.id)} className="focus-ring flex items-start gap-4 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-light">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-primary-light text-primary-dark">{opt.icon}</span>
              <span className="min-w-0"><span className="block text-card text-ink">{opt.title}</span><span className="block text-support text-ink-2">{opt.body}</span></span>
            </button>
          ))}
          <p className="pt-2 text-center text-support text-ink-2">Already have an account? <button type="button" className="focus-ring rounded-control font-medium text-primary hover:underline" onClick={() => switchMode('signin')}>Sign in</button></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
          {googleButton}
          {isSignup && (
            <>
              <Field label="Full name" required><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus /></Field>
              <Field label="Mobile number" optional><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" /></Field>
            </>
          )}
          <Field label="Email" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus={!isSignup} /></Field>
          <Field label="Password" required hint={isSignup ? 'At least 6 characters.' : undefined}>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={6} />
          </Field>
          {error && <InfoCard tone="danger">{error}</InfoCard>}
          <Button type="submit" size="lg" loading={loading} className="w-full">{isSignup ? 'Create account' : 'Sign in'}</Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-support text-ink-2">
            {isSignup ? (
              <>
                <button type="button" className="focus-ring rounded-control font-medium text-primary hover:underline" onClick={() => setStep(1)}>Change account type</button>
                <span>Have an account? <button type="button" className="focus-ring rounded-control font-medium text-primary hover:underline" onClick={() => switchMode('signin')}>Sign in</button></span>
              </>
            ) : (
              <span className="w-full text-center">New to NeuroClass? <button type="button" className="focus-ring rounded-control font-medium text-primary hover:underline" onClick={() => switchMode('signup')}>Create an account</button></span>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};
