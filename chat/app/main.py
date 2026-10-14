import logging
import math
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from .assistant import BoardTooLarge, KeyRejected, UsageLimit, ask
from .models import AssistantReply, ChatRequest

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("kanban.chat")

app = FastAPI(title="Kanban board assistant")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=AssistantReply, response_model_by_alias=True)
async def chat(request: ChatRequest) -> AssistantReply:
    if not os.environ.get("GROQ_API_KEY"):
        raise HTTPException(
            503, "The assistant is not set up yet. Add GROQ_API_KEY to the .env file."
        )
    try:
        return await ask(request)
    except KeyRejected as error:
        logger.error("Groq rejected the API key")
        raise HTTPException(
            503, "Groq rejected the API key. Check GROQ_API_KEY in the .env file."
        ) from error
    except UsageLimit as error:
        minutes = math.ceil(error.seconds / 60)
        logger.error("Groq usage limit reached")
        raise HTTPException(
            429,
            "The assistant has reached its Groq usage limit. "
            f"Try again in about {minutes} minute{'s' if minutes > 1 else ''}.",
        ) from error
    except BoardTooLarge as error:
        logger.error("Board too large for the Groq plan")
        raise HTTPException(
            413,
            "This board is too large for the assistant on the current Groq plan. "
            "Try it on a smaller board.",
        ) from error
    except Exception as error:
        logger.exception("Chat request failed")
        raise HTTPException(
            502, "The assistant could not answer right now. Please try again."
        ) from error
