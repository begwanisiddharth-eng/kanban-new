# Kanban Project

## Business Requirements

The app is a Kanban MVP with user accounts. Each user has up to 3 boards; every board has exactly 5 renamable columns and cards that can be added, edited, deleted and dragged between columns. Changes are saved explicitly.

**Accounts**

- A new user signs up with an email and a password (at least 8 characters). Emails are unique, case-insensitive.
- An existing user signs in with email and password, and can sign out.
- Signed-out visitors only see the sign-in and sign-up pages. Each user sees only their own boards.

**Boards**

- A user has between 1 and 3 boards. A new user starts with one empty board named "My board".
- A user can create a new board (a name is required, up to 60 characters). New boards are empty and have the default columns.
- A user can switch between their boards with a board switcher. The open board is kept in the URL, so a reload reopens it.
- A user can delete a board after confirmation, but never their only board.
- Every board always has exactly 5 columns. Columns cannot be added, removed or reordered.
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
- Sharing boards, teams or roles; password reset or email verification
- Renaming boards
- Labels, due dates, assignees, attachments, comments

## Technical Details

The project has three parts at the root: a client-rendered Next.js app in `frontend/`, an Express API server in `backend/`, and the SQLite database file in `data/`. In production the backend serves both the API (`/api`) and the frontend's static export from one origin. In development the Next.js dev server proxies `/api` to the backend.

| Area             | Choice                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Location         | `frontend/`, `backend/` and `data/` in the project root                                                                                  |
| Framework        | Next.js 15 (App Router) with React 19                                                                                                    |
| Rendering        | Client-side: board UI in `"use client"` components; static export (`output: "export"`)                                                   |
| Backend          | Express 5 on Node.js, run with `tsx`                                                                                                     |
| Database         | SQLite via better-sqlite3; file `data/kanban.db` (override with `DATABASE_PATH`)                                                         |
| Auth             | scrypt password hashes; random session token in an httpOnly, SameSite=Lax cookie; only a SHA-256 of the token is stored; 30-day sessions |
| Validation       | zod on every API input                                                                                                                   |
| Language         | TypeScript (strict mode)                                                                                                                 |
| Styling          | Tailwind CSS v4, colors defined as theme tokens                                                                                          |
| UI components    | shadcn/ui (Radix UI primitives)                                                                                                          |
| Icons            | lucide-react                                                                                                                             |
| Drag and drop    | @dnd-kit/core + @dnd-kit/sortable                                                                                                        |
| State            | Zustand store per open board, provided through React context                                                                             |
| IDs              | `crypto.randomUUID()`                                                                                                                    |
| Unit tests       | Vitest + React Testing Library (frontend), Vitest + Supertest (backend)                                                                  |
| End-to-end tests | Playwright                                                                                                                               |
| Lint / format    | ESLint (`next/core-web-vitals` in frontend, typescript-eslint in backend) + Prettier                                                     |
| Package manager  | npm                                                                                                                                      |

**Data model**

```ts
type Card = { id: string; title: string; details: string };
type Column = { id: string; name: string; cardIds: string[] };
type Board = {
  columns: [Column, Column, Column, Column, Column];
  cards: Record<string, Card>;
};
```

SQLite tables: `users` (id, email, password_hash), `sessions` (id = token hash, user_id, expires_at) and `boards` (id, user_id, name, data = `Board` as JSON, timestamps).

**API** (JSON; all `/api/boards` routes require a session and only touch the caller's boards)

| Method and path          | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `POST /api/auth/signup`  | Create account, its empty "My board" and a session  |
| `POST /api/auth/signin`  | Start a session                                     |
| `POST /api/auth/signout` | End the session                                     |
| `GET /api/auth/me`       | Current user, or 401                                |
| `GET /api/boards`        | List boards (`{ id, name }`), oldest first          |
| `POST /api/boards`       | Create an empty board (`{ name }`); 409 at 3 boards |
| `GET /api/boards/:id`    | Board with its data                                 |
| `PUT /api/boards/:id`    | Save board data (validated `Board`)                 |
| `DELETE /api/boards/:id` | Delete a board; 409 if it is the user's only board  |

**Project structure**

```
<project root>/
  AGENTS.md, CLAUDE.md, README.md, PLAN.md, .gitignore, package.json (scripts for both apps)
  data/             SQLite database (contents gitignored)
  backend/
    src/            server.ts, app.ts, db.ts, auth.ts, password.ts, sessions.ts, users.ts, boards.ts, schema.ts, emptyBoard.ts
    src/routes/     auth.ts, boards.ts
    test/           Vitest + Supertest specs
  frontend/
    app/            layout.tsx, page.tsx (board), signin/, signup/, globals.css (Tailwind + theme tokens), icon.svg
    components/     BoardApp, BoardToolbar, BoardSwitcher, NewBoardDialog, UnsavedChangesDialog, AuthForm, BoardSkeleton,
                    Board, Column, ColumnTitle, Card, CardBody, CardEditor, CardForm, ConfirmDialog (+ *.test.tsx)
    components/ui/  shadcn/ui components (button, dialog, alert-dialog, input, textarea, label, select)
    hooks/          useBoardDnd.ts (drag and drop), useBoardSession.ts (save, discard, switch, create, delete, unsaved guard)
    lib/            api.ts (typed API client), utils.ts (`cn`)
    store/          boardStore.ts (Zustand store factory), BoardStoreProvider.tsx, boardStore.test.ts
    types/          board.ts
    tests/          fixtures/ (sample board), renderBoard.tsx, e2e/ (Playwright specs and helpers)
```

**Commands**

From the project root:

- `npm run setup` installs dependencies for the root, backend and frontend
- `npm run dev` runs the backend (port 4000) and the Next.js dev server (port 3000) together; open port 3000
- `npm run build` then `npm start` builds the frontend and serves the whole app from the backend on port 4000
- `npm test`, `npm run lint` and `npm run test:e2e` run the checks for both packages

Inside `backend/` or `frontend/`, `npm test`, `npm run lint` and `npm run format` work per package. `frontend/`'s `npm run test:e2e` builds the frontend and starts the backend on port 3100 with a throwaway database.

**Implementation notes**

- Store actions trim input and ignore a blank title, details or column name; the UI also blocks blank input (Save disabled, rename reverts). The backend validates the whole board again on save.
- Unsaved changes are detected by comparing the working board with the last saved snapshot, so undoing an edit by hand or dropping a card where it was is not a change.
- `markSaved` records the data that was actually sent, so edits made while a save is in flight stay unsaved.
- The store is created per board and provided through context rather than as a module-level global.
- During a drag, `useBoardDnd` keeps a local preview of the columns and commits once with `moveCard` on drop, so a cancelled drag (Escape) leaves the store untouched.
- Mouse drags start after 6px, touch drags after a 200ms press; keyboard drags use Space/Enter, arrow keys and Escape.
- The drag overlay tilt is applied to an inner element. Rotating the measured overlay node inflates its rect and breaks keyboard moves between columns.
- Dialogs are rendered as siblings of a card's `<li>`, not inside it, so key events in the dialog never reach the drag listeners.
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
