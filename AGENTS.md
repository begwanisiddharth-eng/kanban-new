# Kanban Project

## Business Requirements

The app is a Kanban MVP with user accounts. Each user has up to 3 boards; every board has 1 to 5 columns that can be renamed, added and removed, and cards that can be added, edited, deleted and dragged between columns. Changes are saved explicitly. A board assistant (an LLM chat panel) can answer questions about the open board and edit it.

**Accounts**

- A new user signs up with an email and a password (at least 8 characters). Emails are unique, case-insensitive.
- An existing user signs in with email and password, and can sign out.
- A signed-in user can change their password by entering the current one and a new one (at least 8 characters). There is no other reset.
- An account has at most one active session. A sign-in while another session is active is refused (409) with a message; the user must sign out there or wait for it to time out.
- A session ends after 20 minutes of inactivity. The client warns at 18 minutes with **Stay signed in** / **Sign out**, then signs out and shows the reason on the sign-in page.
- Signed-out visitors only see the sign-in and sign-up pages. Each user sees only their own boards.

**Boards**

- A user has between 1 and 3 boards. A new user starts with one empty board named "My board".
- A user can create a new board (a name is required, up to 60 characters). New boards are empty and have the default columns.
- A user can switch between their boards with a board switcher. The open board is kept in the URL, so a reload reopens it.
- A user can delete a board after confirmation, but never their only board.
- A board has 1 to 5 columns. A new board starts with the five defaults. **Add column** (a tile after the last column, shown only below five) adds an empty column at the end; the remove button in a column's footer removes it with its cards, after a confirm when it has any, and is disabled on the last column. Columns cannot be reordered. Adding and removing are unsaved edits like any other; names are 1 to 60 characters.
- After removing a column, keyboard focus moves to the neighbouring column's remove button; after adding one, to the new column's title (the tile may be gone).
- Each column has a name that the user can rename inline. A column name cannot be empty.
- Default column names: Backlog, To Do, In Progress, Review, Done.
- There is no sample data. Boards start empty.

**Cards**

- Each card has a **Title**: single-line text that wraps visually when long. Title is required.
- Each card has **Details**: multi-line text that wraps. Details is required.
- A user can add a new card to any column.
- A user can edit a card's title and details. The user should not be able to leave the title or details blank
- A user can delete a card. Deletion asks for confirmation.
- A user can drag a card to a different position in the same column or into another column.
- Card order within each column is preserved.

**Board assistant**

- A chat panel sits to the right of the columns, about three quarters of the column height. On a maximized laptop browser (1280 px and wider) columns and panel share one row with no wrap; narrower screens scroll the columns and stack the panel below.
- Columns have a fixed height and scroll their cards; cards have a fixed height, clamping long titles and details.
- The assistant sees the open board (including unsaved edits) and the conversation. It can add, edit, move and delete cards, and add, rename and remove columns, within the same 1-to-5 limit. Its edits are applied as unsaved changes, exactly like the user's.
- Each board has its own conversation, kept in memory only and cleared on board switch, reload or **Clear conversation**.
- The model is fixed: `openai/gpt-4o-mini` through LiteLLM, with `OPENAI_API_KEY`. Failed calls are retried with exponential backoff (tenacity).

**Saving**

- Edits (column names, cards, card order) change a working copy of the board. They are stored only when the user clicks **Save**.
- The toolbar shows "Unsaved changes" or "All changes saved".
- **Save** and **Discard changes** are enabled only while there are unsaved changes. Discard asks for confirmation, then restores the last saved board.
- **New board** is disabled at 3 boards. **Delete board** is disabled when the user has 1 board.
- All toolbar buttons are disabled while a request is in flight.
- Switching board, creating a board or signing out with unsaved changes opens a dialog: **Save and continue**, **Discard changes** or **Cancel**. Deleting the open board needs no such prompt, since its changes go with it.
- Reloading or closing the tab with unsaved changes shows the browser's leave-page warning. Browsers do not allow custom buttons there.

**Out of scope (do not build)**

