import { Router } from "express";

import { requireUser, type AuthedResponse } from "../auth";
import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  MAX_BOARDS,
  saveBoard,
} from "../boards";
import { createEmptyBoard } from "../emptyBoard";
import { boardNameSchema, boardSchema } from "../schema";

export const boardsRouter = Router();

boardsRouter.use(requireUser);

const NOT_FOUND = { error: "Board not found." };

boardsRouter.get("/", (_req, res: AuthedResponse) => {
  res.json(listBoards(res.locals.user.id));
});

boardsRouter.post("/", (req, res: AuthedResponse) => {
  const name = boardNameSchema.safeParse(req.body?.name);
  if (!name.success) {
    res.status(400).json({ error: name.error.issues[0].message });
    return;
  }
  const board = createBoard(res.locals.user.id, name.data, createEmptyBoard());
  if (!board) {
    res.status(409).json({ error: `You can have up to ${MAX_BOARDS} boards.` });
    return;
  }
  res.status(201).json(board);
});

boardsRouter.get("/:id", (req, res: AuthedResponse) => {
  const board = getBoard(res.locals.user.id, req.params.id);
  if (board) res.json(board);
  else res.status(404).json(NOT_FOUND);
});

boardsRouter.put("/:id", (req, res: AuthedResponse) => {
  const body = boardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid board data." });
    return;
  }
  if (saveBoard(res.locals.user.id, req.params.id, body.data))
    res.status(204).end();
  else res.status(404).json(NOT_FOUND);
});

boardsRouter.delete("/:id", (req, res: AuthedResponse) => {
  const result = deleteBoard(res.locals.user.id, req.params.id);
  if (result === "deleted") res.status(204).end();
  else if (result === "not-found") res.status(404).json(NOT_FOUND);
  else res.status(409).json({ error: "You cannot delete your only board." });
});
