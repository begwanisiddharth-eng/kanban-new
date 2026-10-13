# Kanban

A single, clean Kanban board for tracking work. Five columns, simple cards, drag and drop. Everything is saved in your browser.

## Getting started

Requires Node.js 20 or later.

```bash
cd frontend
npm install
npm run build
npm start
```

Open http://localhost:3000. For development with live reload, run `npm run dev` instead.

The board opens with sample cards so you can try it straight away.

## Using the board

**Columns.** The board has five columns: Backlog, To Do, In Progress, Review and Done. Click a column name to rename it. Press Enter or click away to save, or Escape to cancel. A column name cannot be empty.

**Add a card.** Click **Add card** at the bottom of a column, enter a title and details, then click **Save**. Both fields are required.

**Edit a card.** Hover over a card and click the pencil icon. Change the title or details and click **Save**.

**Delete a card.** Hover over a card and click the bin icon, then confirm. Deleted cards cannot be recovered.

**Move a card.** Drag it to a new position in the same column or into another column. On a touchscreen, press and hold a card briefly before dragging.

## Keyboard

| Action             | Keys                                                            |
| ------------------ | --------------------------------------------------------------- |
| Move between items | Tab / Shift+Tab                                                 |
| Pick up a card     | Focus the card, press Space                                     |
| Move a picked card | Arrow keys (up/down within a column, left/right across columns) |
| Drop / cancel      | Space / Escape                                                  |
| Rename a column    | Focus the column name, press Enter                              |

## Your data

The board is stored in your browser's local storage, so it survives page reloads but is specific to this browser and device. Clearing site data resets the board to the sample cards.

There are no accounts, sharing, labels, due dates, search or archiving. It is deliberately simple.
