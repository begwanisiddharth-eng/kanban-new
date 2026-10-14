# Review: full codebase review and live assistant testing

A full pass over `backend/`, `chat/` and `frontend/` on 14 October 2026, plus live testing of the board assistant against the real `openai/gpt-4o-mini` model (this environment has a working `OPENAI_API_KEY` and network access to `api.openai.com`, unlike the previous review).

## Result

The app is sound. Every unit and end-to-end suite passes, lint is clean across all three packages, and the live model behaved correctly on every scenario tried, including the specific risks called out in the previous review (Markdown in replies, internal ids leaking into replies, miscounted cards, and the new column actions). Four findings came out of this pass, all minor: one genuinely flaky unit test, one tooling gap that makes the live test suite silently test nothing, one low-severity timing side-channel, and one maintainability nit. None of them affect the features working as specified.

| Suite                              |  Result | Notes                                           |
| ----------------------------------- | ------: | ------------------------------------------------ |
| Backend unit (Vitest + Supertest)   | 36/36   | —                                                 |
| Frontend unit (Vitest + RTL)        | 61-62/62 | One test is flaky under the full suite; see F1   |
| Chat service (pytest)               | 42/42   | —                                                 |
| Playwright e2e (fake OpenAI server) | 127/127 | Full suite, single run                           |
| Playwright live (real OpenAI)       | 0/10 ran | Skipped entirely — see F2                        |
| Lint (ESLint, Prettier, ruff)       | clean   | Backend, frontend and chat all pass               |

## Live model testing (real gpt-4o-mini)

`npm run test:live` reported "10 skipped" and exited 0 (see F2), so it was not usable as-is. Instead I drove the real model directly through a running backend + chat service (`DATABASE_PATH` pointed at a throwaway file, ports 4100/8000), using the same `OPENAI_API_KEY` from the root `.env`, and checked the board state and reply text for each of the scenarios the live suite itself scripts:

| Scenario                                                             | Result                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Plain question ("how many columns, and what are they called?")        | Correct count and names, no Markdown                                                      |
| Add two cards to two named columns in one message                     | Both `add_card` actions used the correct real column ids; sensible generated details      |
| Add a column while already at 5                                       | Refused in the reply, zero actions, explained why                                         |
| Remove a column, add a new one, fill it by name, in one message       | Correctly chained `remove_column` → `add_column` → `add_card` using the service-assigned id for the new column |
| Card-count question with a card containing a prompt-injection attempt | Correct count (3), quoted the malicious card as data, took no actions, did not comply with the embedded instructions |
| Ambiguous request ("delete that card" with no cards on the board)     | Replied there was nothing to delete, zero actions                                         |
| Column name over 60 characters                                        | Refused, cited the 60-character limit, zero actions                                       |
| "Add a card... and save the board for me"                             | Added the card, reminded the user to click Save, never claimed to have saved              |

All of this matches the behaviour documented in `AGENTS.md` and the assistant's system prompt, and matches what the previous review's open items asked to confirm. No Markdown, no internal ids, no miscounted cards, no false "saved" claims, no compliance with the injected instructions.

## Findings

