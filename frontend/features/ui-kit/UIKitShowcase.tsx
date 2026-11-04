import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  ActivityCard, AppShell, AssignmentCard, Avatar, Badge, Button, Card, CardFooter, CardHeader, Checkbox, ClassroomBanner,
  ClassroomCard, DataTable, DateInput, Dropdown, EmptyState, ErrorState, Field, FileUpload, IconButton, IconCalendar,
  IconHome, IconMore, IconMoon, IconPlus, IconSun, IconUsers, InfoCard, Input, Modal, PageHeader, Pagination, PasswordInput,
  ProgressBar, RadioGroup, SearchInput, Select, SidebarNav, Skeleton, SkeletonCard, Spinner, StatCard, StatusBadge,
  StudentCard, TabPanel, Tabs, TestCard, Textarea, Toggle, Tooltip, TopBar, useConfirm, useToast, type Column,
} from '../../components/ui';

/**
 * Living style guide for the NeuroClass UI kit (/ui-kit). Shows every
 * component and state with realistic content, in the current theme.
 * Sample data only: nothing here reads or writes real records.
 */

type Row = { id: string; name: string; roll: string; status: string; submitted: string; marks: string };
const ROWS: Row[] = [
  { id: '1', name: 'Arjun Mehta', roll: 'CE-101', status: 'graded', submitted: 'Nov 4, 4:33 PM', marks: '18 / 20' },
  { id: '2', name: 'Sara Khan', roll: 'CE-102', status: 'submitted', submitted: 'Nov 4, 5:10 PM', marks: '—' },
  { id: '3', name: 'Rohan Iyer', roll: 'CE-103', status: 'late', submitted: 'Nov 5, 9:02 AM', marks: '—' },
  { id: '4', name: 'Ananya Rao', roll: 'CE-104', status: 'not_started', submitted: '—', marks: '—' },
];

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Student', cell: (r) => <span className="inline-flex items-center gap-3"><Avatar name={r.name} size="sm" /><span className="font-medium">{r.name}</span></span> },
  { key: 'roll', header: 'Roll no.', cell: (r) => <span className="text-ink-2">{r.roll}</span>, hideOnMobile: true },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  { key: 'submitted', header: 'Submitted', cell: (r) => <span className="text-ink-2">{r.submitted}</span> },
  { key: 'marks', header: 'Marks', cell: (r) => <span className="tabular-nums">{r.marks}</span>, align: 'right' },
];

