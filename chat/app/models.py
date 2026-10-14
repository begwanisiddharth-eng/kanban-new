from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ColumnName = Annotated[Text, StringConstraints(max_length=60)]

MIN_COLUMNS = 1
MAX_COLUMNS = 5


class Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Card(Model):
    id: str
    title: str
    details: str


class Column(Model):
    id: str
    name: str
    card_ids: list[str]


class Board(Model):
    columns: list[Column] = Field(min_length=MIN_COLUMNS, max_length=MAX_COLUMNS)
    cards: dict[str, Card]


class ChatMessage(Model):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(Model):
    board: Board
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


class AddCard(Model):
    type: Literal["add_card"]
    column_id: str
    title: Text
    details: Text


class UpdateCard(Model):
    type: Literal["update_card"]
    card_id: str
    title: Text | None = None
    details: Text | None = None


class MoveCard(Model):
    type: Literal["move_card"]
    card_id: str
    column_id: str
    position: int | None = Field(default=None, ge=0)


class DeleteCard(Model):
    type: Literal["delete_card"]
    card_id: str


class RenameColumn(Model):
    type: Literal["rename_column"]
    column_id: str
    name: ColumnName


class AddColumn(Model):
    type: Literal["add_column"]
    name: ColumnName
    # Assigned by the service, so later actions can refer to the new column.
    column_id: str | None = None


class RemoveColumn(Model):
    type: Literal["remove_column"]
    column_id: str


Action = Annotated[
    AddCard
    | UpdateCard
    | MoveCard
    | DeleteCard
    | RenameColumn
    | AddColumn
    | RemoveColumn,
    Field(discriminator="type"),
]


class AssistantReply(Model):
    reply: Text
    actions: list[Action] = []
