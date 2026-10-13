from types import SimpleNamespace

import pytest
from tenacity import wait_none

from app import assistant


def completion(content: str) -> SimpleNamespace:
    """Shape of a LiteLLM chat completion response, as used by the app."""
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


BOARD = {
    "columns": [
        {"id": "backlog", "name": "Backlog", "cardIds": ["c1"]},
        {"id": "todo", "name": "To Do", "cardIds": []},
        {"id": "in-progress", "name": "In Progress", "cardIds": ["c2"]},
        {"id": "review", "name": "Review", "cardIds": []},
        {"id": "done", "name": "Done", "cardIds": []},
    ],
    "cards": {
        "c1": {"id": "c1", "title": "Write docs", "details": "User guide"},
        "c2": {"id": "c2", "title": "Fix login", "details": "Session bug"},
    },
}


@pytest.fixture(autouse=True)
def no_retry_wait(monkeypatch):
    monkeypatch.setattr(assistant.complete.retry, "wait", wait_none())
