import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, buttonClasses, InfoCard, Modal, Spinner } from '../../components/ui';
import { BookOpen, GraduationCap } from '../../components/ui/icons-compat';
import { PublicPage } from '../public/PublicLayout';
import { usePageMeta } from '../public/usePageMeta';

/** Google's own mark (multicolour "G"), as Google's sign-in branding requires. */
export const GoogleMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);

/** Where Google sends people back to. Finishes sign-in, then opens the right portal. */
export const AuthCallbackPage: React.FC = () => {
  usePageMeta({ title: 'Signing you in', noindex: true });
  const { user, userRole, loading, needsRole } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const oauthError = params.get('error_description') || hash.get('error_description');
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 15_000);
    return () => window.clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!loading && user && userRole) navigate(`/${userRole}`, { replace: true });
  }, [loading, user, userRole, navigate]);

  if (oauthError || (timedOut && !user)) {
    return (
      <PublicPage title="Sign-in didn’t finish" intro={oauthError ? `Google reported: ${oauthError}` : 'We didn’t receive a session from Google. Try again, or sign in with your email and password.'}>
        <Link to="/" className={buttonClasses('primary')}>Back to the home page</Link>
      </PublicPage>
    );
  }
  if (!loading && user && !userRole && !needsRole) {
    return (
      <PublicPage title="We couldn’t open your account" intro="Your account doesn’t have a portal yet. Try signing in again; if it keeps happening, contact support.">
        <Link to="/contact" className={buttonClasses('outline')}>Contact</Link>
      </PublicPage>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas pt-16">
      <Spinner label="Signing you in…" />
    </div>
  );
};

/**
 * Shown once, after a first Google sign-in, until the person picks how they'll
 * use NeuroClass. The choice can't be changed later from the browser.
 */
export const RoleChooser: React.FC = () => {
  const { user, needsRole, chooseRole, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState<'teacher' | 'student' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  if (!user || !needsRole) return null;

  const pick = async (role: 'teacher' | 'student') => {
    setBusy(role);
    setError(null);
    try {
      const stored = await chooseRole(role);
      navigate(`/${stored}`, { replace: true });
    } catch (e) {
      setError((e as Error).message || 'That didn’t work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open
      dismissible={false}
      onClose={() => undefined}
      size="sm"
      title="How will you use NeuroClass?"
      description={<>You’re signed in as <strong className="font-semibold text-ink">{user.email}</strong>. Choose once; it can’t be changed later.</>}
      footer={<Button variant="text" onClick={() => void logout()} disabled={Boolean(busy)}>Sign out</Button>}
    >
      <div className="flex flex-col gap-3">
        {([
          { id: 'teacher' as const, title: 'I’m a teacher', body: 'Create classrooms, tests and assignments, and take attendance.', icon: <GraduationCap size={22} /> },
          { id: 'student' as const, title: 'I’m a student', body: 'Join classes with a code, take tests and submit assignments.', icon: <BookOpen size={22} /> },
        ]).map((opt) => (
          <button key={opt.id} type="button" disabled={Boolean(busy)} onClick={() => void pick(opt.id)} className="focus-ring flex items-start gap-4 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-light disabled:opacity-60">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-primary-light text-primary-dark">{opt.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-card text-ink">{opt.title}</span><span className="block text-support text-ink-2">{opt.body}</span></span>
            {busy === opt.id && <Spinner inline label="Saving" />}
          </button>
        ))}
        {error && <InfoCard tone="danger">{error}</InfoCard>}
      </div>
    </Modal>
  );
};
