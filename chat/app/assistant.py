import litellm
from pydantic import ValidationError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
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

SYSTEM_PROMPT = """You are the assistant inside a Kanban board app. The user's \
current board is given below as JSON: five columns (id, name, cardIds in order) \
and cards (id, title, details).

Answer questions about the board and make changes when the user asks for them. \
Be concise and friendly. Never invent card or column ids; use the ids in the board.

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

Rules: a card always needs a non-empty title and details. Columns cannot be \
added or removed. Only include actions the user asked for; for questions, \
return an empty actions list. The changes are unsaved until the user clicks \
Save, so do not claim they are saved.

Board:
"""


class InvalidReply(Exception):
    """The model answered with something that is not a valid AssistantReply."""


RETRYABLE = (
    litellm.RateLimitError,
    litellm.APIConnectionError,
    litellm.Timeout,
    litellm.InternalServerError,
    litellm.ServiceUnavailableError,
    InvalidReply,
)


@retry(
    retry=retry_if_exception_type(RETRYABLE),
    wait=wait_exponential_jitter(initial=1, max=20),
    stop=stop_after_attempt(5),
    reraise=True,
)
async def complete(messages: list[dict[str, str]]) -> AssistantReply:
    response = await litellm.acompletion(
        model=MODEL,
        messages=messages,
        response_format={"type": "json_object"},
        timeout=60,
        num_retries=0,
    )
    try:
        return AssistantReply.model_validate_json(response.choices[0].message.content)
    except ValidationError as error:
        raise InvalidReply(str(error)) from error


def build_messages(request: ChatRequest) -> list[dict[str, str]]:
    board = request.board.model_dump_json(by_alias=True)
    return [
        {"role": "system", "content": SYSTEM_PROMPT + board},
        *({"role": m.role, "content": m.content} for m in request.messages),
    ]


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
    reply = await complete(build_messages(request))
    reply.actions = valid_actions(request.board, reply.actions)
    return reply
