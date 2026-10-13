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

# Phase 6: Accounts and multiple boards

Decision: a separate Express server in `backend/` with SQLite (better-sqlite3) stored in `data/`, scrypt password hashes and an httpOnly session cookie. The frontend stays a client-rendered static export, served by the backend in production and proxied to it in development. localStorage persistence is retired; boards are saved to the database with an explicit Save.

## Server

- [x] SQLite schema: users, sessions, boards (board data stored as JSON); path from `DATABASE_PATH`, default `data/kanban.db` at the project root (gitignored)
- [x] Password hashing with scrypt and timing-safe comparison
- [x] Sessions: random token in an httpOnly, SameSite=Lax cookie; only its SHA-256 hash stored (since Phase 7: 20-minute idle timeout and one session per user)
- [x] Sign up, sign in, sign out and current-user endpoints with zod validation and clear errors
- [x] Board API: list, create (max 3 per user), read, save, delete (never the last board); every route scoped to the signed-in user
- [x] Backend tests for passwords, sessions, the board schema and the full API with Supertest (20 tests)

## Client

- [x] Sign-in and sign-up pages; signed-out users are redirected to sign in
- [x] A new user starts with one empty board ("My board", five default columns, no cards); sample data removed
- [x] Per-request Zustand store (context provider) holding the working board and the last saved snapshot; dirty = working differs from saved
- [x] Toolbar: board switcher, New board, Delete board, unsaved indicator, Discard changes, Save, account menu with Sign out
- [x] Button rules: Save and Discard enabled only when dirty; New board disabled at 3 boards; Delete board disabled with 1 board; all disabled while a request is in flight
- [x] Unsaved-changes dialog (Save and continue / Discard changes / Cancel) before switching board, creating a board, deleting a board or signing out
- [x] Browser prompt on reload or close while there are unsaved changes
- [x] Opened board kept in the URL (`?board=`) so a reload reopens it

## Testing and docs

- [x] Unit and component tests updated for the provider store, dirty tracking and the toolbar and unsaved-changes flows (30 tests)
- [x] Playwright: auth flows, empty first board, save/discard, unsaved prompts (switch, new board, sign out, reload), 3-board limit, delete board, data isolation between users, plus the existing card and column specs (47 tests, stable over repeated parallel runs)
- [x] AGENTS.md, CLAUDE.md and README.md updated

Defects found and fixed in this phase: the toolbar overflowed on phones; the sign-up/sign-in link (`#209dd7` text) failed WCAG contrast; an e2e race where navigating right after Sign out could cancel the sign-out request.

# Phase 7: Board assistant and account hardening

Decisions: the assistant is a separate Python service in `chat/` (FastAPI, LiteLLM with the fixed model `groq/openai/gpt-oss-120b`, tenacity for retries), reached only through the backend's `/api/chat`. It returns a reply plus board actions, which the client applies as unsaved edits. Password reset is limited to changing the password while signed in; a second sign-in is refused while a session is active; sessions end after 20 minutes of inactivity.

## Assistant service

- [x] `chat/` managed with uv; `GROQ_API_KEY` read from the root `.env` (gitignored, never committed); `.env.example` documents it empty
- [x] JSON-mode completion validated with pydantic; actions: add, update, move and delete card, rename column; actions with unknown ids dropped
- [x] Exponential backoff with jitter (tenacity, 5 attempts) on rate limits, timeouts, server errors and invalid replies; LiteLLM's own retries off
- [x] Clear 503 when the key is missing, 502 when the model fails after retries
- [x] pytest suite with the model mocked (13 tests); ruff lint and format

## Server

- [x] `POST /api/chat` proxies to the chat service for signed-in users only; 503 when it is not running
- [x] Sessions: `last_seen_at` refreshed on each request, expire after 20 minutes idle; `UNIQUE(user_id)` so a second sign-in gets 409; schema migrated with `PRAGMA user_version`
- [x] `POST /api/auth/heartbeat` and `POST /api/auth/password` (current password required)
- [x] Backend tests extended (30 tests)

## Client

- [x] Assistant panel to the right of the five columns, three quarters of the column height, one row with no wrap on a maximized laptop screen (verified at 1280, 1366 and 1920 px)
- [x] Fixed-height columns and fixed-height cards (titles and details clamped)
- [x] Assistant edits applied through store actions, shown as unsaved; one conversation per board
- [x] Account menu with email, Change password and Sign out
- [x] Idle tracking: heartbeat while active, warning dialog at 18 minutes, sign-out at 20 with a notice on the sign-in page; an expired session also returns to sign-in
- [x] Cross-column drag fixed (custom collision detection stopped a render loop)

## Testing and docs

- [x] Unit tests for assistant actions, the chat panel, the password dialog and idle timeout (47 tests)
- [x] Playwright against a fake Groq server: questions, moves, adds, retries after 503s, per-board conversations, layout and fixed card height, change password, single sign-in, idle warning and timeout (63 tests)
- [x] Root scripts run all three services; AGENTS.md, CLAUDE.md and README.md updated
- [ ] Live call to Groq: blocked by the environment's network policy (api.groq.com returns 403 from the proxy)
