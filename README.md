# Kanban

A Kanban board app with accounts, up to three boards per user, one to five columns per board, drag-and-drop cards, and an AI board assistant that can answer questions about your board and make changes for you. This file is a full manual: setup, day-to-day use, testing, and troubleshooting.

For the authoritative specification (business requirements, data model, API, coding standards) see `AGENTS.md`. For the build history and what's been tested see `PLAN.md` and `REVIEW.md`.

## Contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Using the app](#using-the-app)
- [Keyboard reference](#keyboard-reference)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

## Overview

The app has three parts, run together:

- **`frontend/`** — a client-rendered Next.js app (static export). All the board UI, including drag and drop and the assistant panel.
- **`backend/`** — an Express API server. The only part that touches the database. Owns accounts, sessions and board storage, and proxies assistant requests to the chat service.
- **`chat/`** — a stateless Python (FastAPI) service that calls OpenAI's `gpt-4o-mini` to answer questions about a board and propose edits to it. It never touches the database; the backend sends it the board and conversation with every request.

In production, the backend serves both the API and the frontend's static files from one origin (`npm start`, port 4000). In development, the Next.js dev server (port 3000) proxies API requests to the backend (port 4000), and both talk to the chat service (port 8000).

## Tech stack

| Area               | Choice                                                          |
| ------------------ | ---------------------------------------------------------------- |
| Frontend framework | Next.js 15 (App Router), React 19, TypeScript strict             |
| Backend            | Express 5 on Node.js, run with `tsx`                              |
| Database           | SQLite via `better-sqlite3`                                       |
| Auth                | scrypt password hashes; httpOnly session cookie; one session per user |
| Assistant service   | Python 3.12+, uv, FastAPI, LiteLLM (`openai/gpt-4o-mini`), pydantic, tenacity |
| Styling             | Tailwind CSS v4, theme-token colors                                |
| UI components       | shadcn/ui (Radix UI primitives), lucide-react icons                |
| Drag and drop       | @dnd-kit/core + @dnd-kit/sortable                                  |
| State               | Zustand, one store per open board                                   |
| Unit tests          | Vitest + React Testing Library (frontend), Vitest + Supertest (backend), pytest (chat) |
| End-to-end tests    | Playwright                                                          |

## Getting started

### Prerequisites

- Node.js 20 or later
- Python 3.12 or later
- [uv](https://docs.astral.sh/uv/)
- An OpenAI API key, for the board assistant (optional — the rest of the app works without one; see [Board assistant](#board-assistant))

### Install and configure

```bash
cp .env.example .env   # then add your OpenAI API key to OPENAI_API_KEY
npm run setup           # installs the root, backend and frontend npm packages, and uv-syncs chat/
```

`.env` lives at the project root, is read by both the backend and the chat service, and is gitignored — never commit it. It holds:

| Variable          | Required | Purpose                                                              |
| ------------------ | :------: | ------------------------------------------------------------------- |
| `OPENAI_API_KEY`   |    for the assistant | OpenAI key used for `/api/chat`. Without it, the rest of the app works; the assistant panel returns a 503 explaining it isn't set up. |
| `PORT`             |    no    | Backend port. Default `4000`.                                        |
| `CHAT_URL`         |    no    | Where the backend reaches the chat service. Default `http://127.0.0.1:8000`. |
| `OPENAI_BASE_URL`  |    no    | Points the assistant at another OpenAI-compatible server. Tests use this to point at a fake server, never the real API. |
| `DATABASE_PATH`    |    no    | SQLite file location. Default `data/kanban.db` at the project root. |

### Run it

**Production-style**, one origin on port 4000:

```bash
npm run build   # builds the frontend's static export
npm start        # starts the backend (serving the API and the built frontend) and the chat service
```

Open http://localhost:4000. Your data is stored in `data/kanban.db` (gitignored).

**Development**, with live reload on the frontend:

```bash
npm run dev
```

This runs the backend (4000), the Next.js dev server (3000, with `/api` proxied to the backend) and the chat service (8000, auto-reload) together. Open http://localhost:3000.

## Project structure

```
<project root>/
  AGENTS.md, CLAUDE.md, README.md, PLAN.md, REVIEW.md, .gitignore, package.json
  data/             SQLite database (gitignored)
  .env.example      keys for the root .env
  backend/
    src/            server.ts, app.ts, db.ts, auth.ts, password.ts, sessions.ts, users.ts, boards.ts, schema.ts, emptyBoard.ts
    src/routes/     auth.ts, boards.ts, chat.ts
    test/           Vitest + Supertest specs
  chat/             pyproject.toml, uv.lock
    app/            main.py (FastAPI), assistant.py (prompt, LiteLLM call, retries, action filtering), models.py (pydantic)
    tests/          pytest specs (model mocked)
  frontend/
    app/            layout.tsx, page.tsx (board), signin/, signup/, globals.css, icon.svg
    components/     BoardApp, BoardToolbar, Board, Column, Card and friends, ChatPanel, auth and dialog components (+ *.test.tsx)
    components/ui/  shadcn/ui components
    hooks/          useBoardDnd, useBoardSession, useAssistantChat, useIdleTimeout
    lib/            api.ts, assistantActions.ts, utils.ts
    store/          boardStore.ts, BoardStoreProvider.tsx
    types/          board.ts, chat.ts
    tests/          fixtures/, e2e/ (fake-model Playwright specs), live/ (real-model Playwright specs)
```

See `AGENTS.md` for the full data model, API routes and implementation notes behind each file.

## Using the app

### Accounts

**Create an account** with your email and a password of at least 8 characters. **Sign in** with the same details next time. Your boards are private to your account.

The account menu (the person icon at the top right) shows your email and has:

- **Change password**: enter your current password and a new one of at least 8 characters.
- **Sign out**.

**One sign-in at a time.** While your account is signed in somewhere, a new sign-in elsewhere is refused (409) until you sign out there, or until 20 minutes pass since it was last used.

**Inactivity.** After 20 minutes without activity you are signed out. At 18 minutes, a dialog lets you stay signed in. Unsaved changes are lost when a timeout happens, so save often. Any authenticated request counts as activity; the client also sends a heartbeat at most once a minute while you're active, even if you haven't saved.

There is no password reset by email. If you forget your password, the account cannot be recovered.

### Boards

Your first board, "My board", starts empty with the five default columns. You can have up to three boards.

- **Switch board** with the board menu at the top left.
- **New board** creates an empty board with your chosen name (up to 60 characters). The button is disabled once you have three boards.
- **Delete board** (the bin icon) deletes the open board after you confirm. You cannot delete your only board.
- The open board is kept in the URL (`?board=`), so a reload reopens the same one.

### Columns and cards

A new board starts with five columns: Backlog, To Do, In Progress, Review and Done. A board can have **one to five** columns.

- **Add a column** with the **Add column** tile after the last column (shown only when there are fewer than five). It's added at the end, empty.
- **Remove a column** with the bin icon at the bottom of the column. If it has cards, you confirm first, and the cards are removed with it. The last column can't be removed. Columns can't be reordered, and a removed column can't be brought back except with **Discard changes** before saving.
- **Rename a column** by clicking its name. Press Enter or click away to keep it, Escape to cancel. A name can't be empty, and is capped at 60 characters.
- **Add a card** with **Add card** at the bottom of a column. A title and details are both required.
- **Edit a card** by hovering (or focusing) it and clicking the pencil icon.
- **Delete a card** by hovering it and clicking the bin icon, then confirming.
- **Move a card** by dragging it within a column or to another column; card order within a column is preserved. On a touchscreen, press and hold briefly first.

### Board assistant

A chat panel sits to the right of the columns (below them on narrower screens). Ask it about the board ("What's in progress?") or ask for changes — it can add, edit, move or delete cards, and add, rename or remove columns, within the same 1-to-5 column limit.

Its edits land on the board immediately but are **unsaved**, exactly like your own: click **Save** to keep them, or **Discard changes** to undo them. Each board has its own conversation, kept in memory only — it's cleared when you switch board, reload, or click **Clear conversation** (the circular-arrow button).

Press Enter to send, Shift+Enter for a new line.

Behaviour worth knowing:

- It never claims to have saved the board for you — if you ask it to save, it reminds you to click Save.
- It writes card details itself if you don't give any.
- Replies are plain text, never Markdown.
- It refers to cards and columns by name, never by internal id.
- If a request is ambiguous or over a limit (a 6th column, a 61-character name), it explains why instead of guessing.
- If the model is busy or the call fails transiently, the service retries with backoff before reporting an error; if `OPENAI_API_KEY` isn't set, the panel reports that clearly (503) instead of hanging.

### Saving

Changes — column names, cards, card order, additions and removals — only change a working copy of the board. They're stored in the database only when you click **Save**.

| Button           | What it does                                     | Available when                    |
| ----------------- | ------------------------------------------------- | ----------------------------------- |
| Save              | Stores your changes                                | There are unsaved changes           |
| Discard changes   | Returns the board to how it was when last saved    | There are unsaved changes           |
| New board         | Creates an empty board                             | You have fewer than three boards    |
| Delete board      | Permanently deletes the open board                 | You have more than one board        |

All toolbar buttons are disabled while a request is in flight. If you switch board, create a board, or sign out with unsaved changes, a dialog asks: **Save and continue**, **Discard changes**, or **Cancel**. Deleting the open board needs no such prompt, since its changes go with it. Reloading or closing the tab with unsaved changes shows the browser's own leave-page warning.

## Keyboard reference

| Action              | Keys                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Move between items   | Tab / Shift+Tab                                                       |
| Pick up a card       | Focus the card, press Space                                           |
| Move a picked card   | Arrow keys (up/down within a column, left/right across columns)       |
| Drop / cancel        | Space / Escape                                                        |
| Rename a column      | Focus the column name, press Enter; Enter/blur commits, Escape cancels |

All controls are reachable and usable by keyboard, including drag and drop; focus is always visible and moves somewhere sensible after removing or adding a column.

## Testing

From the project root:

```bash
npm test          # backend (Vitest + Supertest), frontend (Vitest + RTL), chat (pytest)
npm run lint       # ESLint + Prettier (backend, frontend), ruff check + format --check (chat)
npm run test:e2e   # Playwright, against a scripted fake OpenAI server — never calls the real model
```

Inside a package: `npm test -- <path>` for a single file (backend/frontend); `npm run test:e2e -- <path>` for a single Playwright spec (frontend); `uv run pytest <path>` for a single pytest file (chat). Behind a TLS-intercepting proxy, set `UV_SYSTEM_CERTS=1` for `uv`.

### Testing the assistant against the real model

`frontend/tests/live/` runs the same kinds of checks as the e2e suite, but against the real OpenAI API, asserting on the resulting board state rather than the model's exact wording (which varies run to run). It needs `OPENAI_API_KEY` **exported in the shell**, not just present in `.env` — the Playwright config loads `.env` itself for its own process, but your shell's environment is what ends up being visible to it if you also export it there:

```bash
cd frontend
npm run test:live
```

This sends on the order of 15 requests to the real API, runs serially to stay inside rate limits, and is never part of `npm run test:e2e`. See `REVIEW.md` for the latest live-model run and its one known, non-deterministic finding (the model sometimes declines to add a card near-duplicate to an existing one, which one of the ten live specs doesn't account for — not an application bug).

## Troubleshooting

- **"The assistant is not set up yet"** — `OPENAI_API_KEY` is missing from `.env`. Add it and restart the chat service.
- **"The assistant is not running"** — the chat service isn't up. Run `npm run dev` or `npm start` from the root, which starts it alongside the backend.
- **"This account is already signed in somewhere else"** — sign out there, or wait until 20 minutes after it was last used.
- **Signed out unexpectedly** — either 20 minutes of inactivity passed, or your session expired some other way (e.g. the server restarted). Sign in again.
- **Unsaved changes warning won't go away** — click **Save** or **Discard changes**; the browser's own reload/close warning only appears while there's something unsaved.
- **Live assistant tests report "skipped"** — `OPENAI_API_KEY` isn't visible to the shell running `npm run test:live`; export it there (see [above](#testing-the-assistant-against-the-real-model)).

## Limitations

Deliberately out of scope for this app:

- Archiving cards, search or filtering
- Sharing boards, teams or roles
- Password reset by email, or email verification
- Renaming boards
- Labels, due dates, assignees, attachments, comments
- Reordering columns, or restoring a single removed column other than via **Discard changes** before saving

See `AGENTS.md` for the full specification.
