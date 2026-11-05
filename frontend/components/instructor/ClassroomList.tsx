import React, { useState, useEffect } from 'react';
import { supabase } from '../../database/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button, ClassroomCard, Dropdown, EmptyState, Field, IconButton, IconMore, IconPlus, Input, Modal, PageHeader, SearchInput, SkeletonCard, StatusBadge, useConfirm, useToast } from '../ui';
import { PageBody } from '../../features/shell/RoleShell';

export const ClassroomList: React.FC<{ onSelect: (id: string) => void; embedded?: boolean }> = ({ onSelect, embedded }) => {
  const [query, setQuery] = useState('');
  const askConfirm = useConfirm();
  const toast = useToast();
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClassrooms = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Count roster rows by id only: legacy face columns on `students` are not
      // readable from the browser, so an embedded count(students.*) is refused.
      const ids = (data || []).map((cls: any) => cls.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: roster, error: rosterError } = await (supabase.from('students') as any)
          .select('id,classroom_id')
          .in('classroom_id', ids)
          .range(0, 9999);
        if (rosterError) throw rosterError;
        (roster || []).forEach((r: { classroom_id: string }) => counts.set(r.classroom_id, (counts.get(r.classroom_id) || 0) + 1));
      }

      const enrichedData = (data || []).map((cls: any) => ({
        ...cls,
        students: counts.get(cls.id) || 0
      }));
      
      setClassrooms(enrichedData);
    } catch (err) {
      console.error('Error fetching classrooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, [user]);

  const handleDeleteClass = async (classId: string) => {
    const target = classrooms.find((c: any) => c.id === classId);
    const ok = await askConfirm({
      title: `Delete ${target?.name ?? 'this classroom'}?`,
      body: 'All of its tests, assignments, students and attendance records will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete classroom',
      tone: 'danger',
      requireText: target?.name,
    });
    if (!ok) return;
    
    try {
      const { getApiUrl } = await import('../../config/apiConfig');
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(getApiUrl('/api/classrooms/delete'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ classroom_id: classId })
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Failed to delete classroom');
      }
      
      fetchClassrooms();
      toast.success(`${target?.name ?? 'Classroom'} was deleted.`);
    } catch (err: any) {
      console.error('Error deleting classroom:', err);
      toast.error(`Couldn’t delete the classroom: ${err.message}`);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !user) return;
    setIsCreating(true);
    setError(null);
    
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const classroomData = {
        name: newClassName.trim(),
        code: code,
        students: 0,
        attendance: '0%',
        status: 'Active',
        user_id: user.id
      };

      const { data, error } = await supabase.from('classrooms').insert(classroomData).select();
      
      if (error) throw error;
      
      setCreateModalOpen(false);
      setNewClassName('');
      fetchClassrooms();
      toast.success(`${classroomData.name} was created. Class code ${code}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to create classroom.');
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = classrooms.filter((c: any) => !query.trim() || `${c.name} ${c.code}`.toLowerCase().includes(query.trim().toLowerCase()));

  const createDialog = (
    <Modal
      open={isCreateModalOpen}
      onClose={() => { if (!isCreating) { setCreateModalOpen(false); setError(null); } }}
      title="Create a classroom"
      description="Students join with the class code that is generated for it."
      footer={
        <>
          <Button variant="text" onClick={() => { setCreateModalOpen(false); setError(null); }} disabled={isCreating}>Cancel</Button>
          <Button onClick={() => void handleCreateClass()} loading={isCreating} disabled={!newClassName.trim()}>Create classroom</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void handleCreateClass(); }}>
        <Field label="Classroom name" required error={error ?? undefined} hint="For example, Computer Engineering A4.">
          <Input autoFocus value={newClassName} onChange={(e) => setNewClassName(e.target.value)} maxLength={120} />
        </Field>
      </form>
    </Modal>
  );

  const createButton = <Button iconLeft={<IconPlus size={18} />} onClick={() => setCreateModalOpen(true)}>Create classroom</Button>;

  const body = loading ? (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading classrooms">
      <SkeletonCard banner /><SkeletonCard banner />
    </div>
  ) : classrooms.length === 0 ? (
    <EmptyState title="No classrooms yet" body="Create a classroom, then share its class code so students can join." action={createButton} />
  ) : (
    <>
      {classrooms.length > 4 && (
        <div className="mb-4 max-w-sm">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} placeholder="Search classrooms" aria-label="Search classrooms" />
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState compact title="No classrooms match your search" action={<Button variant="text" onClick={() => setQuery('')}>Clear search</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Classrooms">
          {filtered.map((cls: any) => (
            <li key={cls.id} className="min-w-0">
              <ClassroomCard
                name={cls.name}
                subject={cls.subject || null}
                code={cls.code}
                studentCount={cls.students || 0}
                onOpen={() => onSelect(cls.id)}
                upcoming={cls.status && cls.status !== 'Active' ? <StatusBadge status={String(cls.status).toLowerCase()} label={cls.status} /> : undefined}
                actions={
                  <Dropdown
                    label={`Actions for ${cls.name}`}
                    items={[
                      { id: 'open', label: 'Open classroom', onSelect: () => onSelect(cls.id) },
                      { id: 'copy', label: 'Copy class code', onSelect: () => { void navigator.clipboard?.writeText(cls.code).then(() => toast.success('Class code copied.'), () => toast.error('Couldn’t copy the code.')); } },
                      { id: 'delete', label: 'Delete classroom', danger: true, separatorBefore: true, onSelect: () => void handleDeleteClass(cls.id) },
                    ]}
                    trigger={(props) => <IconButton {...props} label={`More actions for ${cls.name}`} icon={<IconMore size={20} />} size="sm" />}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (embedded) return <div className="min-w-0">{body}{createDialog}</div>;

  return (
    <PageBody>
      <PageHeader
        title="Classrooms"
        description={classrooms.length ? `${classrooms.length} ${classrooms.length === 1 ? 'classroom' : 'classrooms'} · ${classrooms.reduce((n: number, c: any) => n + (c.students || 0), 0)} students` : 'Your classes, their students and their work.'}
        actions={classrooms.length > 0 ? createButton : undefined}
      />
      <div className="mt-6">{body}</div>
      {createDialog}
    </PageBody>
  );
};
