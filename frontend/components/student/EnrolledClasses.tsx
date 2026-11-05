import React, { useState, useEffect } from 'react';
import { Button, ClassroomCard, EmptyState, IconPlus, PageHeader, SkeletonCard } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { EnrolledClassDetail } from './EnrolledClassDetail';

interface EnrolledClassesProps {
  onJoinClick: () => void;
  onStartTest: (testId: string) => void;
}

export const EnrolledClasses: React.FC<EnrolledClassesProps> = ({ onJoinClick, onStartTest }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<any | null>(null);

  useEffect(() => {
    const fetchEnrollments = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id,classroom_id,user_id,name,roll_number,email,joined_at,face_registration_status, classrooms(id,name,code,subject,status,students,created_at)')
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false });

        if (error) throw error;
        
        const unique = data ? Array.from(new Map(data.map((item: any) => [item.classroom_id, item])).values()) : [];
        setClasses(unique);
      } catch (err) {
        console.error('Error fetching enrollments:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEnrollments();
  }, [user]);

  if (selectedClassroom) {
    return (
      <EnrolledClassDetail
        classroom={selectedClassroom}
        onBack={() => setSelectedClassroom(null)}
        onStartTest={onStartTest}
      />
    );
  }

  const joinButton = <Button iconLeft={<IconPlus size={18} />} onClick={onJoinClick}>Join a class</Button>;

  return (
    <PageBody>
      <PageHeader title="Classes" description="Classes you’ve joined. Open one to see its tests, assignments and materials." actions={classes.length > 0 ? joinButton : undefined} />
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading classes"><SkeletonCard banner /><SkeletonCard banner /></div>
        ) : classes.length === 0 ? (
          <EmptyState title="You haven’t joined a class yet" body="Ask your teacher for the class code, then join with it." action={joinButton} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" aria-label="Your classes">
            {classes.map((enrollment: any) => {
              const cls = enrollment.classrooms || {};
              return (
                <li key={enrollment.classroom_id} className="min-w-0">
                  <ClassroomCard
                    name={cls.name || 'Class'}
                    subject={cls.subject || null}
                    code={cls.code}
                    onOpen={() => setSelectedClassroom(cls)}
                    upcoming={enrollment.joined_at ? <>Joined {new Date(enrollment.joined_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</> : undefined}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageBody>
  );
};
