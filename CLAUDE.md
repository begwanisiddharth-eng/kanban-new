# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the authoritative spec: business requirements, stack, data model, API, project structure, color tokens and coding standards. Read it in full before starting work. This file only adds what `AGENTS.md` doesn't cover.

## Commands

From the project root: `npm run setup` once (needs uv), then `npm run dev` (backend on 4000, frontend on 3000, chat service on 8000), `npm test`, `npm run lint`, `npm run test:e2e`. Inside a package, run a single test file with `npm test -- <path>`; in `frontend/`, a single Playwright spec with `npm run test:e2e -- <path>`; in `chat/`, `uv run pytest <path>`. Behind the session's TLS proxy, set `UV_SYSTEM_CERTS=1` for uv.

## Architecture

- `backend/` is the only thing that touches the database. Every board query filters by the signed-in user's id; keep it that way for any new query.
- The frontend never talks to SQLite or reads cookies; it calls `/api` through `frontend/lib/api.ts`. The session cookie is httpOnly.
- `frontend/app/page.tsx` loads the user, board list and open board, then mounts `BoardStoreProvider` (one Zustand store per open board) around `BoardApp`.
- Board edits only change the store. `hooks/useBoardSession.ts` owns saving, discarding, switching, creating and deleting boards, and the unsaved-changes guard; route new "leave this board" actions through its `guard`.
- Board data is validated twice: store actions reject blank input, and `backend/src/schema.ts` validates the full board on save. Change both together.
- E2E tests sign up a fresh user per test and seed boards through the API (`tests/e2e/helpers.ts`), so they never depend on each other.
- `chat/` is a stateless Python service reached only through the backend's `/api/chat`. It never touches the database; the client sends the working board with each message, and returned actions go through `lib/assistantActions.ts` into store actions, so they stay unsaved. A new action type needs the pydantic model, `Draft.apply` (via `applicable_actions`), the prompt, the action type in `frontend/types/chat.ts` and `assistantActions.ts`.
- The OpenAI key (`OPENAI_API_KEY`) lives only in the root `.env`, which is gitignored. Never commit it or print it. E2E and pytest never call the real model: Playwright points `OPENAI_BASE_URL` at `tests/e2e/fake-openai.mjs`. `npm run test:live` in `frontend/` is the only thing that does.
- Boards hold 1 to 5 columns (`MIN_COLUMNS`/`MAX_COLUMNS` in `types/board.ts`, `backend/src/schema.ts` and `chat/app/models.py`); change all three together. Column ids are not fixed: new columns get random ids, so never assume `backlog`...`done` exist.
- Every authenticated request counts as activity for the 20-minute idle timeout. Don't add background polling that would keep idle sessions alive.
