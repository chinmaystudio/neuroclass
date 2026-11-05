/**
 * Public, indexable pages. Plain data (no React) so the build step can read it
 * to write the sitemap and per-page <head> tags. Keep every statement true to
 * what the product actually does.
 */

export type Section = { heading: string; paragraphs?: string[]; steps?: string[]; bullets?: string[] };
export type Guide = { slug: string; title: string; description: string; audience: 'Teachers' | 'Students' | 'Everyone'; minutes: number; sections: Section[] };

export const GUIDES: Guide[] = [
  {
    slug: 'getting-started-teachers',
    title: 'Getting started as a teacher',
    description: 'Create your first classroom, invite students with a class code, and find your way around tests, assignments, materials and attendance.',
    audience: 'Teachers',
    minutes: 4,
    sections: [
      {
        heading: 'Create a classroom',
        paragraphs: ['Everything in NeuroClass belongs to a classroom: its roster, tests, assignments, materials and attendance. Students only ever see work from classrooms they have joined.'],
        steps: [
          'Sign in and open Classrooms from the sidebar.',
          'Choose Create classroom and give it a name your students will recognise, such as “Computer Engineering A4”.',
          'NeuroClass generates a six-character class code. Copy it from the classroom card’s menu or from the classroom page.',
        ],
      },
      {
        heading: 'Invite your students',
        paragraphs: [
          'Share the class code in your usual channel: a message, the board, or your learning platform. Students sign up as students, choose Join a class and enter the code. They appear in the Students tab as soon as they join.',
          'The Students tab also shows whether each student has registered Face ID. Face ID is only needed for verified attendance and for tests where you turn on identity checks.',
        ],
      },
      {
        heading: 'Know the classroom tabs',
        bullets: [
          'Students: the roster, with search, email, roll number and Face ID status.',
          'Tests: create, schedule, publish, monitor and grade tests.',
          'Assignments: set work with a due date, accept files or code, and grade submissions.',
          'Materials: upload notes and documents that the class assistant can answer from.',
          'Attendance: open a time-limited session that students confirm from their own devices.',
          'Settings: the class code to share.',
        ],
      },
      {
        heading: 'Where to go next',
        paragraphs: ['Read “Creating and publishing a test” to set up your first assessment, or “How verified attendance works” before your first session.'],
      },
    ],
  },
  {
    slug: 'creating-a-test',
    title: 'Creating and publishing a test',
    description: 'Build a test with objective, written and coding questions, choose its schedule and integrity checks, then grade attempts and release results.',
    audience: 'Teachers',
    minutes: 6,
    sections: [
      {
        heading: 'Start a test',
        paragraphs: ['Open a classroom, choose the Tests tab, then New test. A test moves through four steps: Details, Questions, Security and proctoring, and Review and publish. Nothing is visible to students until you publish.'],
      },
      {
        heading: 'Add questions',
        paragraphs: ['NeuroClass supports multiple choice (one or several answers), true or false, numerical, fill in the blank, short and long written answers, file upload and coding questions. Each question has its own marks and optional negative marks.'],
        bullets: [
          'Objective questions are marked automatically on the server when the student submits.',
          'Written and file-upload answers wait for you to grade them.',
          'Coding questions run the student’s code against sample and hidden test cases in an isolated code-execution service, never on the main server.',
        ],
      },
      {
        heading: 'Schedule and settings',
        paragraphs: [
          'Set the opening and closing time and the duration. The timer is kept by the server, so refreshing the page or losing connection doesn’t give a student extra time, and answers save automatically as they work.',
          'Under Security and proctoring you choose which checks apply: camera presence, identity verification against Face ID, a liveness check, full-screen mode, tab-switch detection and clipboard blocking. Students see this list before they start.',
        ],
      },
      {
        heading: 'Monitor, grade and release',
        steps: [
          'While a test is live, choose Monitor to see who is taking it and any warnings.',
          'After it closes, open Results to review each attempt, grade written answers and look at the proctoring timeline.',
          'Choose Release results when you’re ready. Students only see fully evaluated attempts.',
        ],
        paragraphs: ['Proctoring warnings are signals to help you review. They never fail a student automatically, and students can appeal a decision.'],
      },
    ],
  },
  {
    slug: 'how-proctoring-works',
    title: 'How proctoring works, and what it doesn’t do',
    description: 'What NeuroClass checks during a proctored test, what is sent to the server, and how teachers and students should treat the signals.',
    audience: 'Everyone',
    minutes: 5,
    sections: [
      {
        heading: 'What is checked',
        bullets: [
          'Presence: whether a face is in view and facing the screen.',
          'Other people: more than one face in view.',
          'Head direction and gaze: looking away for longer than the test allows.',
          'Browser behaviour: leaving full screen, switching tabs and, if enabled, using copy and paste.',
          'Identity: a single photo compared with the student’s registered Face ID, re-checked periodically if the teacher turns that on.',
        ],
      },
      {
        heading: 'What stays on the device',
        paragraphs: [
          'Face presence, head pose and gaze are estimated by a model that runs in the student’s browser. Only numeric signals, such as the number of faces and the head angle, are sent to the server. Video is not recorded or uploaded.',
          'For identity checks, one photo is sent to the server, compared with the stored Face ID template, and the result is recorded. Face ID templates stay on the server and are never sent back to a browser.',
        ],
      },
      {
        heading: 'Signals, not verdicts',
        paragraphs: [
          'Lighting, cameras, disabilities and ordinary movement can all trigger a warning. NeuroClass therefore never fails a student automatically. Teachers see a timeline of events with each attempt, can dismiss or flag them, and students can appeal.',
          'Browser checks can’t see other devices in the room, so proctoring supports a fair exam rather than guaranteeing one.',
        ],
      },
      {
        heading: 'Before a proctored test',
        steps: [
          'Register Face ID once from Settings if the test needs identity checks.',
          'Use a well-lit room and a working camera, and close other apps that use the camera.',
          'Read the list of checks shown before the test starts, and agree only if you’re comfortable to continue.',
        ],
      },
    ],
  },
  {
    slug: 'verified-attendance',
    title: 'How verified attendance works',
    description: 'Open a time-limited attendance session; students confirm from their own phones with location, sign-in and Face ID, and you get a report.',
    audience: 'Everyone',
    minutes: 4,
    sections: [
      {
        heading: 'For teachers: open a session',
        steps: [
          'Open the classroom and choose Attendance, or Attendance in the sidebar.',
          'Choose Use my location. Your position sets the centre of the classroom area.',
          'Pick a radius (50 to 250 metres, or a custom value) and how long the session stays open.',
          'Choose Start session. Students in the class are notified automatically.',
        ],
        paragraphs: ['As students confirm, they appear in the Present list. When you end the session you get a report with present and absent counts that you can download as CSV.'],
      },
      {
        heading: 'For students: confirm you’re present',
        paragraphs: [
          'When a session opens you’ll see a prompt in NeuroClass. Allow location access, then complete Face ID and a short liveness check on your own device. The server records your attendance only if you’re signed in, enrolled in that class, inside the classroom area and your face matches your registered Face ID.',
          'Your teacher’s camera is not used for this method.',
        ],
      },
      {
        heading: 'Other methods',
        bullets: [
          'Classroom camera: the teacher captures a photo of the room or runs a live preview, and recognised students are marked present.',
          'Register faces: a teacher can help a student capture Face ID samples in class.',
        ],
      },
      {
        heading: 'If a record is wrong',
        paragraphs: ['Students can send a correction request, with the date and session, from the class page’s Attendance tab. It is stored with their attendance record. Teachers can also talk to the student directly and re-run attendance if needed.'],
      },
    ],
  },
  {
    slug: 'getting-started-students',
    title: 'Getting started as a student',
    description: 'Join a class with a code, register Face ID, take tests, submit assignments and find your results.',
    audience: 'Students',
    minutes: 4,
    sections: [
      {
        heading: 'Join your class',
        steps: [
          'Create a student account, or sign in.',
          'Choose Join a class and enter the code your teacher gave you.',
          'Follow the steps to register Face ID. You only do this once; it applies to every class.',
        ],
      },
      {
        heading: 'Take a test',
        paragraphs: [
          'Open tests appear on your home page and under Tests. Before you start you’ll see the duration, marks, instructions and exactly which checks are on. The timer is kept by the server and your answers save automatically, so a refresh or a dropped connection won’t lose your work.',
          'For coding questions you can run your code against sample cases before you submit.',
        ],
      },
      {
        heading: 'Assignments and materials',
        paragraphs: ['Each class page has Assignments, where you upload files or code before the due date, and Materials, where your teacher shares notes. The class assistant answers questions using only those materials and tells you when they don’t cover your question.'],
      },
      {
        heading: 'Results and history',
        paragraphs: ['Scores appear under Performance and History once your teacher releases them. If you think a result or an attendance record is wrong, you can send an appeal or correction request from the result or the class page.'],
      },
      {
        heading: 'Your data',
        paragraphs: ['You can delete your Face ID data at any time from Settings. Read the privacy policy for what NeuroClass stores and why.'],
      },
    ],
  },
];

