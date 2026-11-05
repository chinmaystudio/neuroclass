import React, { useEffect, useState } from 'react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, CardFooter, CardHeader, InfoCard, PageHeader, SkeletonText, useConfirm, useToast } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { AppearanceSettings, EmailNotificationSettings, ProfileSettings } from '../../features/settings/ProfileSettings';

interface StudentSettingsProps {
  onRegisterFaceClick: () => void;
}

export const StudentSettings: React.FC<StudentSettingsProps> = ({ onRegisterFaceClick }) => {
  const askConfirm = useConfirm();
  const toast = useToast();
  const { user } = useAuth();
  const [hasBiometric, setHasBiometric] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (user) {
      checkBiometric();
    }
  }, [user]);

  const checkBiometric = async () => {
    try {
      const { data } = await supabase
        .from('students')
        .select('face_registration_status')
        .eq('user_id', user!.id);

      const isBio = (data || []).some(s => s.face_registration_status === 'REGISTERED');
      setHasBiometric(isBio);
    } catch (e) {
      console.error('Error checking biometric:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFaceData = async () => {
    if (!user || !(await askConfirm({ title: 'Delete your Face ID data?', body: 'This removes your registered face from every classroom. You will need to register again before Face ID attendance or proctored tests.', confirmLabel: 'Delete Face ID data', tone: 'danger' }))) return;
    setClearing(true);
    try {
      // Deletes stored face embeddings and profiles for every classroom.
      const { error } = await (supabase as any).rpc('nc_clear_my_face_data');
      if (error) throw error;
      setHasBiometric(false);
      toast.success('Your Face ID data was deleted.');
    } catch (e) {
      console.error('Error clearing face data:', e);
      toast.error('Your Face ID data couldn’t be deleted. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Settings" description="Your profile, Face ID, email notifications and how NeuroClass looks on this device." />
      <div className="mt-6 flex flex-col gap-4">
        <ProfileSettings roleLabel="Student" />
        <Card as="section" aria-labelledby="faceid-heading">
          <CardHeader
            title={<span id="faceid-heading">Face ID</span>}
            subtitle="Used to confirm it’s you for attendance and proctored tests. Register once and it applies to all your classes."
          />
          <div className="mt-4">
            {loading ? (
              <SkeletonText lines={2} />
            ) : hasBiometric ? (
              <InfoCard tone="success" title="Face ID is registered">It’s used automatically in every class you’ve joined.</InfoCard>
            ) : (
              <InfoCard tone="warning" title="Face ID isn’t registered">You’ll need it before verified attendance or a proctored test.</InfoCard>
            )}
          </div>
          <CardFooter>
            {hasBiometric && <Button variant="text" className="text-danger-ink hover:bg-danger-bg" loading={clearing} onClick={() => void handleClearFaceData()}>Delete Face ID data</Button>}
            <Button onClick={onRegisterFaceClick}>{hasBiometric ? 'Register again' : 'Register Face ID'}</Button>
          </CardFooter>
        </Card>
        <EmailNotificationSettings />
        <AppearanceSettings />
      </div>
    </PageBody>
  );
};
