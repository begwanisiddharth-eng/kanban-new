import type { BoardState } from "@/store/boardStore";
import { MIN_COLUMNS } from "@/types/board";
import type { AssistantAction } from "@/types/chat";

/**
 * Applies the assistant's actions through the store's own actions, so they
 * get the same validation as manual edits. Returns a line per applied change.
 */
export function applyAssistantActions(
  getState: () => BoardState,
  actions: AssistantAction[],
): string[] {
  const applied: string[] = [];
  for (const action of actions) {
    const state = getState();
    const columnName = (id: string) =>
      state.columns.find((c) => c.id === id)?.name;
    switch (action.type) {
      case "add_card": {
        const name = columnName(action.columnId);
        if (!name) break;
        state.addCard(action.columnId, action.title, action.details);
        applied.push(`Added "${action.title.trim()}" to ${name}`);
        break;
      }
      case "update_card": {
        const card = state.cards[action.cardId];
        if (!card) break;
        state.updateCard(
          card.id,
          action.title ?? card.title,
          action.details ?? card.details,
        );
        applied.push(`Updated "${getState().cards[card.id].title}"`);
        break;
      }
      case "move_card": {
        const card = state.cards[action.cardId];
        const target = state.columns.find((c) => c.id === action.columnId);
        if (!card || !target) break;
        const last = target.cardIds.filter((id) => id !== card.id).length;
        state.moveCard(
          card.id,
          target.id,
          Math.min(action.position ?? last, last),
        );
        applied.push(`Moved "${card.title}" to ${target.name}`);
        break;
      }
      case "delete_card": {
        const card = state.cards[action.cardId];
        if (!card) break;
        state.deleteCard(card.id);
        applied.push(`Deleted "${card.title}"`);
        break;
      }
      case "add_column": {
        if (!state.addColumn(action.name, action.columnId)) break;
        applied.push(`Added column ${action.name.trim()}`);
        break;
      }
      case "remove_column": {
        const column = state.columns.find((c) => c.id === action.columnId);
        if (!column || state.columns.length <= MIN_COLUMNS) break;
        state.removeColumn(column.id);
        const count = column.cardIds.length;
        applied.push(
          `Removed column ${column.name}` +
            (count
              ? ` and its ${count === 1 ? "card" : `${count} cards`}`
              : ""),
        );
        break;
      }
      case "rename_column": {
        const name = columnName(action.columnId);
        if (!name || !action.name.trim()) break;
        state.renameColumn(action.columnId, action.name);
        applied.push(`Renamed ${name} to ${action.name.trim()}`);
        break;
      }
    }
  }
  return applied;
}