export type PublicRoute = { path: string; title: string; description: string; changefreq: 'weekly' | 'monthly' | 'yearly'; priority: number };

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', title: 'NeuroClass: classrooms, tests and verified attendance', description: 'Run your classroom, auto-graded and proctored tests, assignments and verified attendance in one place, with privacy built in.', changefreq: 'weekly', priority: 1 },
  { path: '/help', title: 'Help and guides', description: 'Step-by-step guides for teachers and students: classrooms, tests, proctoring, attendance and results.', changefreq: 'monthly', priority: 0.8 },
  ...GUIDES.map((g) => ({ path: `/help/${g.slug}`, title: g.title, description: g.description, changefreq: 'monthly' as const, priority: 0.7 })),
  { path: '/about', title: 'About NeuroClass', description: 'Why NeuroClass exists, what it does, and the principles behind its proctoring and attendance features.', changefreq: 'monthly', priority: 0.6 },
  { path: '/contact', title: 'Contact', description: 'How to reach the NeuroClass team for support, privacy requests and feedback.', changefreq: 'yearly', priority: 0.5 },
  { path: '/privacy', title: 'Privacy policy', description: 'What NeuroClass collects, why, who processes it, how long it is kept, cookies and advertising, and your choices.', changefreq: 'yearly', priority: 0.4 },
  { path: '/terms', title: 'Terms of service', description: 'The terms for using NeuroClass as a teacher or student.', changefreq: 'yearly', priority: 0.4 },
];
