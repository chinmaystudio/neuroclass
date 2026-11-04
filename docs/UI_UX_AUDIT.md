# NeuroClass UI/UX audit (Phase 1)

**Date:** 2026-11-05 · **Scope:** every route and screen of the production frontend (`main` @ `8063ce0`).
**Method:** code inventory of `frontend/`, plus the real app rendered in Chromium with a mocked backend (a teacher with 3 classrooms, 8 students, 4 tests and 2 assignments; a student in 2 classrooms). Each screen was captured at desktop 1440×900, tablet 820×1180 and mobile (iPhone 13): 80 screenshots, 24 of them kept in [`docs/ui-audit/before/`](ui-audit/before/). The harness is in [`scripts/ui-audit/`](../scripts/ui-audit/README.md), so every phase can be re-shot for before/after comparison.

Severity: **P0** broken, misleading, or blocks a core task · **P1** strong usability cost on a frequent path · **P2** inconsistency or polish.

---

## 1. What exists today

| Area | Stack and structure |
|---|---|
| Framework | React 19, Vite 6, Tailwind CSS 4 (zero theme tokens; `index.css` is 69 lines), `motion`, `lucide-react`, `recharts` |
| Routing | 7 URL routes: `/`, `/teacher/*`, `/student/*`, and three mobile attendance hand-off routes. **Everything inside the dashboards is component state**, not URL. |
| Shell | Two separate fixed full-screen layouts (`InstructorDashboard`, `StudentDashboard`), each with its own hover-to-expand sidebar (`Sidebar.tsx`, `StudentSidebar.tsx`) and its own mobile bottom bar |
| Teacher nav | Dashboard · Classrooms · Attendance · Live Monitoring · Tests & Assignments · Proctoring · Analytics · Settings |
| Student nav | Dashboard · My Classes · Active Tests · Performance · History · Project Advisor · Classroom AI · Settings · Homepage · Logout |
| Classroom (teacher) | Header and tabs: Students · Tests · Assignments · Materials · Attendance · Proctoring · Settings |
| Classroom (student) | Banner and tabs: Tests · Assignments · Study materials · Attendance logs · Announcements |
| Newer modules | `features/` (tests, exam, coding, assignments, lms/ui): typed and API-backed, with a small shared kit (`Button`, `Card`, `Badge`, `Modal`, `Field`, `Toggle`, `Spinner`, `EmptyState`, `ErrorNote`, `useAsync`) |
| Legacy modules | `components/` (≈8,900 lines): screens styled one by one, each inlining its own Tailwind |

Largest files: `AttendanceSystem` 842, `TestPaperEvaluator` 774, `InstructorSettings` 758, `SecureExam` 507 lines.

---

## 2. P0 — broken, misleading or blocking

| # | Problem | Where | Evidence |
|---|---|---|---|
| 1 | **Instructor Settings is a fake page.** It shows a fictional profile ("Dr. Sarah Jenkins", "+1 (555) 382-9102", "Senior Professor…") instead of the signed-in teacher. It saves only to `localStorage`, and **none of the five settings groups is read anywhere else** (AI defaults, proctoring defaults, theme, payments). | `InstructorSettings.tsx` | [settings](ui-audit/before/desktop-15-teacher-settings.png) |
| 2 | **Teacher Analytics is always empty.** It reads only the `evaluations` produced by the AI paper and assignment evaluators, but **those evaluators are not reachable from any screen** (`TestPaperEvaluator` and `AssignmentEvaluator` are imported nowhere). It also ignores real test and assignment results. Cards read "0%", "N/A", "plagiarism thresholds safe". | `AnalyticsDashboard.tsx` | [analytics](ui-audit/before/desktop-14-teacher-analytics.png) |
| 3 | **"Live Monitoring" and "Proctoring" in the sidebar open the same standalone demo** ("Proctor Engine V4.0 · standalone offline analysis mode") that monitors nobody. Real live monitoring sits inside each test (Tests → Monitor). The demo also starts downloading an object-detection model on open and throws an **uncaught page error** when that fails. | `ProctoringSystem.tsx` | [live monitoring](ui-audit/before/desktop-12-teacher-live-monitoring.png) |
| 4 | **Navigation is not in the URL.** Refresh, back button, bookmarks and shared links all drop the user on the dashboard home, mid-task. A teacher grading submissions who refreshes loses their place. (Probe: URL unchanged after navigating, for both roles.) | Both dashboards | `a11y.mjs` |
| 5 | **Active sidebar item loses its label** when the sidebar is expanded: the selected item renders as a blue or purple bar with an icon only. | `Sidebar.tsx`, `StudentSidebar.tsx` | [teacher](ui-audit/before/desktop-13-teacher-tests-assignments.png), [student](ui-audit/before/desktop-31-student-my-classes.png) |
| 6 | **Student "Exam Release Alerts" toggle does nothing.** It is local state only; there is no notification system. | `StudentSettings.tsx` | [settings](ui-audit/before/desktop-37-student-settings.png) |
| 7 | **Dead or unreachable features.** `AIModuleDashboard` (its open flag is never set), `PaymentTimeline` and both AI evaluators are unreachable. Users cannot find features that exist, and the code still has to be maintained. | `App.tsx`, `components/evaluation/*` | code |
| 8 | **Teachers cannot sign out from the dashboard.** The only sign-out control is in the public `Navbar`, which the full-screen teacher dashboard (`fixed inset-0 z-[60]`) covers. The sidebar's footer arrow looks like the exit but has no `onClick`. Students have Logout in their sidebar. **Fixed during the audit:** the button now signs out (desktop and mobile bar), verified in the harness. | `Sidebar.tsx:77` | [teacher](ui-audit/before/desktop-13-teacher-tests-assignments.png) |
| 9 | **Mobile page overflow.** The student classroom title runs past the screen edge (horizontal scroll). The bottom navigation crams 8 to 10 items into a scrolling strip with labels cut to "MY", "ACTIVE", "HISTOR", and it covers the bottom of content. | Student classroom, both bottom bars | [mobile class](ui-audit/before/mobile-31b-student-class-detail.png), [mobile home](ui-audit/before/mobile-30-student-home.png) |

