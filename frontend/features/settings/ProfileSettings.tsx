import React from 'react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar, Button, Card, CardHeader, ErrorState, Field, Input, RadioGroup, SkeletonText, useToast } from '../../components/ui';

type Profile = { displayname: string; mobile_number: string; email: string };

/**
 * The signed-in user's own profile row (public.users). Only display name and
 * mobile number are writable from the browser (column grants + own-row RLS).
 */
export const ProfileSettings: React.FC<{ roleLabel: string }> = ({ roleLabel }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [draft, setDraft] = React.useState<Profile | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ name?: string; phone?: string }>({});
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoadError(false);
    void (async () => {
      const { data, error } = await (supabase.from('users') as any).select('displayname,mobile_number,email').eq('uid', user.id).maybeSingle();
      if (cancelled) return;
      if (error) { setLoadError(true); return; }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const p: Profile = {
        displayname: data?.displayname || String(meta.displayname || meta.full_name || ''),
        mobile_number: data?.mobile_number || '',
        email: data?.email || user.email || '',
      };
      setProfile(p);
      setDraft(p);
    })();
    return () => { cancelled = true; };
  }, [user?.id, reload]);

  const validate = (d: Profile) => {
    const next: typeof errors = {};
    if (!d.displayname.trim()) next.name = 'Enter your name.';
    else if (d.displayname.trim().length > 80) next.name = 'Use 80 characters or fewer.';
    if (d.mobile_number && !/^\+?[0-9 ()-]{7,20}$/.test(d.mobile_number.trim())) next.phone = 'Enter a phone number using digits, spaces and an optional +.';
    return next;
  };

  const save = async () => {
    if (!draft || !user?.id) return;
    const next = validate(draft);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    const { error } = await (supabase.from('users') as any)
      .update({ displayname: draft.displayname.trim(), mobile_number: draft.mobile_number.trim() || null })
      .eq('uid', user.id);
    setSaving(false);
    if (error) { toast.error('Couldn’t save your profile. Try again.'); return; }
    setProfile(draft);
    toast.success('Profile saved.');
  };

  if (loadError) return <ErrorState title="Couldn’t load your profile" message="Check your connection and try again." onRetry={() => setReload((n) => n + 1)} />;

  const dirty = Boolean(profile && draft && (profile.displayname !== draft.displayname || profile.mobile_number !== draft.mobile_number));

  return (
    <Card as="section" aria-labelledby="profile-heading">
      <CardHeader title={<span id="profile-heading">Profile</span>} subtitle="Your name is shown to your classes." />
      {!draft ? (
        <div className="mt-4"><SkeletonText lines={4} /></div>
      ) : (
        <form className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr]" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          <div className="flex items-center gap-3 sm:flex-col sm:items-center">
            <Avatar name={draft.displayname || draft.email || 'Account'} size="xl" />
            <span className="text-meta text-ink-2">{roleLabel}</span>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name}>
              <Input value={draft.displayname} autoComplete="name" onChange={(e) => { setDraft({ ...draft, displayname: e.target.value }); if (errors.name) setErrors(validate({ ...draft, displayname: e.target.value })); }} />
            </Field>
            <Field label="Email" hint="Your sign-in email can’t be changed here.">
              <Input value={draft.email} readOnly />
            </Field>
            <Field label="Mobile number" optional error={errors.phone}>
              <Input value={draft.mobile_number} type="tel" autoComplete="tel" inputMode="tel" onChange={(e) => { setDraft({ ...draft, mobile_number: e.target.value }); if (errors.phone) setErrors(validate({ ...draft, mobile_number: e.target.value })); }} />
            </Field>
            <div className="flex items-end justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="text" disabled={!dirty || saving} onClick={() => { setDraft(profile); setErrors({}); }}>Discard changes</Button>
              <Button type="submit" loading={saving} disabled={!dirty}>Save profile</Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
};

export const AppearanceSettings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <Card as="section" aria-labelledby="appearance-heading">
      <CardHeader title={<span id="appearance-heading">Appearance</span>} subtitle="Saved on this device." />
      <div className="mt-4">
        <RadioGroup
          legend="Theme"
          name="theme"
          value={theme}
          onChange={(v) => { if (v !== theme) toggleTheme(); }}
          inline
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        />
      </div>
    </Card>
  );
};