| #  | Severity | Finding                                                                                                                                                                                                                                                                       | Location                                                      |
| -- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| F1 | Low      | **Flaky unit test.** `ChangePasswordDialog`'s "requires the new passwords to match" test passes in isolation but fails consistently (3/3 runs) when the full frontend suite runs. It asserts `screen.getByRole("alert")` right after a click with no `waitFor`, but the component's `<form action={submit}>` (a React 19 form action) resolves the state update a tick later than a plain `onSubmit` would; under the full suite's parallel worker load that tick is enough to lose the race. The two other tests in the same file await correctly (`waitFor`, `findByText`) and never fail.                                                                              | `frontend/components/ChangePasswordDialog.test.tsx:27-31`      |
| F2 | Medium   | **The live Playwright suite silently tests nothing unless `OPENAI_API_KEY` is also exported in the invoking shell.** `test.skip(!process.env.OPENAI_API_KEY, ...)` runs in the Playwright test-runner's own Node process, which never reads the root `.env` — only the backend and chat-service child processes it spawns do that (via `process.loadEnvFile` and `python-dotenv`). With the key only in `.env` (the setup every README and AGENTS.md instruction describes), `npm run test:live` reports "10 skipped" and **exits 0**, which looks like a clean run in a terminal or CI log but verified nothing against the real model. This is exactly what happened when I ran it here.                                                                | `frontend/tests/live/assistant.live.spec.ts:8`                 |
| F3 | Low      | **Sign-in has a timing side-channel.** `POST /api/auth/signin` only calls the (expensive, scrypt-based) `verifyPassword` when `findUserByEmail` finds a row; for an unknown email it returns 401 immediately. An attacker who can measure response latency can distinguish "wrong password for a real account" from "no such account", enabling email enumeration. A constant-time fix would run `verifyPassword` against a fixed dummy hash when no user is found, before returning 401 either way.                                                                                                                                                                      | `backend/src/routes/auth.ts:48-69`                             |
| F4 | Low      | **`MAX_BOARDS` is a duplicated literal, not a shared constant.** It is `3` in `backend/src/boards.ts` and separately `3` in `frontend/hooks/useBoardSession.ts`, with nothing tying them together. `AGENTS.md` already calls out the equivalent risk for `MIN_COLUMNS`/`MAX_COLUMNS` (three files to change together); the board limit has the same shape of risk but isn't tracked anywhere. Low impact today since the limit isn't expected to change, but worth a one-line mention alongside the column-limit note if it ever does.                                                                                                                                | `backend/src/boards.ts:4`, `frontend/hooks/useBoardSession.ts:9` |

### A code-level edge case, not reproduced live

`chat/app/assistant.py`'s `Draft.resolve()` falls back to case-insensitive name matching for `columnId`/`cardId` when the model sends something that isn't a known id. Column names aren't required to be unique (the schema has no such constraint, and the UI lets you rename two columns to the same name), so if the model ever used a name instead of an id for a board with duplicate column names, it would silently resolve to whichever column appears first, which might not be the one meant. In all of this session's live testing the model was given real ids in the board JSON and used them directly, never triggering this fallback, so this is a latent edge case rather than an observed bug.

## What else I checked, with no issues found

- **Backend**: session one-per-user invariant (`UNIQUE(user_id)` + `ON CONFLICT DO NOTHING`), idle expiry and cleanup, scrypt parameters and `timingSafeEqual` usage, board/column/card referential-integrity `refine()`s in `schema.ts`, the 1-3 board and 1-5 column limits enforced in transactions, cookie flags (`httpOnly`, `SameSite=Lax`, `Secure` only in production).
- **Chat service**: the retry/backoff tuning against OpenAI's actual error shapes (`RateLimitError`, "request too large", `AuthenticationError` → 401), the JSON-object extraction tolerating code fences and leading prose, the per-action `Draft` validation that lets one bad action in a reply not sink the rest, and the Markdown-stripping regex.
- **Frontend**: the dirty-tracking snapshot comparison in `boardStore.ts`, the custom dnd-kit collision detection (the documented fix for the cross-column render loop), focus hand-off after removing/adding a column, the unsaved-changes guard covering switch/create/delete/sign-out, and the idle-timeout heartbeat/warning/sign-out sequence.
- **Cross-cutting**: the 1-5 column limit and 60-character name limit are consistent across `frontend/types/board.ts`, `backend/src/schema.ts` and `chat/app/models.py`, exactly as `AGENTS.md` requires.
- Re-ran the full 127-test Playwright e2e suite (fake OpenAI server) once: no flakes.

## Open items

1. **Export `OPENAI_API_KEY` in the shell before `npm run test:live`, not just in `.env`** (see F2). Until that's fixed in the spec or documented, the suite will keep reporting a false "10 skipped" pass. A one-line fix: load `.env` at the top of `playwright.live.config.ts` (e.g. with `dotenv/config`) so the test-runner process sees the key the same way its child processes do.
2. **Fix F1's race** by awaiting the assertion (`waitFor`/`findByRole`) like the file's other two tests do, rather than asserting synchronously after `user.click()`.
3. **Rate limits on OpenAI** are still untuned for this account's actual usage tier (unchanged from the previous review) — the handful of live requests made here never came close to a limit, so this remains unverified either way.
4. **Column reordering and restoring a single removed column** (other than via **Discard changes** before saving) remain out of scope, as before.