- Archiving cards
- Search or filtering
- Sharing boards, teams or roles; password reset by email or email verification
- Renaming boards
- Labels, due dates, assignees, attachments, comments

## Technical Details

The project has four parts at the root: a client-rendered Next.js app in `frontend/`, an Express API server in `backend/`, a Python assistant service in `chat/`, and the SQLite database file in `data/`. In production the backend serves both the API (`/api`) and the frontend's static export from one origin. In development the Next.js dev server proxies `/api` to the backend. The backend proxies `/api/chat` to the chat service (`CHAT_URL`, default `http://127.0.0.1:8000`); the browser never reaches it directly. Secrets live in the root `.env` (gitignored; `.env.example` lists the keys), which both the backend and the chat service load.

| Area             | Choice                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location         | `frontend/`, `backend/`, `chat/` and `data/` in the project root                                                                                           |
| Framework        | Next.js 15 (App Router) with React 19                                                                                                                      |
| Rendering        | Client-side: board UI in `"use client"` components; static export (`output: "export"`)                                                                     |
| Backend          | Express 5 on Node.js, run with `tsx`                                                                                                                       |
| Database         | SQLite via better-sqlite3; file `data/kanban.db` (override with `DATABASE_PATH`)                                                                           |
| Auth             | scrypt password hashes; random session token in an httpOnly, SameSite=Lax cookie; only a SHA-256 of the token is stored; one session per user, 20 min idle |
| Validation       | zod on every API input                                                                                                                                     |
| Assistant        | Python 3.12+ with uv; FastAPI, LiteLLM (`openai/gpt-4o-mini`, JSON mode), pydantic, tenacity; pytest and ruff                                              |
| Language         | TypeScript (strict mode)                                                                                                                                   |
| Styling          | Tailwind CSS v4, colors defined as theme tokens                                                                                                            |
| UI components    | shadcn/ui (Radix UI primitives)                                                                                                                            |
| Icons            | lucide-react                                                                                                                                               |
| Drag and drop    | @dnd-kit/core + @dnd-kit/sortable                                                                                                                          |
| State            | Zustand store per open board, provided through React context                                                                                               |
| IDs              | `crypto.randomUUID()`                                                                                                                                      |
| Unit tests       | Vitest + React Testing Library (frontend), Vitest + Supertest (backend)                                                                                    |
| End-to-end tests | Playwright                                                                                                                                                 |
| Lint / format    | ESLint (`next/core-web-vitals` in frontend, typescript-eslint in backend) + Prettier                                                                       |
| Package manager  | npm                                                                                                                                                        |

**Data model**

```ts
type Card = { id: string; title: string; details: string };
type Column = { id: string; name: string; cardIds: string[] };
type Board = {
  columns: [Column, Column, Column, Column, Column];
  cards: Record<string, Card>;
};
```

SQLite tables: `users` (id, email, password_hash), `sessions` (id = token hash, user_id unique, last_seen_at) and `boards` (id, user_id, name, data = `Board` as JSON, timestamps).

