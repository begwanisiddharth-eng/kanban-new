import json
import re
import uuid
from typing import Any

import litellm
from pydantic import TypeAdapter, ValidationError
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential_jitter,
)

from .models import (
    MAX_COLUMNS,
    MIN_COLUMNS,
    Action,
    AddCard,
    AddColumn,
    AssistantReply,
    Board,
    ChatRequest,
    DeleteCard,
    MoveCard,
    RemoveColumn,
    RenameColumn,
    UpdateCard,
)

MODEL = "openai/gpt-4o-mini"

# LiteLLM prints a help banner on every failed call, retries included.
litellm.suppress_debug_info = True

SYSTEM_PROMPT = """You are the assistant inside a Kanban board app. The user's \
current board is given below as JSON: its columns in order (id, name, cardCount and \
their cards in order, each with id, title and details), and the totalCards on the \
board. It is the board as it is now, with the changes from earlier in the \
conversation already applied: trust it over the conversation, and use its counts \
rather than counting cards mentioned in earlier messages.

Answer questions about the board and make changes when the user asks for them. \
Be concise and friendly. Never invent card or column ids; use the ids in the board \
for actions, but in the reply call cards and columns by their titles and names, \
never by id.

Respond with a single JSON object and nothing else:
{"reply": "<message to the user>", "actions": [<zero or more actions>]}

Available actions:
{"type": "add_card", "columnId": "...", "title": "...", "details": "..."}
{"type": "update_card", "cardId": "...", "title": "...", "details": "..."}
  (title and details are optional; include only what changes)
{"type": "move_card", "cardId": "...", "columnId": "...", "position": 0}
  (position is the 0-based index in the target column; omit it for the end)
{"type": "delete_card", "cardId": "..."}
{"type": "rename_column", "columnId": "...", "name": "..."}
{"type": "add_column", "name": "..."}
  (adds an empty column at the end; later actions in the same reply can use its \
name as the columnId, for example to add or move cards into it)
{"type": "remove_column", "columnId": "..."}
  (removes the column and deletes every card in it)

Rules:
- A card always needs a non-empty title and details. When the user does not \
give details, write a short, useful description yourself; do not ask for one.
- A board has 1 to 5 columns: never add a column to a board with 5, or \
remove the last one; say why instead. A column name is at most 60 characters; \
if the user asks for a longer one, do not use it, say why and suggest a \
shorter name.
- Removing a column deletes its cards. Only remove a column the user asked to \
remove, and say in the reply how many cards went with it. To keep the cards, \
move them to another column first, before removing it.
- Only include actions the user asked for; for questions, return an empty \
actions list. If the request is unclear, ask which card or column they mean.
- Changes stay unsaved until the user clicks Save. You cannot save: never say \
the board is saved, and if the user asks you to save, remind them to click Save.
- The reply is shown as plain text: no Markdown (no **, #, tables or links). \
Use short lines and "- " bullets for lists.

Board:
"""


class InvalidReply(Exception):
    """The model answered with something that is not a usable reply."""


class KeyRejected(Exception):
    """The provider refused the API key."""


class BoardTooLarge(Exception):
    """The request is bigger than the plan allows in a minute."""


class UsageLimit(Exception):
    """A rate limit asks for a longer wait than a request can take."""

    def __init__(self, seconds: float):
        super().__init__(f"Rate limit asks to wait {seconds:.0f} s")
        self.seconds = seconds


# A rate limit asking for a longer wait than this fails at once; daily
# caps ask for minutes.
MAX_RATE_LIMIT_WAIT = 30


RETRYABLE = (
    litellm.RateLimitError,
    litellm.APIConnectionError,
    litellm.Timeout,
    litellm.InternalServerError,
    litellm.ServiceUnavailableError,
    InvalidReply,
)


def retry_hint(error: BaseException | None) -> float:
    """Seconds a rate limit asks us to wait, from "Please try again in 1m2.5s"."""
    match = re.search(r"try again in (?:(\d+)m)?(\d+(?:\.\d+)?)(ms|s)", str(error))
    if not match:
        return 0.0
    minutes, amount, unit = match.groups()
    seconds = float(amount) / 1000 if unit == "ms" else float(amount)
    return int(minutes or 0) * 60 + seconds


backoff = wait_exponential_jitter(initial=1, max=20)


def wait_for_retry(state: RetryCallState) -> float:
    """Exponential backoff, but at least as long as a rate limit asks for."""
    error = state.outcome.exception() if state.outcome else None
    return min(max(backoff(state), retry_hint(error) + 0.5), MAX_RATE_LIMIT_WAIT)


def is_retryable(error: BaseException) -> bool:
    return isinstance(error, RETRYABLE)


def parse_reply(content: str | None) -> tuple[str, list[Any]]:
    """Reads the reply text and raw actions from the model's JSON object,
    tolerating a code fence or prose around it."""
    data = None
    text = (content or "").strip()
    decoder = json.JSONDecoder()
    start = text.find("{")
    while start != -1 and not isinstance(data, dict):
        try:
            data = decoder.raw_decode(text, start)[0]
        except json.JSONDecodeError:
            pass
        start = text.find("{", start + 1)
    if not isinstance(data, dict):
        raise InvalidReply(f"No JSON object in the reply: {text[:200]!r}")
    actions = data.get("actions")
    actions = actions if isinstance(actions, list) else []
    reply = data.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        if not actions:
            raise InvalidReply("The reply has no message and no actions")
        reply = "Done."
    return plain_text(reply), actions


