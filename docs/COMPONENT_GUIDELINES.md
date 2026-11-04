# Component guidelines

How to build NeuroClass screens with `components/ui`. Tokens and rationale: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). See every component live at `/ui-kit`.

```tsx
import { Button, Card, CardHeader, Field, Input, StatusBadge, useToast, useConfirm } from '../../components/ui';
```

## Ground rules

1. **Use the kit; don't restyle it.** If a screen needs a variant the kit lacks, add it to the kit, not to the page.
2. **Use tokens, never raw colours.** `bg-surface`, `text-ink-2`, `border-line`, not `bg-white`, `text-slate-500`, `#1a73e8`. No `dark:` colour overrides: tokens already switch.
3. **No native dialogs.** `alert()` and `confirm()` are replaced by `useToast()` and `useConfirm()`.
4. **Every control has a name.** Visible label (`Field`) or, for icon-only, `IconButton label="…"`.
5. **One `<h1>` per page** (`PageHeader`). Sentence case. No uppercase or letter-spaced labels.
6. **Never fake it.** If the backend doesn't support something yet, don't render a control for it.

## Components

### Buttons: `Button`, `IconButton`

| Variant | When |
|---|---|
| `primary` | The single main action in an area (Publish, Save, Create test) |
| `secondary` | A prominent alternative (light-blue fill) |
| `outline` | Secondary actions next to a primary (Preview, Results) |
| `text` | Low-emphasis actions, Cancel, inline actions in cards |
| `danger` | Destructive confirmation only (inside a confirm dialog) |

Sizes `sm` 32 px, `md` 36 px (default), `lg` 44 px. Use `loading` while a request runs (keeps width, disables, sets `aria-busy`). Labels are verbs: "Create test", "Release results"; never "OK" or "Submit" alone. `IconButton` requires `label` (accessible name and native tooltip).

### Cards: `Card`, `CardHeader`, `CardFooter`, `Meta`

`Card variant="standard" | "interactive" | "flat"`, `padding="none" | "sm" | "md" | "lg"`, `as="section" | "article" | "li"`. Use `interactive` when the card opens something; `padding="none"` for edge-to-edge tables and banners.

Purpose-built cards:

| Component | Use |
|---|---|
| `StatCard` | A single number with label, optional trend badge and hint. Two per row at most. |
| `ClassroomCard` | Classroom grid: gradient cover, name, subject, teacher, upcoming work, student count, code, actions menu |
| `ClassroomBanner` | Cover strip at the top of a classroom workspace |
| `TestCard` / `AssignmentCard` | Classwork items: status, type, due date, duration, marks, optional stats strip, actions |
| `StudentCard` | Person row with avatar, contact, status |
| `ActivityCard` / `ActivityList` | One-column feed with actor avatar or status dot and relative time |
| `InfoCard` | Inline message: `info`, `success`, `warning`, `danger` (`danger` is announced as an alert) |
| `EmptyState` | What is empty, why, and the one action that fixes it |

### Status: `Badge`, `StatusBadge`

`StatusBadge status="submitted"` maps workflow states to fixed words and colours (submitted, pending, overdue, completed, active, present, absent, draft, scheduled, late, graded, …; see `STATUS` in `Badge.tsx`). Always use it for states, so the same word has the same colour on every page. `Badge tone="…"` is for non-state labels (Proctored, Coding, New).

### Forms

Wrap every control in `Field`: it renders the label, required or optional marker, hint and error, and wires `id`, `aria-describedby` and `aria-invalid` into the kit control inside.

```tsx
<Field label="Test title" required hint="Students see this in their list." error={titleError}>
  <Input value={title} onChange={…} onBlur={validate} />
</Field>
```

Controls: `Input` (with `leading` / `trailing`), `PasswordInput` (show/hide), `SearchInput` (clear button), `Textarea`, `Select` (native, styled), `DateInput` (native date / `withTime`), `Checkbox` (with `description`, `indeterminate`), `Radio` / `RadioGroup` (fieldset + legend), `Toggle` (`role="switch"`; for settings that apply immediately), `FileUpload` (drop zone, type, size and count validation, file list with remove).

