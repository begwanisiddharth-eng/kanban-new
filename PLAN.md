# Kanban MVP Plan

Checklist of phases with success criteria. Ticked items are done and verified.

## Phase 1: Scaffolding

- [x] Next.js 15 (App Router, React 19, TypeScript strict) created in `frontend/`
- [x] Static export (`output: "export"`) builds with `npm run build`
- [x] Tailwind v4 with color theme tokens in `app/globals.css`; Inter via `next/font`
- [x] shadcn/ui setup (`components.json`, `lib/utils.ts`, button, dialog, alert-dialog, input, textarea, label)
- [x] Vitest + React Testing Library, Playwright, ESLint + Prettier configured
- [x] `.gitignore` covers `node_modules`, `.next`, `out`, Playwright reports, env files

## Phase 2: Data and store

- [x] Types in `types/board.ts` match the data model
- [x] Seed data: 5 default columns, 2-4 realistic cards each
- [x] Zustand store with `persist` to `localStorage` key `kanban-board-v1`
- [x] Actions: `renameColumn`, `addCard`, `updateCard`, `deleteCard`, `moveCard`; blank input rejected
- [x] Unit tests cover every store action and persistence

## Phase 3: UI

- [x] Board with exactly 5 columns, horizontally scrollable on small screens
- [x] Inline column rename (Enter/blur saves, Escape cancels, blank reverts)
- [x] Add and edit card in a dialog; Save disabled while title or details is blank
- [x] Delete card with confirmation dialog
- [x] Drag and drop within and across columns (pointer and keyboard), drag overlay, drop into empty column
- [x] Long titles and details wrap
- [x] Component tests for Board, Column (rename, add via CardEditor), Card (edit, delete via ConfirmDialog)

## Phase 4: End-to-end testing

- [x] Playwright spec for every business requirement, run against the static export (27 tests, stable over repeated runs)
- [x] axe-core accessibility audit of the board and card dialog
- [x] All defects found are fixed

## Phase 5: Polish and docs

- [x] Five build-review-improve iterations (log below)
- [x] `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` all pass
- [x] AGENTS.md updated; end-user README.md written
- [x] Server running for the user

## Iteration log

1. Core build reviewed via screenshots. Hidden card actions reserved space and squeezed titles; five columns overflowed at 1440px; touch drag fought page scroll. Fixed with overlay actions, narrower column minimum, mobile scroll snap, mouse plus delayed touch sensors.
2. Unit tests for every store action, persistence and the main component flows (22 tests). Replaced `vite-tsconfig-paths` with Vite's native path resolution; added root `.gitignore`.
3. Playwright suite for every requirement. Found and fixed a real defect: keyboard moves between columns failed because the tilted drag overlay inflated its measured rect. Screen reader announcements now report the actual drop position.
4. Visual polish: empty-column placeholder, rename input matched to title height so the header no longer shifts, custom app icon.
5. Accessibility: axe-core audit (only the spec-mandated `#888888` muted text falls below 4.5:1); focus returns to the column title after a keyboard rename. Docs updated.
