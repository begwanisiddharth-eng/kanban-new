# Kanban

A clean Kanban app for tracking work. Sign in, keep up to three boards, move cards across up to five columns with drag and drop, and ask the board assistant to make changes for you.

## Getting started

Requires Node.js 20 or later, Python 3.12 or later and [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env   # then add your OpenAI API key to OPENAI_API_KEY
npm run setup          # installs everything (once)
npm run build          # builds the web app
npm start              # starts the server and the assistant
```

Open http://localhost:4000. Your data is stored in `data/kanban.db`. Never commit `.env`; it is gitignored.

For development with live reload, run `npm run dev` and open http://localhost:3000 instead.

## Your account

**Create an account** with your email and a password of at least 8 characters. **Sign in** with the same details next time. Your boards are private to your account.

The account menu (the person icon at the top right) shows your email and has:

- **Change password**: enter your current password and a new one of at least 8 characters.
- **Sign out**.

**One sign-in at a time.** While your account is signed in somewhere, a new sign-in elsewhere is refused. Sign out there first, or wait until 20 minutes after it was last used.

**Inactivity.** After 20 minutes without activity you are signed out. Two minutes before, a dialog lets you stay signed in. Unsaved changes are lost when this happens, so save often.

There is no password reset. If you forget your password, the account cannot be recovered.

## Boards

Your first board, "My board", starts empty. You can have up to three boards.

- **Switch board** with the board menu at the top left.
- **New board** creates an empty board. You choose its name. The button is disabled once you have three boards.
- **Delete board** (the bin icon) deletes the open board after you confirm. You cannot delete your only board.

## Columns and cards

A new board starts with five columns: Backlog, To Do, In Progress, Review and Done. A board can have one to five.

- **Add a column** with the **Add column** tile after the last column (shown when there are fewer than five). It is added at the end, empty.
- **Remove a column** with the bin icon at the bottom of the column. If it has cards, you confirm first, and its cards are removed with it. The last column cannot be removed.

- **Rename a column** by clicking its name. Press Enter or click away to keep it, or Escape to cancel. A name cannot be empty.
- **Add a card** with **Add card** at the bottom of a column. A title and details are both required.
- **Edit a card** by hovering over it and clicking the pencil icon.
- **Delete a card** by hovering over it and clicking the bin icon, then confirming.
- **Move a card** by dragging it within a column or to another column. On a touchscreen, press and hold a card briefly first.

## Board assistant

The assistant panel sits to the right of the columns. Ask it about the board ("What is in progress?") or ask for changes: add, edit, move or delete cards, and add, rename or remove columns. Press Enter to send and Shift+Enter for a new line.

Its changes appear on the board straight away but are unsaved, like your own edits: click **Save** to keep them or **Discard changes** to undo them. Each board has its own conversation, which is cleared when you switch board or reload. The **Clear conversation** button (the circular arrow) clears it too.

If the model is busy, the assistant retries a few times before reporting an error.

## Saving

Changes are not stored until you click **Save**. The toolbar shows "Unsaved changes" or "All changes saved".

| Button          | What it does                                    | Available when                   |
| --------------- | ----------------------------------------------- | -------------------------------- |
| Save            | Stores your changes                             | There are unsaved changes        |
| Discard changes | Returns the board to how it was when last saved | There are unsaved changes        |
| New board       | Creates an empty board                          | You have fewer than three boards |
| Delete board    | Permanently deletes the open board              | You have more than one board     |

If you switch board, create a board or sign out with unsaved changes, you are asked what to do: **Save and continue**, **Discard changes**, or **Cancel** to stay. If you reload or close the tab with unsaved changes, your browser warns you before leaving.

## Keyboard

| Action             | Keys                                                            |
| ------------------ | --------------------------------------------------------------- |
| Move between items | Tab / Shift+Tab                                                 |
| Pick up a card     | Focus the card, press Space                                     |
| Move a picked card | Arrow keys (up/down within a column, left/right across columns) |
| Drop / cancel      | Space / Escape                                                  |
| Rename a column    | Focus the column name, press Enter                              |

There are no labels, due dates, search, archiving or sharing. It is deliberately simple.