## 3. Navigation and information architecture (P1)

- **Duplicate entries.** In the teacher sidebar, *Dashboard* = *Classrooms* (same list); *Live Monitoring* = *Proctoring* (same demo); *Tests & Assignments* shows the classroom list again behind an explanatory banner; *Attendance* also asks you to pick a classroom first. Half of the 8 items lead to the same classroom picker.
- **No real teacher dashboard.** There is no overview of upcoming tests, work to grade or recent activity; the first screen is the classroom grid.
- **Icon-only collapsed sidebar** with no tooltips (hover-to-expand, which doesn't exist on touch devices). The teacher sidebar's footer arrow button has **no click handler**: it only rotates on hover.
- **Inconsistent shells.** The student sidebar has the logo, "Homepage" and "Logout"; the teacher sidebar has no logo, no sign-out (see P0 #8) and no profile. Neither has a top bar, page title, breadcrumbs, profile menu or theme switch inside the app.
- **Classroom workspace naming** differs by role (teacher: Students/Materials; student: Study materials/Attendance logs/Announcements) and neither has a Stream, Classwork, People or Grades structure. Teachers have no announcement composer, although students have an "Announcements" tab.
- **Sign-in asks for a role** ("Student portal / Instructor portal") even though the role comes from the account; choosing the wrong tab is a common confusion.
- **Student labels disagree with page titles:** "Active Tests" opens "My tests"; "History" vs "Performance" split one concept across two pages.
- **Mobile teacher** has no visible way to reach Settings or sign out without scrolling the bottom strip.

## 4. Usability and feedback (P1)

- **Greeting uses the email prefix:** "Welcome back, arjun.mehta!" (the name is in the profile).
- **Destructive actions are one click away on every card** (red trash icon on each classroom) and use native `window.confirm`/`alert` dialogs, unlike the rest of the app.
- **Jargon and internal language** in user-facing copy: "Active instances", "Teacher-owned roster", "Warming engines…", "Launch HUD", "Multi-level attendance", "Unified Face ID template registered", "Initiate attendance".
- **Attendance screen** packs three modes, a location prompt, a dark "portal" explainer and two status banners above the fold, with the log on the right; it is hard to see what to do first.
- **Repeated headings:** the classroom title appears twice on the student classroom page (header and banner).
- **Wasted space:** student test cards render in a single narrow column on wide screens; the student dashboard spends roughly 30% of the first screen on a gradient banner.
- **Loading states** are a bare uppercase "LOADING…" for whole pages; no skeletons.
- **Class codes are generated in the browser** with `Math.random` (6 chars); a collision fails with a database error instead of retrying.

## 5. Visual consistency (P2, but systemic)

Measured across `.tsx` files:

| Signal | Count | Effect |
|---|---|---|
| Arbitrary pixel font sizes `text-[Npx]` | **327** | Mostly 9–10px uppercase labels; hard to read (14 text nodes under 11px on the student mobile home) |
| `uppercase` + `tracking-widest` | 369 / 274 | Shouting labels and buttons everywhere; reduces scanability |
| Radii in use | `rounded-lg/xl/2xl/3xl/full` + 30 arbitrary `rounded-[Npx]` | Cards, inputs and buttons each look different |
| Accent colours | blue (197), purple (133), indigo (26) | Teacher = blue, student = purple, landing = both; no single brand primary |
| Background glows / backdrop blur | 51 | Large blurred blobs and gradients behind every dashboard; costs GPU and contrast |
| `motion.` animations | 100 | Decorative motion on lists and cards; only 1 component honours `prefers-reduced-motion` |
| Design tokens | 0 | Every colour, size and radius is inline; dark mode is per-class `dark:` duplication |

Buttons alone come in at least five styles (pill-uppercase, square white, outlined pill, gradient, ghost). The landing CTA pair mixes a square and a pill button side by side.

## 6. Accessibility (WCAG 2.2 AA gaps)

- Two nested `<main>` landmarks in each dashboard; the teacher home has **no `<h1>`**.
- Icon-only controls without accessible names (1 on the teacher home, 3 on the student home); collapsed sidebar items depend on hover text.
- 9–10px uppercase text and low-contrast grey-on-white labels (`text-slate-400` on `slate-50`) fail AA contrast in many places.
- Tabs are `role="tab"` but lack arrow-key navigation and `aria-controls`.
- Native `confirm()` dialogs; custom modals don't consistently trap or restore focus.
- `prefers-reduced-motion` is ignored except in the particle background.
- Good: visible focus rings exist (26 `focus:` usages and Tailwind defaults); inputs have labels in the forms checked; the exam intro explains monitoring in plain language.

## 7. Responsive behaviour

| Viewport | Findings |
|---|---|
| Desktop | Works, but content is centred inside a 64px icon rail with large empty margins; tests and assignments use about 60% of the width |
| Tablet (820px) | Gets the desktop layout with a hover sidebar that can't be hovered on touch; the classroom grid drops to 2 columns |
| Mobile | Bottom strip with truncated labels; horizontal page overflow on the student classroom; the full-width gradient hero pushes all content below the fold; no app bar or title |

## 8. Duplicated components

| Concept | Implementations |
|---|---|
| App shell / sidebar | `Sidebar` + `StudentSidebar` (+ two bottom bars) |
| Classroom card / list | `ClassroomList` cards vs `EnrolledClasses` cards |
| Classroom page | `ClassroomDetail` vs `EnrolledClassDetail` (different tabs, header, styling) |
| Monitoring | `ProctoringSystem` demo vs `LiveMonitor` (real, inside a test) |
| Analytics | `AnalyticsDashboard` (evaluations) vs `TestResults` metrics vs `StudentPerformance` |
| Settings | `InstructorSettings` (fake) vs `StudentSettings` |
| Buttons / badges / modals | `features/lms/ui.tsx` kit vs inline per-component variants in all legacy screens |

## 9. Worth preserving

- **`features/lms/ui.tsx` kit** and the newer screens built on it: Tests list ([screenshot](ui-audit/before/desktop-21-classroom-tests.png)), test editor with stepped sections, assignment grading table ([screenshot](ui-audit/before/desktop-22b-assignment-submissions.png)), exam intro and consent ([screenshot](ui-audit/before/desktop-39-exam-intro.png)). These are clear, typed and honest; they become the base of the design system.
- **Exam environment and coding IDE:** already separate and distraction-free; they need visual alignment, not restructuring.
- **Classroom card concept** (avatar, name, code, count) and the student test status groups (Available now / Upcoming / Completed).
- **Attendance flows and their APIs** (Face ID, location, mobile hand-off): keep the behaviour and redesign only the layout and copy.
- Light theme default with an existing dark theme and a `ThemeContext`.

## 10. Pages requiring redesign, in order

1. **App shell:** one role-aware shell with URL routes, a top bar (title, breadcrumbs, profile menu, theme), a collapsible sidebar with tooltips, and a mobile drawer.
2. **Teacher home:** a real dashboard (quick actions, upcoming tests, to-grade, recent activity) from existing APIs.
3. **Classroom workspace (both roles):** Stream · Classwork · People · Attendance · Grades, with one component and role-based controls.
4. **Settings (both roles):** the real profile (`users` table), honest preferences, privacy and Face ID data controls; remove the fake fields.
5. **Analytics:** replace with real per-classroom results (tests and assignments); remove fabricated cards.
6. **Monitoring:** remove the standalone demo from navigation; link to each live test's monitor.
7. **Student home, tests, history and performance:** merge into one "Work" view (upcoming / due soon / submitted / graded) plus a "Grades" view.
8. **Attendance:** simplify the first screen to one primary action; move modes into a secondary control.
9. **Landing and auth:** single primary CTA style; sign-in without a role picker.
10. **Evaluators and AI tools:** either surface them under "AI tools" (wired to evaluations, so Analytics can use them) or remove them.

## 11. Backend capabilities the redesign needs that don't exist yet

These must not be faked in the UI (Phase 15 rule). Each needs a small API or table first, or must be marked unavailable:

| UI element in the spec | Status |
|---|---|
| Announcements / Stream posts | No table or API (the student "Announcements" tab shows attendance announcements only) |
| Notifications centre | No table, API or delivery |
| Calendar | Derivable from tests and assignments (`scheduled_*`, `due_at`); needs an aggregating endpoint |
| Global search | None |
| Teacher "recent activity" | Partly derivable from `assessment_audit_logs`; needs an endpoint |
| Profile photo upload | `users.photourl` exists; no upload endpoint |

---

### Next phase

Phase 2–3: write `docs/DESIGN_SYSTEM.md` (tokens: colour, type scale, spacing, radius, elevation, motion; light and dark), implement the tokens in Tailwind 4 `@theme`, and grow `features/lms/ui.tsx` into the shared component library. Then the app shell with URL routing (Phase 4). Screens will be re-shot with the same harness after each phase.
