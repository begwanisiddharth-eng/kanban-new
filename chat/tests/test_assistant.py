import json
from types import SimpleNamespace

import litellm
import pytest

from app import assistant
from app.models import AssistantReply, ChatRequest

from .conftest import BOARD, completion

REQUEST = ChatRequest.model_validate(
    {"board": BOARD, "messages": [{"role": "user", "content": "Hi"}]}
)


def reply(**fields) -> str:
    return json.dumps({"reply": "Done.", "actions": [], **fields})


def rate_limit() -> litellm.RateLimitError:
    return litellm.RateLimitError("slow down", llm_provider="groq", model="m")


async def test_uses_the_fixed_groq_model_with_json_output(monkeypatch):
    calls = []

    async def fake(**kwargs):
        calls.append(kwargs)
        return completion(reply())

    monkeypatch.setattr(litellm, "acompletion", fake)
    await assistant.ask(REQUEST)
    assert calls[0]["model"] == "groq/openai/gpt-oss-120b"
    assert calls[0]["response_format"] == {"type": "json_object"}
    system, user = calls[0]["messages"]
    assert system["role"] == "system" and '"cardIds":["c1"]' in system["content"]
    assert user == {"role": "user", "content": "Hi"}


async def test_retries_transient_errors_then_succeeds(monkeypatch):
    attempts = 0

    async def flaky(**_):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise rate_limit()
        return completion(reply())

    monkeypatch.setattr(litellm, "acompletion", flaky)
    assert (await assistant.ask(REQUEST)).reply == "Done."
    assert attempts == 3


async def test_retries_invalid_json_from_the_model(monkeypatch):
    answers = iter(["not json", json.dumps({"actions": []}), reply()])

    async def fake(**_):
        return completion(next(answers))

    monkeypatch.setattr(litellm, "acompletion", fake)
    assert (await assistant.ask(REQUEST)).reply == "Done."


async def test_gives_up_after_five_attempts(monkeypatch):
    attempts = 0

    async def failing(**_):
        nonlocal attempts
        attempts += 1
        raise rate_limit()

    monkeypatch.setattr(litellm, "acompletion", failing)
    with pytest.raises(litellm.RateLimitError):
        await assistant.ask(REQUEST)
    assert attempts == 5


async def test_does_not_retry_non_transient_errors(monkeypatch):
    attempts = 0

    async def denied(**_):
        nonlocal attempts
        attempts += 1
        raise litellm.AuthenticationError("bad key", llm_provider="groq", model="m")

    monkeypatch.setattr(litellm, "acompletion", denied)
    with pytest.raises(litellm.AuthenticationError):
        await assistant.ask(REQUEST)
    assert attempts == 1


def test_waits_grow_exponentially_up_to_twenty_seconds(monkeypatch):
    monkeypatch.undo()  # use the real wait strategy, not the test override
    wait = assistant.complete.retry.wait
    for attempt, base in [(1, 1), (2, 2), (3, 4), (4, 8), (5, 16), (6, 20)]:
        delay = wait(SimpleNamespace(attempt_number=attempt))
        assert base <= delay <= min(base + 1, 20)


def test_keeps_only_actions_that_fit_the_board():
    parsed = AssistantReply.model_validate(
        {
            "reply": "ok",
            "actions": [
                {"type": "add_card", "columnId": "todo", "title": "A", "details": "B"},
                {"type": "add_card", "columnId": "nope", "title": "A", "details": "B"},
                {"type": "move_card", "cardId": "c1", "columnId": "done"},
                {"type": "move_card", "cardId": "ghost", "columnId": "done"},
                {"type": "update_card", "cardId": "c2", "title": "Fix sign-in"},
                {"type": "update_card", "cardId": "c2"},
                {"type": "delete_card", "cardId": "c2"},
                {"type": "delete_card", "cardId": "c2"},
                {"type": "rename_column", "columnId": "review", "name": "QA"},
            ],
        }
    )
    kept = assistant.valid_actions(REQUEST.board, parsed.actions)
    assert [a.type for a in kept] == [
        "add_card",
        "move_card",
        "update_card",
        "delete_card",
        "rename_column",
    ]


def test_rejects_blank_card_fields():
    with pytest.raises(ValueError):
        AssistantReply.model_validate(
            {
                "reply": "ok",
                "actions": [
                    {
                        "type": "add_card",
                        "columnId": "todo",
                        "title": " ",
                        "details": "x",
                    }
                ],
            }
        )
