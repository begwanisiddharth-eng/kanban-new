# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repo currently contains only the spec (`AGENTS.md`) — the `frontend/` Next.js app has not been scaffolded yet. Read `AGENTS.md` in full before starting work; it is the authoritative spec for business requirements, technical stack, data model, project structure, color tokens, and coding standards. Do not duplicate its content here — this file only adds what `AGENTS.md` doesn't cover.

## Commands

All commands run from `frontend/` (once scaffolded):

- `npm run dev` — start the dev server
- `npm run build` — build the static export
- `npm test` — run unit tests (Vitest + React Testing Library)
- `npm run test:e2e` — run Playwright end-to-end tests
- `npm run lint` — run ESLint and Prettier checks

To run a single unit test file: `npm test -- <path-to-test>`. To run a single Playwright spec: `npm run test:e2e -- <path-to-spec>`.

## Architecture (once scaffolded)

- Single Zustand store (`store/boardStore.ts`) with the `persist` middleware is the sole source of truth for board state (columns, cards, order); components read from it and call its actions rather than mutating state directly. Persisted to `localStorage` under key `kanban-board-v1`.
- The `Board` type holds a fixed 5-element tuple of `Column`s plus a `cards` record keyed by id — columns never store full card objects, only `cardIds` order arrays. Any change to card order or column membership is a store action that updates these arrays, not direct array splicing in components.
- Dummy seed data (`store/seedData.ts`) is only used to initialize the store on first launch (no saved `kanban-board-v1` in localStorage); after that the persisted state takes over.
- Drag and drop (`@dnd-kit/core` + `@dnd-kit/sortable`) moves cards both within a column's order array and across columns' `cardIds`/`cards` record — both cases go through the same store actions so order is preserved consistently.
- The app is fully client-rendered with static export (`output: "export"`) — no server components holding state, no backend/API routes.
