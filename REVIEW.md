# Review: gpt-4o-mini and column management

Two changes, tested in two rounds of end-to-end testing on 14 October 2026.

1. **Model.** The board assistant now calls `openai/gpt-4o-mini` through LiteLLM, using `OPENAI_API_KEY`. Groq does not serve this model, so the assistant now talks to OpenAI directly.
2. **Columns.** A board now keeps **1 to 5** columns. Users can add an empty column at the end and remove any column except the last. Removing a column that has cards asks for confirmation first and deletes the cards with it. The board assistant can do the same through two new actions, `add_column` and `remove_column`.

## Result

Both changes work as specified. Round 1 found three defects and round 2 found one; all four are fixed and covered by tests. No known defect is left open.

| Suite                             | Before | After                      |
| --------------------------------- | -----: | -------------------------- |
| Backend unit (Vitest + Supertest) |     33 | 36                         |
| Frontend unit (Vitest + RTL)      |     51 | 62                         |
| Chat service (pytest)             |     39 | 42                         |
| Playwright e2e (simulated model)  |    105 | 127                        |
| Column specs, repeated 5 times    |      — | 110 of 110, no flaky tests |
| Lint (ESLint, Prettier, ruff)     |  clean | clean                      |

**Not tested: gpt-4o-mini itself.** This environment has no `OPENAI_API_KEY`, and its network policy blocks `api.openai.com`. Every assistant test therefore ran against the scripted fake OpenAI server (`frontend/tests/e2e/fake-openai.mjs`), not the real model. See [Open items](#open-items).

## How it was tested

- **Round 1** ran the whole existing suite against the new code, plus a new spec, `columns-manage.spec.ts` (12 tests):
  - removing a column, with and without confirming, then saving and reloading
  - Discard bringing a removed column back
  - the one-column minimum and the five-column maximum
  - adding a column, its name dialog and the 60-character limit
  - adding cards to a new column and dragging cards into it
  - renaming a new column, then removing it again
  - API validation: 0 columns, 6 columns, duplicate ids
  - the assistant removing a column, adding one and filling it in one reply
  - layout at 1280 px with fewer columns
  - an axe accessibility scan of the new controls and dialogs
  - screenshots at 1280 px and 390 px
- **Round 2** went after edge cases in a second spec, `columns-edge.spec.ts` (10 tests):
  - keyboard-only removing and adding, and where focus lands afterwards
  - moving a card into a new column by keyboard drag and drop
  - a one-column board, end to end
  - the unsaved-changes prompt after removing a column
  - removing a column, then adding a new one with the same name
  - the assistant hitting the 1 and 5 limits
  - a slow assistant reply that names a column the user has removed meanwhile
  - "its card" for exactly one card (not "its 1 cards")
  - managing columns at phone width
  - finally, both column specs repeated 3 to 6 times to catch flaky tests

## Round 1 findings

| #    | Severity | Finding                                                                                                                                                                                                                                                                                          | Fix                                                                                                                                             |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| R1-1 | Medium   | A remove button in each column header squeezed the title. At 1280 px "In Progress" was cut to "In Progr…". Found from screenshots.                                                                                                                                                               | Moved the remove button to the column footer, next to **Add card**, where there was spare room. Titles show in full again.                      |
| R1-2 | Medium   | **Already present before this change.** The column-rename field had no length limit, and the store accepted any length. The backend rejects names over 60 characters, so a longer name showed on screen and then made **Save** fail. Found while adding the same limit to the new column dialog. | Capped the input at 60 characters and made the store's `renameColumn` reject longer names, matching the backend. Covered by unit and e2e tests. |
| R1-3 | Low      | The retry for Groq's 400 `json_validate_failed` no longer applies. OpenAI's JSON mode does not send that error, and LiteLLM's OpenAI error doesn't expose the code anyway, so its e2e test failed.                                                                                               | Removed the Groq-only rule. The scenario now uses failures OpenAI does produce: a 500, an empty reply and a null reply, then success.           |

Two round 1 failures were mistakes in the new tests, not in the app:

- "No cards yet" is drawn with CSS `::before`, so it isn't in the page's text.
- The accessibility test didn't use the project's agreed exception for the spec-mandated `#888888` muted text.

## Round 2 findings

| #    | Severity               | Finding                                                                                                                                                                                                                                                                                                                                       | Fix                                                                                                                                                                                                                                                                              |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-1 | Medium (accessibility) | **Keyboard focus was lost.** After removing a column (with or without the confirm dialog), the focused button disappeared with its column. After adding the fifth column, the **Add column** tile that focus returns to disappeared. Either way focus fell to `<body>`, sending keyboard and screen-reader users back to the top of the page. | Focus now moves somewhere sensible. After a removal it goes to the neighbouring column's remove button, so several columns can be removed in a row. After an add it goes to the new column's title. This uses Radix's `onCloseAutoFocus`. Two e2e tests check where focus lands. |

Two flaky failures in the repeated runs were timing in the tests, not app bugs. The focus hand-off in R2-1 happens when the dialog finishes closing, about 200 ms later, and two tests moved focus themselves before that. The tests now wait for focus to settle; a person can't act within that window.

### Checked with no defects found

- The assistant can't go past five columns or below one. A reply that tries reports "(1 requested change could not be applied.)".
- In one reply the assistant can remove a column, add a new one, and put cards into it by name. The service gives new columns their ids.
- A slow reply that refers to a column the user has removed meanwhile applies its other actions and skips the rest.
- Removing a column and then adding one with the same name creates a new, empty column with a new id; the old column's cards stay deleted.
- Discard restores removed columns and their cards. Switching boards after removing a column asks about the unsaved change first.
- The API rejects boards with 0 columns, 6 columns, or duplicate column ids, and accepts a one-column board.
- Cards can be dragged into a new column by mouse and by keyboard.
- The layout holds at 1280 px with fewer columns (the assistant panel stays in the same row) and at 390 px, with no sideways page scroll.
- The column controls and dialogs pass the axe scan for WCAG 2.1 AA.

## Open items

1. **Run the live suite against gpt-4o-mini.** Add `OPENAI_API_KEY` as an environment variable and `api.openai.com` to the environment's allowed domains. Then, in a new session, run `npm run test:live` in `frontend/`. It sends about 15 requests. The prompt was tuned on `gpt-oss-120b`, so watch especially for:
   - Markdown in replies
   - internal ids appearing in replies
   - wrong card counts in long conversations
   - correct use of the new `add_column` and `remove_column` actions
2. **Rate limits on OpenAI.** The retry handling reads "Please try again in Xs" from the error message, which OpenAI also uses. The thresholds (30 s maximum wait, give up after 100 s) were tuned on Groq's free tier and may need adjusting for your OpenAI usage tier.
3. **How the "5" was read.** "How many columns may a board have: 5" was taken as **1 to 5**: a board can shrink to one column and grow back to five. If you meant something else, the limit is `MIN_COLUMNS`/`MAX_COLUMNS` in three places, which must change together: `frontend/types/board.ts`, `backend/src/schema.ts` and `chat/app/models.py`.
4. **Not in scope.** Columns can't be reordered, and a removed column can't be restored other than by **Discard changes** before saving.