def plain_text(reply: str) -> str:
    """Strips Markdown the model sometimes uses despite the prompt."""
    reply = re.sub(r"\*\*(.+?)\*\*|__(.+?)__", lambda m: m[1] or m[2], reply)
    reply = re.sub(r"^#{1,6}\s+", "", reply, flags=re.MULTILINE)
    return reply.strip()


# Five attempts, but none started after 100 s, so with the 45 s request
# timeout an answer always comes back inside the backend's 180 s limit.
@retry(
    retry=retry_if_exception(is_retryable),
    wait=wait_for_retry,
    stop=stop_after_attempt(5) | stop_after_delay(100),
    reraise=True,
)
async def complete(messages: list[dict[str, str]]) -> tuple[str, list[Any]]:
    try:
        response = await litellm.acompletion(
            model=MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            timeout=45,
            num_retries=0,
        )
    except (litellm.AuthenticationError, litellm.BadRequestError) as error:
        if getattr(error, "status_code", None) == 401:
            raise KeyRejected(str(error)) from error
        raise
    except litellm.RateLimitError as error:
        # A request over the per-minute token limit is reported as a rate
        # limit, but waiting never helps.
        if "request too large" in str(error).lower():
            raise BoardTooLarge(str(error)) from error
        if (wait := retry_hint(error)) > MAX_RATE_LIMIT_WAIT:
            raise UsageLimit(wait) from error
        raise
    return parse_reply(response.choices[0].message.content)


def board_for_prompt(board: Board) -> str:
    """The board with cards nested in their columns, so each id appears once,
    and the counts the model would otherwise get wrong."""
    columns = [
        {
            "id": column.id,
            "name": column.name,
            "cards": [
                card.model_dump()
                for card_id in column.card_ids
                if (card := board.cards.get(card_id))
            ],
        }
        for column in board.columns
    ]
    return json.dumps(
        {
            "columns": [
                {**column, "cardCount": len(column["cards"])} for column in columns
            ],
            "totalCards": sum(len(column["cards"]) for column in columns),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


def build_messages(request: ChatRequest) -> list[dict[str, str]]:
    board = board_for_prompt(request.board)
    return [
        {"role": "system", "content": SYSTEM_PROMPT + board},
        *({"role": m.role, "content": m.content} for m in request.messages),
    ]


ACTION = TypeAdapter(Action)


class Draft:
    """The board as the actions so far leave it: column ids to names and card
    ids, and card ids to titles."""

    def __init__(self, board: Board):
        self.columns = {c.id: (c.name, list(c.card_ids)) for c in board.columns}
        self.cards = {card.id: card.title for card in board.cards.values()}

    def resolve(self, raw: Any) -> Any:
        """Maps a column name or a unique card title used in place of an id."""
        if not isinstance(raw, dict):
            return raw
        raw = dict(raw)
        column_id = raw.get("columnId")
        if isinstance(column_id, str) and column_id not in self.columns:
            for id, (name, _) in self.columns.items():
                if name.strip().lower() == column_id.strip().lower():
                    raw["columnId"] = id
        card_id = raw.get("cardId")
        if isinstance(card_id, str) and card_id not in self.cards:
            title = card_id.strip().lower()
            matches = [id for id, t in self.cards.items() if t.strip().lower() == title]
            if len(matches) == 1:
                raw["cardId"] = matches[0]
        return raw

    def unlink(self, card_id: str) -> None:
        for _, card_ids in self.columns.values():
            if card_id in card_ids:
                card_ids.remove(card_id)

    def apply(self, action: Action) -> bool:
        """Applies the action if it fits the board; says whether it did."""
        columns, cards = self.columns, self.cards
        match action:
            case AddCard() if action.column_id in columns:
                return True
            case UpdateCard() if action.card_id in cards and (
                action.title or action.details
            ):
                cards[action.card_id] = action.title or cards[action.card_id]
                return True
            case MoveCard() if action.card_id in cards and action.column_id in columns:
                self.unlink(action.card_id)
                columns[action.column_id][1].append(action.card_id)
                return True
            case DeleteCard() if action.card_id in cards:
                self.unlink(action.card_id)
                del cards[action.card_id]
                return True
            case RenameColumn() if action.column_id in columns:
                columns[action.column_id] = (action.name, columns[action.column_id][1])
                return True
            case AddColumn() if len(columns) < MAX_COLUMNS:
                action.column_id = f"col-{uuid.uuid4().hex[:8]}"
                columns[action.column_id] = (action.name, [])
                return True
            case RemoveColumn() if (
                action.column_id in columns and len(columns) > MIN_COLUMNS
            ):
                for card_id in columns.pop(action.column_id)[1]:
                    del cards[card_id]
                return True
        return False


def applicable_actions(board: Board, raw_actions: list[Any]) -> list[Action]:
    """Validates each action on its own, against the board as the earlier
    actions leave it, so one bad action does not lose the rest."""
    draft = Draft(board)
    kept: list[Action] = []
    for raw in raw_actions:
        try:
            action = ACTION.validate_python(draft.resolve(raw))
        except ValidationError:
            continue
        if draft.apply(action):
            kept.append(action)
    return kept


async def ask(request: ChatRequest) -> AssistantReply:
    reply, raw_actions = await complete(build_messages(request))
    actions = applicable_actions(request.board, raw_actions)
    skipped = len(raw_actions) - len(actions)
    if skipped:
        changes = "change" if skipped == 1 else "changes"
        reply += f"\n\n({skipped} requested {changes} could not be applied.)"
    return AssistantReply(reply=reply, actions=actions)
