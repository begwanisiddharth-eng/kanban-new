import json

import litellm
from fastapi.testclient import TestClient

from app.main import app

from .conftest import BOARD, completion

client = TestClient(app)
BODY = {"board": BOARD, "messages": [{"role": "user", "content": "Move docs"}]}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_needs_an_api_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    res = client.post("/chat", json=BODY)
    assert res.status_code == 503
    assert "GROQ_API_KEY" in res.json()["detail"]


def test_explains_a_rejected_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "wrong")

    async def denied(**_):
        raise litellm.AuthenticationError("bad key", llm_provider="groq", model="m")

    monkeypatch.setattr(litellm, "acompletion", denied)
    res = client.post("/chat", json=BODY)
    assert res.status_code == 503
    assert "Groq rejected the API key" in res.json()["detail"]


def test_returns_reply_and_camel_case_actions(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test")
    answer = {
        "reply": "Moved it.",
        "actions": [{"type": "move_card", "cardId": "c1", "columnId": "done"}],
    }

    async def fake(**_):
        return completion(json.dumps(answer))

    monkeypatch.setattr(litellm, "acompletion", fake)
    res = client.post("/chat", json=BODY)
    assert res.status_code == 200
    assert res.json() == {
        "reply": "Moved it.",
        "actions": [
            {"type": "move_card", "cardId": "c1", "columnId": "done", "position": None}
        ],
    }


def test_reports_failure_without_leaking_details(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test")

    async def broken(**_):
        raise litellm.BadRequestError("secret detail", "m", "groq")

    monkeypatch.setattr(litellm, "acompletion", broken)
    res = client.post("/chat", json=BODY)
    assert res.status_code == 502
    assert "secret" not in res.text


def test_validates_the_request():
    bad = {**BODY, "board": {**BOARD, "columns": BOARD["columns"][:4]}}
    assert client.post("/chat", json=bad).status_code == 422
    assert client.post("/chat", json={**BODY, "messages": []}).status_code == 422
