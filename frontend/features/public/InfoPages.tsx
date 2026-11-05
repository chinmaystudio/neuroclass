import React from 'react';
import { Link } from 'react-router-dom';
import { buttonClasses, Card, InfoCard } from '../../components/ui';
import { SITE } from '../../config/site';
import { Prose, PublicPage } from './PublicLayout';
import { usePageMeta } from './usePageMeta';

const updated = new Date(`${SITE.legalUpdated}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const Contact: React.FC = () => SITE.contactEmail
  ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
  : <Link to="/contact">our contact page</Link>;

/* -------------------------------------------------------------------------- */

export const AboutPage: React.FC = () => {
  usePageMeta({ title: 'About NeuroClass', description: 'Why NeuroClass exists, what it does, and the principles behind its proctoring and attendance features.', path: '/about' });
  return (
    <PublicPage title="About NeuroClass" intro="NeuroClass is a classroom platform for teachers and students: classes, tests, assignments, materials and attendance in one place.">
      <Prose>
        <h2>Why we built it</h2>
        <p>Teachers often juggle a separate tool for each job: one for class lists, another for quizzes, another for assignments and a spreadsheet for attendance. NeuroClass puts them in one classroom, so students see only the work for the classes they’ve joined, and teachers can see everything about a class on one page.</p>
        <h2>What it does</h2>
        <ul>
          <li>Classrooms that students join with a code.</li>
          <li>Tests with objective, written, file-upload and coding questions, marked on the server, with results released when the teacher is ready.</li>
          <li>Optional proctoring and identity checks for tests.</li>
          <li>Assignments with due dates, file and code submissions, and grading.</li>
          <li>Verified attendance that students confirm from their own devices.</li>
          <li>A class assistant that answers only from the materials a teacher has added.</li>
        </ul>
        <h2>Our principles</h2>
        <ul>
          <li><strong>Signals, not verdicts.</strong> Proctoring and attendance checks help teachers review. They never fail or penalise a student automatically, and students can appeal.</li>
          <li><strong>Least data.</strong> Face detection for proctoring runs on the student’s device. Video isn’t recorded, and Face ID templates never leave the server.</li>
          <li><strong>Students first.</strong> Students see exactly which checks a test uses before they start, and can delete their Face ID data at any time.</li>
        </ul>
        <p>Read the <Link to="/help">guides</Link> to get started, or the <Link to="/privacy">privacy policy</Link> for how data is handled.</p>
      </Prose>
    </PublicPage>
  );
};

/* -------------------------------------------------------------------------- */

export const ContactPage: React.FC = () => {
  usePageMeta({ title: 'Contact', description: 'How to reach the NeuroClass team for support, privacy requests and feedback.', path: '/contact' });
  return (
    <PublicPage title="Contact" intro="We read every message. Tell us what you were trying to do and what happened, and we’ll get back to you.">
      <div className="flex flex-col gap-4">
        {SITE.contactEmail ? (
          <Card>
            <h2 className="text-card text-ink">Email</h2>
            <p className="mt-1 text-body text-ink-2">For support, privacy and data requests, and feedback.</p>
            <a className={buttonClasses('primary', 'md', 'mt-4')} href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </Card>
        ) : (
          <InfoCard tone="info" title="Contact details are being set up">Please check back soon. If you use NeuroClass through your school, your teacher or school administrator can also help.</InfoCard>
        )}
        <Card>
          <h2 className="text-card text-ink">Before you write</h2>
          <ul className="mt-2 list-disc pl-6 text-body text-ink-2">
            <li>For help with a class, test or result, ask your teacher first; they can see your class and attempts.</li>
            <li>To delete your Face ID data, go to Settings in your account. It takes effect immediately.</li>
            <li>The <Link className="text-primary hover:underline" to="/help">help guides</Link> answer the most common questions.</li>
          </ul>
        </Card>
      </div>
    </PublicPage>
  );
};

/* -------------------------------------------------------------------------- */

export const PrivacyPage: React.FC = () => {
  usePageMeta({ title: 'Privacy policy', description: 'What NeuroClass collects, why, who processes it, how long it is kept, cookies and advertising, and your choices.', path: '/privacy' });
  return (
    <PublicPage title="Privacy policy" meta={`Last updated ${updated}`} intro={`This policy explains what information ${SITE.name} collects when you use the website and app, how it is used, who it is shared with, and the choices you have.`}>
      <Prose>
        <h2>Who we are</h2>
        <p>{SITE.name} is operated by {SITE.operator}. You can contact us about this policy or your data at <Contact />.</p>

        <h2>Information we collect</h2>
        <h3>Account information</h3>
        <p>Your name, email address, password (stored only as a secure hash by our authentication provider), your role (teacher or student) and, if you give it, your mobile number. If you sign in with Google, Google shares your name, email address and profile picture with us; we don’t receive your Google password or access to your Google account’s other data.</p>
        <h3>Classroom content</h3>
        <p>Classrooms you create or join, rosters, tests, questions, your answers and submitted code, uploaded files and assignments, grades, feedback, appeals and correction requests, and materials teachers upload.</p>
        <h3>Face ID (biometric data)</h3>
        <p>If you register Face ID, images captured during registration are processed on our servers to create a numeric face template. Templates are stored on our servers, are never sent back to a browser, and are used only to confirm your identity for attendance and for tests where your teacher turns on identity checks. You can delete your Face ID data at any time in Settings. Face ID is optional unless your teacher requires it for verified attendance or a proctored test.</p>
        <h3>Proctoring signals</h3>
        <p>During a proctored test, face presence, head direction and gaze are estimated on your device. We receive numeric signals (such as the number of faces and head angle), browser events (such as leaving full screen or switching tabs) and, for identity checks, a single photo that is compared with your Face ID template. We do not record or upload video.</p>
        <h3>Location</h3>
        <p>When you take part in a verified attendance session, your device’s location is sent to check that you are inside the classroom area, and it is stored with that attendance record. Teachers’ locations are stored with the session they open. We don’t track location at any other time.</p>
        <h3>Technical information</h3>
        <p>Like most websites, our servers and hosting providers receive your IP address, browser type and request logs, which we use for security, abuse prevention and fixing problems.</p>

        <h2>How we use information</h2>
        <ul>
          <li>To provide the service: run classrooms, deliver and mark tests, record attendance and show results.</li>
          <li>To keep it secure and fair: authenticate you, limit abuse, and give teachers integrity signals to review.</li>
          <li>To answer questions with the class assistant and help teachers draft questions, using the AI provider listed below.</li>
          <li>To communicate with you about your account and respond to requests.</li>
          <li>To email students when a teacher publishes a test or an assignment, or releases results. You can turn these emails off in Settings.</li>
          <li>To show advertising on public pages, where enabled (see “Cookies and advertising”).</li>
        </ul>
        <p>We do not sell your personal information. Advertising is never shown on signed-in, test or attendance screens, and classroom data is not used for advertising.</p>

        <h2>Who processes information for us</h2>
        <ul>
          <li><strong>Supabase</strong>: authentication, database and file storage.</li>
          <li><strong>Vercel</strong>: our application programming interface (API).</li>
          <li><strong>Cloudflare</strong>: hosting and delivery of the website.</li>
          <li><strong>Render</strong>: the service that checks proctoring signals and identity.</li>
          <li><strong>Google</strong>: the Gemini AI model for the class assistant and question tools; Google Drive, only if a teacher connects it (limited to files the app creates or opens); and, where enabled, Google AdSense on public pages.</li>
          <li>A code-execution provider, which runs submitted code in an isolated environment.</li>
          <li>An email delivery provider, which sends classroom notification emails.</li>
        </ul>
        <p>Teachers can see information about the students in their classrooms, including names, emails, roll numbers, answers, grades, attendance and proctoring events for their tests. Students cannot see other students’ information.</p>

        <h2>Cookies and advertising</h2>
        <p>We use your browser’s local storage to keep you signed in and to remember your theme. These are necessary for the site to work.</p>
        <p>On our public pages (such as the home page and help guides) we may show ads served by Google. In that case:</p>
        <ul>
          <li>Third-party vendors, including Google, use cookies to serve ads based on a user’s prior visits to this website or other websites.</li>
          <li>Google’s use of advertising cookies enables it and its partners to serve ads to our users based on their visit to our site and/or other sites on the internet.</li>
          <li>You may opt out of personalised advertising by visiting <a href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">Google Ads Settings</a>. You can also opt out of some third-party vendors’ use of cookies for personalised advertising at <a href="https://www.aboutads.info/choices" rel="noopener noreferrer" target="_blank">www.aboutads.info</a>.</li>
          <li>Learn how Google uses information from sites that use its services at <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">policies.google.com/technologies/partner-sites</a>.</li>
        </ul>
        <p>If you are in the European Economic Area, the United Kingdom or Switzerland, we ask for your consent before personalised advertising cookies are used, through a consent message shown on your first visit. You can change your choice at any time from the same message.</p>

        <h2>How long we keep information</h2>
        <p>We keep account and classroom information while your account is active and as long as your school or teacher needs it for their records. Face ID data is kept until you delete it or your account is deleted. Logs are kept for a limited period for security. When information is no longer needed, we delete or anonymise it.</p>

        <h2>Your choices and rights</h2>
        <ul>
          <li>Update your name and mobile number in Settings.</li>
          <li>Turn classroom email notifications on or off in Settings.</li>
          <li>Delete your Face ID data in Settings at any time.</li>
          <li>Ask us for a copy of your data, or to correct or delete it, by contacting us at <Contact />. Depending on where you live, you may have further rights, including the right to complain to your data protection authority.</li>
        </ul>

        <h2>Children</h2>
        <p>NeuroClass is used in schools and colleges. Where a student is under the age at which they can consent under local law, their school or a parent or guardian is responsible for giving any required consent. Ads on our public pages are not directed at children, and we do not knowingly use children’s information for personalised advertising.</p>

        <h2>Security</h2>
        <p>Data is encrypted in transit. Access to classroom data is restricted by database rules so that people can only see what their role allows. No system is perfectly secure, so please use a strong password and tell us about anything suspicious.</p>

        <h2>Changes to this policy</h2>
        <p>We’ll update this page when our practices change and change the “Last updated” date. For significant changes, we’ll let signed-in users know.</p>
      </Prose>
    </PublicPage>
  );
};

/* -------------------------------------------------------------------------- */

export const TermsPage: React.FC = () => {
  usePageMeta({ title: 'Terms of service', description: 'The terms for using NeuroClass as a teacher or student.', path: '/terms' });
  return (
    <PublicPage title="Terms of service" meta={`Last updated ${updated}`} intro={`These terms apply when you use ${SITE.name}. By creating an account or using the service, you agree to them.`}>
      <Prose>
        <h2>Using NeuroClass</h2>
        <p>You must give accurate information when you sign up and keep your password private. You are responsible for activity on your account. If you use NeuroClass through a school or college, you must also follow its rules.</p>

        <h2>Teachers</h2>
        <ul>
          <li>You are responsible for the classrooms, tests, assignments and materials you create, and for having the right to upload any materials you share.</li>
          <li>You choose which integrity checks apply to a test. You agree to treat proctoring and attendance signals as aids to your judgement, not as proof, and to give students a fair chance to explain or appeal.</li>
          <li>You must have a lawful basis and any required consent, including from your institution, to use Face ID, location and proctoring features with your students.</li>
        </ul>

        <h2>Students</h2>
        <ul>
          <li>Do your own work in tests and assignments unless your teacher says otherwise.</li>
          <li>Don’t try to get around integrity checks, access other people’s accounts, or interfere with the service.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>Don’t use NeuroClass to upload unlawful, harmful or infringing content, to harass anyone, to probe or attack the service, to run code that is not part of a coding question, or to collect other users’ information without permission.</p>

        <h2>Your content</h2>
        <p>You keep ownership of the content you create or upload. You give us permission to store, process and display it only as needed to provide the service to you and the classrooms you belong to.</p>

        <h2>AI features</h2>
        <p>The class assistant and question tools use an AI model. Their output can be wrong; teachers should review generated questions, and students should check answers against their class materials.</p>

        <h2>Availability and changes</h2>
        <p>We work to keep NeuroClass available and secure, but we can’t promise it will always be uninterrupted or error-free. We may change or stop features, and we’ll give notice of significant changes where we can.</p>

        <h2>Suspension</h2>
        <p>We may suspend or close accounts that break these terms or put other users or the service at risk.</p>

        <h2>Liability</h2>
        <p>The service is provided “as is” to the extent the law allows. We are not liable for indirect or consequential losses. Nothing in these terms limits rights you have under consumer law that cannot be limited.</p>

        <h2>Privacy</h2>
        <p>Our <Link to="/privacy">privacy policy</Link> explains how we handle personal information.</p>

        <h2>Contact</h2>
        <p>Questions about these terms: <Contact />.</p>
      </Prose>
    </PublicPage>
  );
};

/* -------------------------------------------------------------------------- */

export const NotFoundPage: React.FC = () => {
  usePageMeta({ title: 'Page not found', noindex: true });
  return (
    <PublicPage title="Page not found" intro="The page you were looking for doesn’t exist or has moved.">
      <div className="flex flex-wrap gap-3">
        <Link to="/" className={buttonClasses('primary')}>Go to the home page</Link>
        <Link to="/help" className={buttonClasses('outline')}>Browse the guides</Link>
      </div>
    </PublicPage>
  );
};
