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
    with pytest.raises(assistant.KeyRejected):
        await assistant.ask(REQUEST)
    assert attempts == 1


async def test_a_401_from_groq_means_the_key_was_rejected(monkeypatch):
    # LiteLLM reports Groq's 401 as a BadRequestError carrying status 401.
    async def denied(**_):
        error = litellm.BadRequestError("Invalid API Key", "m", "groq")
        error.status_code = 401
        raise error

    monkeypatch.setattr(litellm, "acompletion", denied)
    with pytest.raises(assistant.KeyRejected):
        await assistant.ask(REQUEST)


async def test_retries_groq_json_validate_failed(monkeypatch):
    attempts = 0

    async def fake(**_):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise litellm.BadRequestError(
                '{"error":{"code":"json_validate_failed"}}', "m", "groq"
            )
        return completion(reply())

    monkeypatch.setattr(litellm, "acompletion", fake)
    assert (await assistant.ask(REQUEST)).reply == "Done."
    assert attempts == 2


async def test_does_not_retry_other_bad_requests(monkeypatch):
    attempts = 0

    async def fake(**_):
        nonlocal attempts
        attempts += 1
        raise litellm.BadRequestError("context too long", "m", "groq")

    monkeypatch.setattr(litellm, "acompletion", fake)
    with pytest.raises(litellm.BadRequestError):
        await assistant.ask(REQUEST)
    assert attempts == 1


@pytest.mark.parametrize(
    "content",
    [
        '```json\n{"reply": "Hi", "actions": []}\n```',
        'Sure! {"reply": "Hi", "actions": []} Anything else?',
        '{"reply": " Hi ", "actions": null, "extra": 1}',
    ],
)
def test_parses_json_wrapped_in_other_text(content):
    assert assistant.parse_reply(content) == ("Hi", [])


@pytest.mark.parametrize("content", [None, "", "no json", "[1, 2]", '{"actions": []}'])
def test_rejects_replies_without_a_message(content):
    with pytest.raises(assistant.InvalidReply):
        assistant.parse_reply(content)


def test_defaults_the_message_when_only_actions_are_sent():
    action = {"type": "delete_card", "cardId": "c1"}
    assert assistant.parse_reply(json.dumps({"actions": [action]})) == (
        "Done.",
        [action],
    )


async def test_keeps_valid_actions_and_reports_the_rest(monkeypatch):
    answer = reply(
        actions=[
            {"type": "move_card", "cardId": "Write docs", "columnId": "to do"},
            {"type": "add_card", "columnId": "todo", "title": "No details"},
            {"type": "rename_column", "columnId": "review", "name": "x" * 61},
            {"type": "add_column", "name": "Blocked"},
            {"type": "delete_card", "cardId": "ghost"},
            "not an action",
        ]
    )

    async def fake(**_):
        return completion(answer)

    monkeypatch.setattr(litellm, "acompletion", fake)
    result = await assistant.ask(REQUEST)
    assert [a.model_dump(by_alias=True) for a in result.actions] == [
        {"type": "move_card", "cardId": "c1", "columnId": "todo", "position": None}
    ]
    assert result.reply == "Done.\n\n(5 requested changes could not be applied.)"


def test_waits_grow_exponentially_up_to_twenty_seconds(monkeypatch):
    monkeypatch.undo()  # use the real wait strategy, not the test override
    wait = assistant.backoff
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


def test_stops_retrying_in_time_for_the_backend():
    stop = assistant.complete.retry.stop
    state = lambda attempt, elapsed: SimpleNamespace(  # noqa: E731
        attempt_number=attempt, seconds_since_start=elapsed, outcome=None
    )
    assert not stop(state(2, 30))
    assert stop(state(2, 101))
    assert stop(state(5, 10))


@pytest.mark.parametrize(
    "message, seconds",
    [
        ("Please try again in 3.045s. Need more tokens?", 3.045),
        ("Please try again in 1m2.5s.", 62.5),
        ("Please try again in 450ms.", 0.45),
        ("Over capacity", 0.0),
    ],
)
def test_reads_the_wait_groq_asks_for(message, seconds):
    error = litellm.RateLimitError(message, llm_provider="groq", model="m")
    assert assistant.retry_hint(error) == pytest.approx(seconds)


def test_waits_at_least_as_long_as_the_rate_limit_asks():
    def state(attempt, message):
        error = litellm.RateLimitError(message, llm_provider="groq", model="m")
        return SimpleNamespace(
            attempt_number=attempt,
            outcome=SimpleNamespace(exception=lambda: error),
        )

    assert assistant.wait_for_retry(state(1, "try again in 7.2s")) >= 7.7
    assert assistant.wait_for_retry(state(1, "try again in 5m0s")) == 30
    assert assistant.wait_for_retry(state(1, "no hint")) <= 2


def test_strips_markdown_from_replies():
    content = json.dumps(
        {"reply": "## Summary\nIn **In Progress**: __two__ cards.", "actions": []}
    )
    assert assistant.parse_reply(content)[0] == "Summary\nIn In Progress: two cards."