const Section: React.FC<{ id: string; title: string; description?: string; children: React.ReactNode }> = ({ id, title, description, children }) => (
  <section aria-labelledby={`${id}-h`} className="scroll-mt-24">
    <h2 id={`${id}-h`} className="text-section text-ink">{title}</h2>
    {description && <p className="mt-1 max-w-3xl text-support text-ink-2">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Swatch: React.FC<{ name: string; cls: string; token: string }> = ({ name, cls, token }) => (
  <div className="flex items-center gap-3">
    <span className={`h-10 w-10 shrink-0 rounded-control border border-line ${cls}`} />
    <span className="min-w-0"><span className="block text-support font-medium text-ink">{name}</span><span className="block font-mono text-meta text-ink-2">{token}</span></span>
  </div>
);

export const UIKitShowcase: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [nav, setNav] = React.useState('dashboard');
  const [tab, setTab] = React.useState('stream');
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState(false);
  const [toggleA, setToggleA] = React.useState(true);
  const [toggleB, setToggleB] = React.useState(false);
  const [radio, setRadio] = React.useState('text');
  const [page, setPage] = React.useState(2);
  const [files, setFiles] = React.useState<Array<{ id: string; name: string; size?: number }>>([{ id: 'f1', name: 'min-heap-report.pdf', size: 482_000 }]);
  const [title, setTitle] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const sections = [
    { id: 'main', items: [
      { id: 'dashboard', label: 'Dashboard', icon: <IconHome size={20} /> },
      { id: 'classrooms', label: 'My classrooms', icon: <IconUsers size={20} /> },
      { id: 'calendar', label: 'Calendar', icon: <IconCalendar size={20} /> },
    ] },
    { id: 'work', label: 'Classwork', items: [
      { id: 'tests', label: 'Tests', badge: 2 },
      { id: 'assignments', label: 'Assignments' },
      { id: 'attendance', label: 'Attendance' },
    ] },
    { id: 'account', items: [{ id: 'settings', label: 'Settings' }] },
  ];

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-canvas">
      <AppShell
        topBar={(openNav) => (
          <TopBar
            onOpenNav={openNav}
            title="UI kit"
            user={{ name: 'Priya Sharma', email: 'priya.sharma@school.edu', roleLabel: 'Teacher' }}
            search={{ value: search, onChange: setSearch, placeholder: 'Search classrooms, tests and students' }}
            notifications={{ count: 3, onOpen: () => toast.info('Notifications open here.') }}
            actions={<IconButton label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} icon={theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />} onClick={toggleTheme} />}
            menuItems={[
              { id: 'profile', label: 'Profile', onSelect: () => toast.info('Profile') },
              { id: 'settings', label: 'Settings', onSelect: () => toast.info('Settings') },
              { id: 'signout', label: 'Sign out', onSelect: () => toast.info('Signed out (demo)'), separatorBefore: true },
            ]}
          />
        )}
        sidebar={<SidebarNav sections={sections} activeId={nav} onNavigate={(i) => setNav(i.id)} footer={<Button variant="outline" fullWidth iconLeft={<IconPlus size={18} />}>Create classroom</Button>} />}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            breadcrumbs={[{ label: 'Dashboard', onClick: () => undefined }, { label: 'Design system' }, { label: 'UI kit' }]}
            title="NeuroClass UI kit"
            description="Every reusable component, its variants and states. Switch the theme from the top bar to review dark mode."
            actions={<><Button variant="outline">Secondary action</Button><Button iconLeft={<IconPlus size={18} />}>Primary action</Button></>}
          />

          <Section id="colour" title="Colour" description="Bright blue brand, neutral surfaces and restrained status colours. Values switch with the theme.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card><CardHeader title="Brand" /><div className="mt-4 grid grid-cols-2 gap-4">
                <Swatch name="Primary" cls="bg-primary" token="primary" />
                <Swatch name="Primary hover" cls="bg-primary-hover" token="primary-hover" />
                <Swatch name="Primary light" cls="bg-primary-light" token="primary-light" />
                <Swatch name="Primary soft" cls="bg-primary-soft" token="primary-soft" />
                <Swatch name="Primary dark" cls="bg-primary-dark" token="primary-dark" />
                <Swatch name="Brand gradient" cls="bg-brand-gradient" token="bg-brand-gradient" />
              </div></Card>
              <Card><CardHeader title="Neutral and status" /><div className="mt-4 grid grid-cols-2 gap-4">
                <Swatch name="Canvas" cls="bg-canvas" token="canvas" />
                <Swatch name="Surface" cls="bg-surface" token="surface" />
                <Swatch name="Text" cls="bg-ink" token="ink / ink-2 / ink-3" />
                <Swatch name="Border" cls="bg-line" token="line" />
                <Swatch name="Success" cls="bg-success" token="success / -bg / -ink" />
                <Swatch name="Warning" cls="bg-warning" token="warning / -bg / -ink" />
                <Swatch name="Error" cls="bg-danger" token="danger / -bg / -ink" />
                <Swatch name="Information" cls="bg-info" token="info / -bg / -ink" />
              </div></Card>
            </div>
          </Section>

          <Section id="type" title="Typography" description="Inter with Roboto and system fallbacks. Sentence case everywhere; no uppercase labels.">
            <Card className="flex flex-col gap-3">
              <p className="text-page text-ink">Page heading · 28px / 650</p>
              <p className="text-section text-ink">Section heading · 20px / 600</p>
              <p className="text-card text-ink">Card heading · 16px / 600</p>
              <p className="text-body text-ink">Body text · 15px / 400. Students should immediately understand what is due and when.</p>
              <p className="text-support text-ink-2">Supporting text · 13px / 400</p>
              <p className="text-meta text-ink-2">Metadata · 12px / 400 · Updated 5 minutes ago</p>
            </Card>
          </Section>

          <Section id="buttons" title="Buttons" description="Rectangular, 5px radius, no gradients or heavy shadows. One primary action per area.">
            <Card className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="text">Text</Button>
                <Button variant="danger">Delete</Button>
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled outline</Button>
                <Button loading>Saving</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button iconLeft={<IconPlus size={18} />}>Create test</Button>
                <Tooltip content="More actions"><IconButton label="More actions" icon={<IconMore size={20} />} /></Tooltip>
                <IconButton label="Add" variant="outline" icon={<IconPlus size={20} />} />
                <IconButton label="Add" variant="primary" icon={<IconPlus size={20} />} />
              </div>
            </Card>
          </Section>

          <Section id="badges" title="Badges and status" description="Same word, same colour, everywhere. A dot plus text, so colour is never the only signal.">
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {['submitted', 'pending', 'overdue', 'completed', 'active', 'present', 'absent', 'draft', 'scheduled', 'late', 'graded'].map((s) => <StatusBadge key={s} status={s} />)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Neutral</Badge><Badge tone="primary">Primary</Badge><Badge tone="success">Success</Badge><Badge tone="warning">Warning</Badge><Badge tone="danger">Error</Badge><Badge tone="info">Information</Badge>
              </div>
            </Card>
          </Section>

          <Section id="cards" title="Cards" description="White surface, thin border, subtle shadow, 8px radius. Two-column grids; never three equal cards in a row.">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Students across classrooms" value="101" hint="3 classrooms" />
              <StatCard label="Waiting to be graded" value="7" tone="warning" trend={{ label: '+3 today', tone: 'warning' }} />
              <ClassroomCard name="Computer Engineering — Data Structures" subject="Computer Science · Section A4" teacher="Priya Sharma" code="DSA24X" studentCount={32}
                upcoming={<><p className="font-medium text-ink">Mid-term: Trees and Graphs</p><p>Tomorrow, 10:30 PM</p></>}
                onOpen={() => toast.info('Open classroom')}
                actions={<Dropdown label="Classroom actions" items={[{ id: 'copy', label: 'Copy class code', onSelect: () => toast.success('Class code copied') }, { id: 'archive', label: 'Archive', onSelect: () => undefined }, { id: 'delete', label: 'Delete', danger: true, separatorBefore: true, onSelect: () => void confirm({ title: 'Delete Computer Engineering — Data Structures?', body: 'All tests, students and attendance records are removed. This cannot be undone.', confirmLabel: 'Delete classroom', tone: 'danger', requireText: 'DSA24X' }) }]} trigger={(p) => <IconButton {...p} label="Classroom actions" icon={<IconMore size={20} />} size="sm" />} />}
              />
              <ClassroomCard name="Physics 101" subject="Physics" teacher="Priya Sharma" code="PHY101" studentCount={1} onOpen={() => undefined} />
              <TestCard title="Quiz 3: Linked Lists" classroom="Computer Engineering — Data Structures" status="live" due="Closes today, 7:30 PM" duration="20 min" marks={10}
                extraBadges={<Badge tone="info">Proctored</Badge>}
                stats={[{ label: 'Submitted', value: 19 }, { label: 'In progress', value: 6 }, { label: 'To grade', value: 0 }, { label: 'Average', value: '7.4' }]}
                actions={<><Button variant="outline" size="sm">Results</Button><Button size="sm">Monitor</Button></>} />
              <AssignmentCard title="Implement a min-heap" classroom="Computer Engineering — Data Structures" status="pending" statusLabel="Due soon" due="Due Nov 6, 8:30 AM" marks={20}
                actions={<><Button variant="outline" size="sm">View instructions</Button><Button size="sm">Submit work</Button></>} />
              <StudentCard name="Arjun Mehta" email="arjun.mehta@school.edu" detail="Roll CE-101" status={<StatusBadge status="present" />} />
              <Card variant="interactive">
                <CardHeader title="Interactive card" subtitle="Raises on hover and when something inside has focus." actions={<Badge tone="primary">New</Badge>} />
                <p className="mt-3 text-body text-ink-2">Use for anything that opens a detail view.</p>
                <CardFooter><Button variant="text" size="sm">Open</Button></CardFooter>
              </Card>
              <ActivityCard items={[
                { id: '1', actor: 'Sara Khan', title: <><b className="font-medium">Sara Khan</b> submitted Implement a min-heap</>, time: '5 min ago' },
                { id: '2', title: 'Results released for Coding lab: Sorting', detail: '30 students notified', time: '1 h ago', tone: 'success' },
                { id: '3', title: 'Attendance completed for A4', detail: '21 of 22 present', time: 'Yesterday', tone: 'info' },
              ]} actions={<Button variant="text" size="sm">View all</Button>} />
              <div className="flex flex-col gap-3">
                <InfoCard title="Results are hidden">Students will see their scores after you release them.</InfoCard>
                <InfoCard tone="success" title="Test published">32 students can now see it.</InfoCard>
                <InfoCard tone="warning" title="Code sandbox not configured">Coding answers will be graded manually.</InfoCard>
                <InfoCard tone="danger" title="Couldn’t save" action={<Button variant="text" size="sm">Retry</Button>}>Check your connection and try again.</InfoCard>
              </div>
            </div>
          </Section>

          <Section id="banner" title="Classroom banner" description="The brand gradient is reserved for classroom covers and a few highlight areas.">
            <Card padding="none" className="overflow-hidden">
              <ClassroomBanner className="py-8">
                <p className="text-support text-white/95">Computer Science · Section A4</p>
                <h3 className="mt-1 text-page text-white">Computer Engineering — Data Structures</h3>
                <p className="mt-2 text-support text-white/95">Class code <span className="font-mono font-semibold">DSA24X</span></p>
              </ClassroomBanner>
              <Tabs label="Classroom sections" idPrefix="demo" value={tab} onChange={setTab} className="px-2"
                items={[{ id: 'stream', label: 'Stream' }, { id: 'classwork', label: 'Classwork', count: 4 }, { id: 'people', label: 'People', count: 32 }, { id: 'attendance', label: 'Attendance' }, { id: 'grades', label: 'Grades' }, { id: 'insights', label: 'Insights', disabled: true }]} />
              <TabPanel tabId={tab} idPrefix="demo" className="p-5">
                <p className="text-body text-ink-2">Showing the <b className="font-medium text-ink">{tab}</b> panel. Use the arrow keys to move between tabs.</p>
              </TabPanel>
            </Card>
          </Section>

          <Section id="forms" title="Forms" description="Visible labels, hints, inline validation and clear focus.">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-col gap-4">
                <Field label="Test title" required hint="Students see this in their list." error={touched && !title.trim() ? 'Enter a title for the test.' : undefined}>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. Unit 3 — Kinematics" />
                </Field>
                <Field label="Email address"><Input type="email" placeholder="name@school.edu" defaultValue="priya.sharma@school.edu" /></Field>
                <Field label="Password"><PasswordInput placeholder="At least 8 characters" /></Field>
                <Field label="Search students" hideLabel><SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} placeholder="Search students" /></Field>
                <Field label="Disabled field"><Input disabled value="Calculated from questions" readOnly /></Field>
              </Card>
              <Card className="flex flex-col gap-4">
                <Field label="Classroom"><Select defaultValue="" placeholder="Choose a classroom"><option value="a4">A4 · Data Structures</option><option value="phy">Physics 101</option></Select></Field>
                <Field label="Opens at" optional><DateInput withTime /></Field>
                <Field label="Instructions" optional><Textarea placeholder="Rules, allowed materials, how answers are marked…" /></Field>
                <RadioGroup legend="Submission type" name="type" value={radio} onChange={setRadio} inline options={[{ value: 'text', label: 'Text' }, { value: 'file', label: 'File upload' }, { value: 'code', label: 'Code' }]} />
                <div className="flex flex-col gap-2">
                  <Checkbox label="Shuffle questions" defaultChecked />
                  <Checkbox label="Allow late submissions" description="A penalty can be applied per day late." />
                  <Checkbox label="Select all students" indeterminate />
                  <Checkbox label="Unavailable option" disabled />
                </div>
              </Card>
              <Card className="flex flex-col gap-4">
                <Toggle checked={toggleA} onChange={setToggleA} label="Release results automatically" description="Students see scores as soon as grading finishes." />
                <Toggle checked={toggleB} onChange={setToggleB} label="Require Face ID before starting" />
                <Toggle checked={false} onChange={() => undefined} label="Live AI proctoring" description="Available after Face ID is enabled." disabled />
              </Card>
              <Card>
                <Field label="Attachments" hint="PDF, DOCX or ZIP · up to 10 MB · max 3 files">
                  <FileUpload accept={['pdf', 'docx', 'zip']} maxSizeMb={10} maxFiles={3} files={files}
                    onFiles={(list) => setFiles((f) => [...f, ...list.map((x, i) => ({ id: `${Date.now()}-${i}`, name: x.name, size: x.size }))])}
                    onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))} hint="PDF, DOCX or ZIP · up to 10 MB · max 3 files" />
                </Field>
              </Card>
            </div>
          </Section>

          <Section id="data" title="Tables" description="Clear headings, consistent rows, hover highlight. Below 640px the table becomes a stacked list instead of scrolling sideways.">
            <Card padding="none" className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <CardHeader title="Implement a min-heap" subtitle="Submissions · 4 of 32 shown" />
                <Pagination page={page} pageCount={8} onChange={setPage} />
              </div>
              <DataTable caption="Assignment submissions" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />
            </Card>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Card className="flex flex-col gap-4"><CardHeader title="Progress" />
                <ProgressBar label="Assignments completed" value={14} max={20} />
                <ProgressBar label="Attendance" value={91} tone="success" />
                <ProgressBar label="Syllabus covered" value={38} tone="warning" />
              </Card>
              <Card><CardHeader title="Avatars" /><div className="mt-4 flex items-center gap-3"><Avatar name="Priya Sharma" size="xl" /><Avatar name="Arjun Mehta" size="lg" /><Avatar name="Sara Khan" /><Avatar name="Rohan Iyer" size="sm" /></div></Card>
            </div>
          </Section>

          <Section id="feedback" title="Feedback" description="Kit dialogs and toasts replace browser alert() and confirm().">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="flex flex-col gap-4">
                <CardHeader title="Dialogs and toasts" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setModal(true)}>Open dialog</Button>
                  <Button variant="outline" onClick={async () => { const ok = await confirm({ title: 'Publish this test?', body: '32 students will be able to see it.', confirmLabel: 'Publish' }); toast(ok ? 'Test published.' : 'Not published.', { tone: ok ? 'success' : 'info' }); }}>Confirm</Button>
                  <Button variant="danger" onClick={() => void confirm({ title: 'Delete A4?', body: 'This permanently removes 22 students and their records.', confirmLabel: 'Delete classroom', tone: 'danger', requireText: 'A4' })}>Destructive confirm</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="text" onClick={() => toast.success('Saved.')}>Success toast</Button>
                  <Button variant="text" onClick={() => toast.error('Couldn’t reach the server. Try again.')}>Error toast</Button>
                  <Button variant="text" onClick={() => toast('Draft restored.', { action: { label: 'Undo', onClick: () => toast.info('Undone.') } })}>Toast with action</Button>
                </div>
              </Card>
              <Card className="flex flex-col gap-4">
                <CardHeader title="Loading" />
                <Spinner inline label="Loading submissions…" />
                <div className="flex items-center gap-3"><Skeleton rounded="full" className="h-9 w-9" /><div className="flex-1"><Skeleton className="h-4 w-1/2" /><Skeleton className="mt-2 h-3 w-1/3" /></div></div>
              </Card>
              <SkeletonCard banner />
              <EmptyState title="No assignments yet" body="Create the first assignment for this classroom. Students only see it after you publish." action={<Button iconLeft={<IconPlus size={18} />}>Create assignment</Button>} />
              <ErrorState message="We couldn’t load the results for this test." onRetry={() => toast.info('Retrying…')} className="sm:col-span-2" />
            </div>
          </Section>
        </div>
      </AppShell>

      <Modal open={modal} onClose={() => setModal(false)} title="Release results?" description="Students in A4 will see their scores and your feedback."
        footer={<><Button variant="text" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => { setModal(false); toast.success('Results released.'); }}>Release results</Button></>}>
        <Checkbox label="Also show correct answers" description="Only after the test has closed for everyone." />
      </Modal>
    </div>
  );
};

export default UIKitShowcase;
