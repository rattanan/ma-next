# Work Order UI design

## Information architecture

- `/work-orders`: one responsive workspace with List, Board and Calendar views; filters remain URL-ready and actions are permission-aware.
- `/work-orders/new`: manual create organized into Source, Work, Responsibility and Schedule sections.
- `/work-orders/:id`: clear header and status timeline; tabs Overview, Planning, Job Steps, Checklist, Labor, Materials, Tools, Safety & LOTO, Documents, Acceptance, Completion and History.
- Mobile execution emphasizes assigned work, Start, Backlog/Resume, task completion, labor/material/photo capture and completion submission with touch targets of at least 44px.

## States and accessibility

- Loading uses route skeletons; empty states explain the next valid action; errors are retryable; permission states retain readable context without rendering unauthorized controls.
- Forms use labels, inline errors, focus-visible controls and `aria-live` feedback. Tabs/buttons remain keyboard operable.
- Destructive/terminal commands require confirmation. Disabled commands include a visible reason.
- Unsaved form changes trigger an in-app navigation/browser warning where practical.
- Offline execution is not claimed; mobile UI states that a connection is required before submission.

The visual language reuses MA Next tokens/components: compact enterprise cards, slate surfaces, teal primary actions, semantic status badges and mobile-first responsive grids.