**API** (JSON; all `/api/boards` and `/api/chat` routes require a session and only touch the caller's boards; sign-in returns 409 while the account has an active session)

| Method and path            | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `POST /api/auth/signup`    | Create account, its empty "My board" and a session                      |
| `POST /api/auth/signin`    | Start a session                                                         |
| `POST /api/auth/signout`   | End the session                                                         |
| `GET /api/auth/me`         | Current user, or 401                                                    |
| `POST /api/auth/heartbeat` | Marks the session active (204)                                          |
| `POST /api/auth/password`  | Change password (`{ currentPassword, newPassword }`)                    |
| `POST /api/chat`           | Ask the assistant (`{ board, messages }`); returns `{ reply, actions }` |
| `GET /api/boards`          | List boards (`{ id, name }`), oldest first                              |
| `POST /api/boards`         | Create an empty board (`{ name }`); 409 at 3 boards                     |
| `GET /api/boards/:id`      | Board with its data                                                     |
| `PUT /api/boards/:id`      | Save board data (validated `Board`)                                     |
| `DELETE /api/boards/:id`   | Delete a board; 409 if it is the user's only board                      |

**Project structure**

```
<project root>/
  AGENTS.md, CLAUDE.md, README.md, PLAN.md, .gitignore, package.json (scripts for both apps)
  data/             SQLite database (contents gitignored)
  .env.example      keys for the root .env (OPENAI_API_KEY; .env itself is gitignored)
  backend/
    src/            server.ts, app.ts, db.ts, auth.ts, password.ts, sessions.ts, users.ts, boards.ts, schema.ts, emptyBoard.ts
    src/routes/     auth.ts, boards.ts, chat.ts
    test/           Vitest + Supertest specs
  chat/             pyproject.toml, uv.lock
    app/            main.py (FastAPI), assistant.py (prompt, LiteLLM call, retries, action filtering), models.py (pydantic)
    tests/          pytest specs (model mocked)
  frontend/
    app/            layout.tsx, page.tsx (board), signin/, signup/, globals.css (Tailwind + theme tokens), icon.svg
    components/     BoardApp, BoardToolbar, BoardSwitcher, NewBoardDialog, UnsavedChangesDialog, AuthForm, BoardSkeleton,
                    AccountMenu, ChangePasswordDialog, IdleWarningDialog, ChatPanel, ChatMessageList,
                    Board, Column, ColumnTitle, Card, CardBody, CardEditor, CardForm, ConfirmDialog (+ *.test.tsx)
    components/ui/  shadcn/ui components (button, dialog, alert-dialog, input, textarea, label, select, dropdown-menu)
    hooks/          useBoardDnd.ts (drag and drop), useBoardSession.ts (save, discard, switch, create, delete, unsaved guard, expiry),
                    useAssistantChat.ts (conversation), useIdleTimeout.ts (heartbeat, warning, sign-out)
    lib/            api.ts (typed API client), assistantActions.ts (applies assistant actions via store actions), utils.ts (`cn`)
    store/          boardStore.ts (Zustand store factory), BoardStoreProvider.tsx, boardStore.test.ts
    types/          board.ts, chat.ts
    tests/          fixtures/ (sample board), renderBoard.tsx, e2e/ (Playwright specs, helpers, fake-openai.mjs), live/ (specs against the real model)
```

**Commands**

From the project root:

- `npm run setup` installs dependencies for the root, backend and frontend, and `uv sync`s `chat/`
- `npm run dev` runs the backend (port 4000), the Next.js dev server (port 3000) and the chat service (port 8000, auto-reload) together; open port 3000
- `npm run build` then `npm start` builds the frontend and serves the whole app from the backend on port 4000, with the chat service on 8000
- `npm test`, `npm run lint` and `npm run test:e2e` run the checks for all three packages (pytest and ruff for `chat/`)

Inside `backend/` or `frontend/`, `npm test`, `npm run lint` and `npm run format` work per package. `frontend/`'s `npm run test:e2e` builds the frontend and starts the backend on port 3100 with a throwaway database, the chat service on 3101 and a fake OpenAI server (`tests/e2e/fake-openai.mjs`) on 3199 via `OPENAI_BASE_URL`, so e2e never calls the real model. Specs script the fake's answers to an exact message (`scriptModel` in `helpers.ts`: status, content, raw body, delay) and read back the requests the service sent (`modelCalls`). `npm run test:live` (in `frontend/`) runs `tests/live/` against the real OpenAI API with `OPENAI_API_KEY`, serially, checking the board rather than the wording; it is never part of `test:e2e`, and a full run uses about 15 requests. Inside `chat/`, run `uv run pytest` and `uv run ruff check .`.

**Implementation notes**

- Store actions trim input and ignore a blank title, details or column name; the UI also blocks blank input (Save disabled, rename reverts). The backend validates the whole board again on save.
- Unsaved changes are detected by comparing the working board with the last saved snapshot, so undoing an edit by hand or dropping a card where it was is not a change.
- `markSaved` records the data that was actually sent, so edits made while a save is in flight stay unsaved.
- The store is created per board and provided through context rather than as a module-level global.
- During a drag, `useBoardDnd` keeps a local preview of the columns and commits once with `moveCard` on drop, so a cancelled drag (Escape) leaves the store untouched.
- Mouse drags start after 6px, touch drags after a 200ms press; keyboard drags use Space/Enter, arrow keys and Escape.
- The drag overlay tilt is applied to an inner element. Rotating the measured overlay node inflates its rect and breaks keyboard moves between columns.
- Dialogs are rendered as siblings of a card's `<li>`, not inside it, so key events in the dialog never reach the drag listeners.
- Sessions: every authenticated request refreshes `last_seen_at`; a session idle for 20 minutes is deleted on next use and no longer blocks sign-in. The cookie has no max-age. The client sends a heartbeat at most once a minute while the user is active, so typing or dragging without saving keeps the session alive.
- Any 401 from the API sends the user to `/signin?reason=expired`; an idle timeout to `/signin?reason=timeout`.
- The assistant replies in JSON mode. The service reads the first JSON object even inside a code fence or prose; a reply with no object, or no message and no actions, is retried like a transient error. Each action is validated on its own (pydantic) against the board as the earlier actions in the reply leave it: a column name or unique card title is accepted in place of an id, `add_column` gets its id from the service (so later actions can fill the new column by name), `remove_column` takes the column's cards with it, the 1-to-5 limit is enforced, and invalid actions or ones naming unknown cards or columns are dropped, with "(N requested changes could not be applied.)" added to the reply. The client applies the rest through store actions, so blank input is still rejected.
- tenacity owns retries (exponential backoff with jitter, 1 to 20 s, but at least the wait a rate limit's "try again in Xs" asks for; 5 attempts, none started after 100 s, 45 s per request) so the service always answers inside the backend's 180 s timeout, which it reports as 504. LiteLLM is called with `num_retries=0` so retries do not multiply. Not retried: a rejected key (401, returns 503 naming `OPENAI_API_KEY`), a request over the plan's per-minute token limit ("Request too large", returns 413) and a rate limit asking to wait over 30 s, such as the daily cap (returns 429 with when to try again). The backend passes 503, 413 and 429 on; other failures become 502.
- The prompt sends the board with cards nested in their columns (each id once) plus `cardCount` per column and `totalCards`, because the model miscounted in long conversations. It asks for plain text (leftover `**` and `#` are stripped), names rather than ids in replies, details written by the model when the user gives none, the 60-character column name limit, and a reminder to click Save instead of claiming a save.
- The rate-limit handling above was tuned live on Groq's free tier (8,000 tokens a minute, 200,000 a day). OpenAI's limits depend on the account's usage tier. gpt-4o-mini has not yet been run live: it needs `OPENAI_API_KEY` and `api.openai.com` allowed.
- A reply that arrives after the user switched boards is ignored: the board store is shared, and the chat panel is keyed by board. History sent to the API is the last 40 messages, starting at a question, each clipped to 4,000 characters.
- Never commit API keys. `OPENAI_API_KEY` belongs only in the root `.env`.
- dnd-kit uses `pointerWithin` with a `rectIntersection` fallback and keeps the last target; the default `closestCorners` oscillated between columns and caused a render loop (React error #185).
- The session cookie is `Secure` only when `NODE_ENV=production`; run production behind HTTPS.
- shadcn/ui components were added as source by hand (the registry was unreachable from the build environment); add new ones with `npx shadcn add` when it is reachable.
- `@playwright/test` is pinned to match the installed Chromium; bump it together with `npx playwright install`.
- The accessibility spec runs axe-core (WCAG 2.1 AA) and excludes `.text-muted` from the contrast rule only, per the color scheme note below. Links use navy text with a blue underline, because `#209dd7` text fails contrast on the page background.

**Design**: simple but elegant. Generous whitespace, rounded cards with soft shadows, one clean sans-serif font (Inter via `next/font`), subtle hover and drag animations.

## Color Scheme

All colors are defined once as theme tokens in `frontend/app/globals.css`; components use the Tailwind token classes (`bg-accent`, `text-navy`), never raw hex values.

| Token               | Name             | Hex       | Used for                                                           |
| ------------------- | ---------------- | --------- | ------------------------------------------------------------------ |
| `--color-accent`    | Accent Yellow    | `#ecad0a` | Accent lines, highlights (column header underline, drop indicator) |
| `--color-primary`   | Blue Primary     | `#209dd7` | Link underlines, key sections, focus ring                          |
| `--color-secondary` | Purple Secondary | `#753991` | Submit buttons, important actions (Add card, Save)                 |
| `--color-navy`      | Dark Navy        | `#032147` | Main headings, card titles                                         |
| `--color-muted`     | Gray Text        | `#888888` | Supporting text, labels, card details                              |

- Neutrals: white card surfaces on a very light gray page background, with light gray borders.
- Light theme only for the MVP.
- `#888888` on white is below WCAG AA for small text (about 3.5:1). Use it only for labels and supporting text at 14px or larger.

## Strategy

- Write a plan with success criteria for each phase of the project. This plan will serve as a checklist, with items ticked off as they are completed. Include project scaffolding, usage of `.gitignore`, and rigorous unit testing.
- Execute the plan, ensuring all the criteria are met.
- There must be extensive integration testing carried out using Playwright or a similar technology, and all bugs must be fixed.
- You can consider work complete only when the MVP is finished and tested, and the server is up and running for the user.

## Coding Standards

**Principles**

- Use the latest libraries and the idiomatic approaches prevalent today.
- Do not engage in unnecessary defensive programming or excessive exception checks.
- Concision is valued. The README file should be pithy, and there should be no use of emojis.
- Do not build features beyond those specified in the business requirements. Keep it simple.

Code must be typed, tested, accessible and consistent with the conventions below.

**TypeScript and React**

- `strict: true`; no `any` and no `@ts-ignore` without a comment explaining why.
- Function components and hooks only; no class components.
- One component per file; file name matches the component (`CardEditor.tsx`).
- Naming: `PascalCase` components and types, `camelCase` functions and variables, `UPPER_SNAKE_CASE` constants.
- State changes go through Zustand store actions; components do not mutate state directly.
- Keep components under about 150 lines; extract subcomponents or hooks when larger.

**Styling**

- Use Tailwind utility classes and the color tokens; no inline styles except for drag transforms.
- Prefer shadcn/ui components over custom ones for buttons, dialogs and inputs.
- Long titles and details must wrap (`break-words`), never overflow the card.

**Accessibility**

- All controls are reachable and usable by keyboard, including drag and drop.
- Buttons and inputs have accessible labels; focus is always visible.

**Testing**

- Every store action has unit tests.
- Every business requirement has at least one Playwright test.
- Tests must pass before a change is merged.

**Git**

- Small, focused commits using Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`).
- No commented-out code or unused files committed.

---

The sections below are the original brief. Where they differ from the spec above, the spec above wins (in particular: accounts, up to 3 boards per user, empty starting boards, and boards saved to the backend).

## Business Requirements

- An MVP of a Kanban style Project Management application as a web app
- The web app should only have 1 board
- The board has fixed 5 columns that can be renamed
- Each card has a title and details only
- Drag and drop interface to move cards between columns
- Add a new card to a column; delete an existing card
- No more functionality: no archive, no search/filter. Keep it simple.
- The priority is a slick, professional, gorgeous UI/UX with very simple features
- The app should open with dummy data populated for the single board

## Technical Details

- Implemented as a modern NextJS app, client rendered
- The NextJS app should be created in a subdirectory `frontend`
- No persistence
- No user management for the MVP
- Use popular libraries
- As simple as possible but with an elegant UI

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Strategy

1. Write plan with success criteria for each phase to be checked off. Include project scaffolding, including .gitignore, and rigorous unit testing.
2. Execute the plan ensuring all critiera are met
3. Carry out extensive integration testing with Playwright or similar, fixing defects
4. Only complete when the MVP is finished and tested, with the server running and ready for the user

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
