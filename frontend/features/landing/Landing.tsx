import React from 'react';
import { Badge, Button, Card, ClassroomBanner } from '../../components/ui';
import { BookOpen, ClipboardList, Code2, LayoutDashboard, MessageCircle, ShieldCheck, UserCheck, Users } from '../../components/ui/icons-compat';

const FEATURES = [
  { icon: <Users size={22} />, title: 'Classrooms with a join code', body: 'Create a class, share its code, and every student who joins is on your roster. Tests, assignments and materials stay inside that class.' },
  { icon: <ClipboardList size={22} />, title: 'Tests that grade themselves', body: 'Multiple choice, numerical, written, coding and file-upload questions on a server-controlled timer. Objective answers are marked automatically; you grade the rest and release results when you’re ready.' },
  { icon: <ShieldCheck size={22} />, title: 'Fair, private proctoring', body: 'Face presence, gaze and identity checks run on the student’s own device. Only signals reach the server, video is never uploaded, and nothing fails a student automatically.' },
  { icon: <UserCheck size={22} />, title: 'Verified attendance', body: 'Open a session and students confirm from their own phones: inside the classroom area, signed in, and matched to their Face ID.' },
  { icon: <Code2 size={22} />, title: 'Coding exams and assignments', body: 'A built-in editor in 13 languages with sample and hidden test cases. Student code is never run on the main server.' },
  { icon: <MessageCircle size={22} />, title: 'A class assistant that cites its sources', body: 'Students ask questions and get answers drawn only from the materials you added to that class, with a note when they don’t cover it.' },
];

const STEPS = [
  { title: 'Create a classroom', body: 'Name it and share the class code with your students.' },
  { title: 'Students join and register Face ID', body: 'Once, from their own device. It’s used for attendance and proctored tests.' },
  { title: 'Publish tests and assignments', body: 'Schedule them, choose the checks you want, and follow live tests as they happen.' },
  { title: 'Review, grade and release', body: 'See scores and question performance, grade written answers, and release results.' },
];

export const Landing: React.FC<{ onSignIn: () => void; onSignUp: () => void }> = ({ onSignIn, onSignUp }) => (
  <div data-ui="landing" className="bg-canvas text-ink">
    {/* Hero */}
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8 lg:pb-24 lg:pt-36">
      <div>
        <Badge tone="primary">For teachers and students</Badge>
        <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[3rem]">
          Run your classroom, tests and attendance in one place
        </h1>
        <p className="mt-4 max-w-xl text-[1.0625rem] leading-7 text-ink-2">
          NeuroClass brings classrooms, auto-graded and proctored tests, assignments and verified attendance together, with privacy built in from the start.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={onSignUp}>Create an account</Button>
          <Button size="lg" variant="outline" onClick={onSignIn}>Sign in</Button>
        </div>
      </div>

      {/* Product sketch: shapes only, no invented numbers or people. */}
      <div aria-hidden className="min-w-0">
        <Card padding="none" className="overflow-hidden shadow-raised">
          <div className="flex items-center gap-2 border-b border-line-2 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" />
          </div>
          <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr]">
            <div className="flex flex-col gap-1 border-r border-line-2 p-3">
              {[LayoutDashboard, BookOpen, ClipboardList, UserCheck].map((Icon, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-r-full px-2 py-2 ${i === 1 ? 'bg-primary-light text-primary-dark' : 'text-ink-2'}`}>
                  <Icon size={16} /><span className={`h-2 flex-1 rounded-full ${i === 1 ? 'bg-primary/40' : 'bg-line-2'}`} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 p-4">
              <ClassroomBanner compact className="rounded-card"><span className="block h-3 w-2/3 rounded-full bg-white/80" /><span className="mt-2 block h-2 w-1/3 rounded-full bg-white/60" /></ClassroomBanner>
              <div className="flex gap-4 border-b border-line-2 pb-2">
                {[0, 1, 2].map((i) => <span key={i} className={`h-2 w-12 rounded-full ${i === 1 ? 'bg-primary' : 'bg-line-2'}`} />)}
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="rounded-card border border-line-2 p-3">
                  <div className="flex gap-2"><span className={`h-4 w-14 rounded-control ${i === 0 ? 'bg-success-bg' : 'bg-primary-light'}`} /><span className="h-4 w-16 rounded-control bg-surface-2" /></div>
                  <span className="mt-3 block h-2.5 w-3/4 rounded-full bg-line" />
                  <span className="mt-2 block h-2 w-1/2 rounded-full bg-line-2" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>

    {/* Features */}
    <section id="features" aria-labelledby="features-heading" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 id="features-heading" className="text-[1.75rem] font-semibold leading-9 text-ink">Everything a class needs</h2>
        <p className="mt-2 max-w-2xl text-body text-ink-2">Each part works on its own and together, without extra tools.</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <Card variant="flat" className="flex h-full gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary-light text-primary-dark">{f.icon}</span>
                <div className="min-w-0">
                  <h3 className="text-card text-ink">{f.title}</h3>
                  <p className="mt-1 text-support text-ink-2">{f.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* How it works */}
    <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h2 id="how-heading" className="text-[1.75rem] font-semibold leading-9 text-ink">How it works</h2>
          <p className="mt-2 text-body text-ink-2">From an empty class to released results in four steps.</p>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-card border border-line bg-surface p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-button font-semibold text-on-primary">{i + 1}</span>
              <div><h3 className="text-card text-ink">{s.title}</h3><p className="text-support text-ink-2">{s.body}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* Tests and privacy */}
    <section id="exams" aria-labelledby="exams-heading" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div>
          <h2 id="exams-heading" className="text-[1.75rem] font-semibold leading-9 text-ink">Proctoring that respects students</h2>
          <p className="mt-2 text-body text-ink-2">Integrity checks are there to help you review, not to accuse. Students see exactly what’s checked before they start.</p>
        </div>
        <ul className="flex flex-col gap-3 text-body">
          {[
            'Face detection runs on the student’s device; video is never recorded or uploaded.',
            'Face ID embeddings stay on the server and are never sent to the browser.',
            'The timer is kept by the server, and answers save automatically.',
            'Warnings are signals for review. Students are never failed automatically and can appeal.',
          ].map((t) => (
            <li key={t} className="flex gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-success-ink" /><span className="text-ink-2">{t}</span></li>
          ))}
        </ul>
      </div>
    </section>

    {/* Call to action */}
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <ClassroomBanner className="rounded-card px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-semibold leading-9 text-white">Ready for your next class?</h2>
            <p className="mt-1 text-body text-white/95">Create an account as a teacher or a student. It takes a minute.</p>
          </div>
          <button type="button" onClick={onSignUp} className="focus-ring inline-flex h-11 shrink-0 items-center justify-center rounded-button bg-white px-5 text-button font-semibold text-[#174ea6] hover:bg-[#e8f0fe]">Create account</button>
        </div>
      </ClassroomBanner>
    </section>

    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-support text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} NeuroClass</span>
        <button type="button" onClick={onSignIn} className="focus-ring self-start rounded-control text-primary hover:underline sm:self-auto">Sign in</button>
      </div>
    </footer>
  </div>
);
