import React from 'react';
import { PageHeader, Card, CardHeader } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { AppearanceSettings, ProfileSettings } from '../../features/settings/ProfileSettings';

/**
 * Teacher settings: only settings that are stored and used. Test defaults such
 * as proctoring, timing and question options are set on each test.
 */
export const InstructorSettings: React.FC = () => (
  <PageBody className="max-w-4xl">
    <PageHeader title="Settings" description="Your profile and how NeuroClass looks on this device." />
    <div className="mt-6 flex flex-col gap-4">
      <ProfileSettings roleLabel="Teacher" />
      <AppearanceSettings />
      <Card as="section">
        <CardHeader title="Test and proctoring options" subtitle="Each test has its own timing, question, release and proctoring settings. Open a classroom, choose Tests, then a test’s Settings." />
      </Card>
    </div>
  </PageBody>
);
