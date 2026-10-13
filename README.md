# Kanban

A clean Kanban app for tracking work. Sign in, keep up to three boards, and move cards across five columns with drag and drop.

## Getting started

Requires Node.js 20 or later.

```bash
npm run setup     # installs everything (once)
npm run build     # builds the web app
npm start         # starts the server
```

Open http://localhost:4000. Your data is stored in `data/kanban.db`.

For development with live reload, run `npm run dev` and open http://localhost:3000 instead.

## Your account

**Create an account** with your email and a password of at least 8 characters. **Sign in** with the same details next time. **Sign out** from the top right of the board.

Your boards are private to your account.

## Boards

Your first board, "My board", starts empty. You can have up to three boards.

- **Switch board** with the board menu at the top left.
- **New board** creates an empty board. You choose its name. The button is disabled once you have three boards.
- **Delete board** (the bin icon) deletes the open board after you confirm. You cannot delete your only board.

## Columns and cards

Every board has five columns: Backlog, To Do, In Progress, Review and Done.

- **Rename a column** by clicking its name. Press Enter or click away to keep it, or Escape to cancel. A name cannot be empty.
- **Add a card** with **Add card** at the bottom of a column. A title and details are both required.
- **Edit a card** by hovering over it and clicking the pencil icon.
- **Delete a card** by hovering over it and clicking the bin icon, then confirming.
- **Move a card** by dragging it within a column or to another column. On a touchscreen, press and hold a card briefly first.

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
