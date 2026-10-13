# Kanban Project

## Business Requirements

The app is an MVP comprising a single Kanban board with exactly 5 renamable columns and cards that can be added, edited, deleted and dragged between columns.

**Board**

- There is one board only. No board list, board switcher or board creation.
- The board always has exactly 5 columns. Columns cannot be added, removed or reordered.
- Each column has a name that the user can rename inline. A column name cannot be empty.
- Default column names: Backlog, To Do, In Progress, Review, Done.

**Initial data**

- The app opens with dummy data already populated: every column holds 2–4 sample cards with realistic titles and details.
- Dummy data loads on first launch, when no saved board exists. After that, the saved board is shown instead.

**Cards**

- Each card has a **Title**: single-line text that wraps visually when long. Title is required.
- Each card has **Details**: multi-line text that wraps. Details is required.
- A user can add a new card to any column.
- A user can edit a card's title and details. The user should not be able to leave the title or details blank
- A user can delete a card. Deletion asks for confirmation.
- A user can drag a card to a different position in the same column or into another column.
- Card order within each column is preserved.

**Persistence**

- The board state (column names, cards, card order) survives a page reload.

**Out of scope (do not build)**

- Archiving cards
- Search or filtering
- Multiple boards, user management, login or sharing (the MVP assumes a single user)
- Labels, due dates, assignees, attachments, comments



## Technical Details

The app is a modern, client-rendered Next.js app in the `frontend/` subdirectory of the project root. It uses popular, well-maintained libraries and saves state in browser localStorage. There is no backend for the MVP.


| Area             | Choice                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- |
| Location         | `frontend/` in the project root                                                        |
| Framework        | Next.js 15 (App Router) with React 19                                                  |
| Rendering        | Client-side: board UI in `"use client"` components; static export (`output: "export"`) |
| Language         | TypeScript (strict mode)                                                               |
| Styling          | Tailwind CSS v4, colors defined as theme tokens                                        |
| UI components    | shadcn/ui (Radix UI primitives)                                                        |
| Icons            | lucide-react                                                                           |
| Drag and drop    | @dnd-kit/core + @dnd-kit/sortable                                                      |
| State            | Zustand, with the `persist` middleware                                                 |
| Persistence      | `localStorage`, key `kanban-board-v1`                                                  |
| IDs              | `crypto.randomUUID()`                                                                  |
| Unit tests       | Vitest + React Testing Library                                                         |
| End-to-end tests | Playwright                                                                             |
| Lint / format    | ESLint (`next/core-web-vitals`) + Prettier                                             |
| Package manager  | npm                                                                                    |


**Data model**

```ts
type Card = { id: string; title: string; details: string };
type Column = { id: string; name: string; cardIds: string[] };
type Board = { columns: [Column, Column, Column, Column, Column]; cards: Record<string, Card> };
```

**Project structure**

```
<project root>/
  AGENTS.md
  frontend/
    app/            layout.tsx, page.tsx, globals.css (Tailwind + theme tokens)
    components/     Board, Column, Card, CardEditor, ConfirmDialog
    components/ui/  shadcn/ui components
    store/          boardStore.ts (Zustand), seedData.ts
    types/          board.ts
    tests/e2e/      Playwright specs
```

**Commands**

Run all commands from `frontend/`:

- `npm run dev` starts the dev server
- `npm run build` builds the static export
- `npm test` runs unit tests
- `npm run test:e2e` runs Playwright tests
- `npm run lint` runs ESLint and Prettier checks

**Design**: simple but elegant. Generous whitespace, rounded cards with soft shadows, one clean sans-serif font (Inter via `next/font`), subtle hover and drag animations.

## Color Scheme

All colors are defined once as theme tokens in `frontend/app/globals.css`; components use the Tailwind token classes (`bg-accent`, `text-navy`), never raw hex values.


| Token               | Name             | Hex       | Used for                                                           |
| ------------------- | ---------------- | --------- | ------------------------------------------------------------------ |
| `--color-accent`    | Accent Yellow    | `#ecad0a` | Accent lines, highlights (column header underline, drop indicator) |
| `--color-primary`   | Blue Primary     | `#209dd7` | Links, key sections, focus ring                                    |
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

