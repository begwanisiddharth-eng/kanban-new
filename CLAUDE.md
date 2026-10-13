# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the authoritative spec: business requirements, stack, data model, API, project structure, color tokens and coding standards. Read it in full before starting work. This file only adds what `AGENTS.md` doesn't cover.

## Commands

From the project root: `npm run setup` once, then `npm run dev` (backend on 4000, frontend on 3000), `npm test`, `npm run lint`, `npm run test:e2e`. Inside a package, run a single test file with `npm test -- <path>`; in `frontend/`, a single Playwright spec with `npm run test:e2e -- <path>`.

## Architecture

- `backend/` is the only thing that touches the database. Every board query filters by the signed-in user's id; keep it that way for any new query.
- The frontend never talks to SQLite or reads cookies; it calls `/api` through `frontend/lib/api.ts`. The session cookie is httpOnly.
- `frontend/app/page.tsx` loads the user, board list and open board, then mounts `BoardStoreProvider` (one Zustand store per open board) around `BoardApp`.
- Board edits only change the store. `hooks/useBoardSession.ts` owns saving, discarding, switching, creating and deleting boards, and the unsaved-changes guard; route new "leave this board" actions through its `guard`.
- Board data is validated twice: store actions reject blank input, and `backend/src/schema.ts` validates the full board on save. Change both together.
- E2E tests sign up a fresh user per test and seed boards through the API (`tests/e2e/helpers.ts`), so they never depend on each other.