Validation: validate on blur and on submit, clear the error as soon as the value becomes valid, and say how to fix it ("Enter a title for the test."), never just "Invalid".

### Navigation

| Component | Use |
|---|---|
| `AppShell` | Top bar + fixed sidebar (≥1024 px) + drawer; adds skip link and `<main id="main-content">` |
| `TopBar` | Brand, optional context title, search, notifications (count), theme or other `actions`, account `Dropdown` |
| `SidebarNav` | Labelled items in sections with separators; active = light-blue fill + `primary-dark` text, `aria-current="page"`; optional count badge |
| `NavDrawer` | Mobile navigation (focus moves in, Esc closes, closes on navigate) |
| `PageHeader` | Breadcrumbs, the page `<h1>`, description, actions |
| `Breadcrumbs` | Where you are: Dashboard › My classrooms › A4 › Tests |
| `Tabs` + `TabPanel` | Section switcher: arrow / Home / End keys, disabled tabs skipped, optional counts |

### Data

`DataTable` takes typed `columns` (`header`, `cell`, `align`, `hideOnMobile`), `rows`, `rowKey` and a `caption` (read by screen readers). Below 640 px it renders a stacked list instead of a scrolling table. Use `Table`/`THead`/`TBody`/`TR`/`TH`/`TD` for custom layouts. `Pagination` for long lists. `ProgressBar` for completion and attendance rates. `Avatar` for people (initials and colour from the name when there is no photo).

### Feedback

| Need | Use |
|---|---|
| Confirm an action | `const confirm = useConfirm(); if (await confirm({ title, body, confirmLabel, tone: 'danger' })) …` |
| Irreversible deletion | add `requireText: classroom.name`: the button stays disabled until it is typed; focus starts on Cancel |
| Report a result | `const toast = useToast(); toast.success('Test published.')`, `toast.error(…)`, `toast('…', { action: { label: 'Undo', onClick } })` |
| Custom dialog | `Modal` (`open`, `title`, `description`, `footer`, `size`): focus trap, restores focus, Esc and backdrop close, scroll lock, bottom sheet on phones |
| Hint on hover or focus | `Tooltip`: supplementary only; never the only place for important information |
| Menus | `Dropdown`: menu button with arrow keys, Home / End, Esc, click-outside |
| Loading | under 300 ms: nothing; inline: `Spinner inline`; page sections: `Skeleton`, `SkeletonText`, `SkeletonCard` |
| Section failed | `ErrorState` with `onRetry` |

`FeedbackProvider` is mounted once in `App.tsx`.

## Writing

- Sentence case for everything, including buttons, tabs and headings.
- Say what happened and what to do: "Couldn’t save. Check your connection and try again."
- Use people's words: "Grade", "Due", "Class code", not "Evaluation instance" or "Initiate".
- Errors never blame the user. Success messages are short.

## Accessibility checklist (per screen)

- [ ] One `<h1>` (`PageHeader`); headings in order.
- [ ] Every input in a `Field`; every icon-only button has a `label`.
- [ ] Keyboard: everything reachable with Tab, visible focus ring, no traps outside dialogs.
- [ ] Status is never colour-only (`StatusBadge` has a dot and text).
- [ ] No horizontal scrolling at 390 px; tap targets ≥ 40 px for primary controls.
- [ ] Works in dark mode without extra classes.
- [ ] `node scripts/ui-audit/kit.mjs` (or the page's own check) passes.

## Migrating a legacy screen

1. Replace layout chrome with `PageHeader`, `Card` and the grid rules.
2. Replace inline buttons, badges and inputs with kit components; delete `uppercase tracking-widest text-[10px]` patterns.
3. Replace Lucide icons with kit icons where an icon is still needed.
4. Remove the screen's reliance on the legacy global shadow rules (kit elements already opt out with `data-ui`).
5. Re-shoot with `scripts/ui-audit` and compare with `docs/ui-audit/before/`.
