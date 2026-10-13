import { z } from "zod";

const text = z.string().trim().min(1);

const column = z.object({
  id: z.string().min(1),
  name: text.max(60),
  cardIds: z.array(z.string()),
});

const card = z.object({ id: z.string().min(1), title: text, details: text });

export const boardSchema = z
  .object({
    columns: z.tuple([column, column, column, column, column]),
    cards: z.record(z.string(), card),
  })
  .refine(({ columns, cards }) => {
    const ids = columns.flatMap((c) => c.cardIds);
    return (
      ids.length === Object.keys(cards).length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => cards[id]?.id === id)
    );
  }, "Every card must belong to exactly one column");

export type Board = z.infer<typeof boardSchema>;
export type BoardSummary = { id: string; name: string };
export type SavedBoard = BoardSummary & { data: Board };

export const boardNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a board name." })
  .max(60, { error: "Use 60 characters or fewer." });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }).max(254));

export const signUpSchema = z.object({
  email,
  password: z
    .string()
    .min(8, { error: "Use at least 8 characters for your password." })
    .max(128, { error: "Use 128 characters or fewer for your password." }),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }),
});
