# Kanban MVP Plan

Checklist of phases with success criteria. Ticked items are done and verified.

## Phase 1: Scaffolding

- [ ] Next.js 15 (App Router, React 19, TypeScript strict) created in `frontend/`
- [ ] Static export (`output: "export"`) builds with `npm run build`
- [ ] Tailwind v4 with color theme tokens in `app/globals.css`; Inter via `next/font`
- [ ] shadcn/ui setup (`components.json`, `lib/utils.ts`, button, dialog, alert-dialog, input, textarea, label)
- [ ] Vitest + React Testing Library, Playwright, ESLint + Prettier configured
- [ ] `.gitignore` covers `node_modules`, `.next`, `out`, Playwright reports, env files

## Phase 2: Data and store

- [ ] Types in `types/board.ts` match the data model
- [ ] Seed data: 5 default columns, 2-4 realistic cards each
- [ ] Zustand store with `persist` to `localStorage` key `kanban-board-v1`
- [ ] Actions: `renameColumn`, `addCard`, `updateCard`, `deleteCard`, `moveCard`; blank input rejected
- [ ] Unit tests cover every store action and persistence

## Phase 3: UI

- [ ] Board with exactly 5 columns, horizontally scrollable on small screens
- [ ] Inline column rename (Enter/blur saves, Escape cancels, blank reverts)
- [ ] Add and edit card in a dialog; Save disabled while title or details is blank
- [ ] Delete card with confirmation dialog
- [ ] Drag and drop within and across columns (pointer and keyboard), drag overlay, drop into empty column
- [ ] Long titles and details wrap
- [ ] Component tests for Column, Card, CardEditor, ConfirmDialog

## Phase 4: End-to-end testing

- [ ] Playwright spec for every business requirement, run against the static export
- [ ] All defects found are fixed

## Phase 5: Polish and docs

- [ ] Five build-review-improve iterations (log below)
- [ ] `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` all pass
- [ ] AGENTS.md updated; end-user README.md written
- [ ] Server running for the user

## Iteration log
