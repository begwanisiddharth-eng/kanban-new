import json
import re
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
    Action,
    AddCard,
    AssistantReply,
    Board,
    ChatRequest,
    DeleteCard,
    MoveCard,
    RenameColumn,
    UpdateCard,
)

MODEL = "groq/openai/gpt-oss-120b"

# LiteLLM prints a help banner on every failed call, retries included.
litellm.suppress_debug_info = True

SYSTEM_PROMPT = """You are the assistant inside a Kanban board app. The user's \
current board is given below as JSON: five columns (id, name, cardCount and \
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

Rules:
- A card always needs a non-empty title and details. When the user does not \
give details, write a short, useful description yourself; do not ask for one.
- Columns cannot be added or removed. A column name is at most 60 \
characters; if the user asks for a longer one, do not rename it, say why and \
suggest a shorter name.
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
    """Groq refused the API key."""


class BoardTooLarge(Exception):
    """The request is bigger than the Groq plan allows in a minute."""


class UsageLimit(Exception):
    """Groq's rate limit asks for a longer wait than a request can take."""

    def __init__(self, seconds: float):
        super().__init__(f"Groq asks to wait {seconds:.0f} s")
        self.seconds = seconds


# A rate limit asking for a longer wait than this fails at once; the free
# tier's daily token cap asks for minutes.
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
    """Seconds Groq asks us to wait, from "Please try again in 1m2.5s"."""
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
    # Groq answers 400 json_validate_failed when the model's JSON-mode output
    # does not parse; another attempt usually succeeds.
    return isinstance(error, RETRYABLE) or (
        isinstance(error, litellm.BadRequestError)
        and "json_validate_failed" in str(error)
    )


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
        # Groq reports a request over the per-minute token limit as a rate
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


def resolve_ids(board: Board, raw: Any) -> Any:
    """Maps a column name or a card title the model used in place of an id."""
    if not isinstance(raw, dict):
        return raw
    raw = dict(raw)
    columns = {c.name.strip().lower(): c.id for c in board.columns}
    column_id = raw.get("columnId")
    if isinstance(column_id, str) and column_id not in {c.id for c in board.columns}:
        raw["columnId"] = columns.get(column_id.strip().lower(), column_id)
    card_id = raw.get("cardId")
    if isinstance(card_id, str) and card_id not in board.cards:
        matches = [
            c.id
            for c in board.cards.values()
            if c.title.strip().lower() == card_id.strip().lower()
        ]
        if len(matches) == 1:
            raw["cardId"] = matches[0]
    return raw


def parse_actions(board: Board, raw_actions: list[Any]) -> list[Action]:
    """Validates each action on its own, so one bad action does not lose the rest."""
    actions: list[Action] = []
    for raw in raw_actions:
        try:
            actions.append(ACTION.validate_python(resolve_ids(board, raw)))
        except ValidationError:
            pass
    return actions


def valid_actions(board: Board, actions: list[Action]) -> list[Action]:
    """Keeps the actions that apply to the board, in order."""
    columns = {column.id for column in board.columns}
    cards = set(board.cards)
    kept: list[Action] = []
    for action in actions:
        match action:
            case AddCard() | RenameColumn() if action.column_id in columns:
                kept.append(action)
            case UpdateCard() if action.card_id in cards and (
                action.title or action.details
            ):
                kept.append(action)
            case MoveCard() if action.card_id in cards and action.column_id in columns:
                kept.append(action)
            case DeleteCard() if action.card_id in cards:
                cards.discard(action.card_id)
                kept.append(action)
    return kept


async def ask(request: ChatRequest) -> AssistantReply:
    reply, raw_actions = await complete(build_messages(request))
    actions = valid_actions(request.board, parse_actions(request.board, raw_actions))
    skipped = len(raw_actions) - len(actions)
    if skipped:
        changes = "change" if skipped == 1 else "changes"
        reply += f"\n\n({skipped} requested {changes} could not be applied.)"
    return AssistantReply(reply=reply, actions=actions)
