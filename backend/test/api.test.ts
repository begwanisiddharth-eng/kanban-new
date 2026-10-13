import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createEmptyBoard } from "../src/emptyBoard";

const app = createApp();
let n = 0;

async function signUp(password = "password123") {
  const agent = request.agent(app);
  const email = `user${++n}@example.com`;
  const res = await agent
    .post("/api/auth/signup")
    .send({ email, password })
    .expect(201);
  return { agent, email, user: res.body as { id: string; email: string } };
}

describe("auth", () => {
  it("signs up with an httpOnly session cookie and one empty board", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/signup")
      .send({ email: "  New@Example.com ", password: "password123" })
      .expect(201);
    expect(res.body.email).toBe("new@example.com");
    expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(res.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);

    const boards = await agent.get("/api/boards").expect(200);
    expect(boards.body).toEqual([{ id: expect.any(String), name: "My board" }]);
    const board = await agent.get(`/api/boards/${boards.body[0].id}`);
    expect(board.body.data).toEqual(createEmptyBoard());
  });

  it("validates sign-up input", async () => {
    const short = await request(app)
      .post("/api/auth/signup")
      .send({ email: "a@example.com", password: "short" })
      .expect(400);
    expect(short.body.error).toMatch(/at least 8 characters/);
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "password123" })
      .expect(400);
  });

  it("rejects a duplicate email regardless of case", async () => {
    const { email } = await signUp();
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: email.toUpperCase(), password: "password123" })
      .expect(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it("signs in, reports the user and signs out", async () => {
    const { email } = await signUp("s3cret-pass");
    const agent = request.agent(app);
    await agent.get("/api/auth/me").expect(401);
    await agent
      .post("/api/auth/signin")
      .send({ email, password: "wrong-pass" })
      .expect(401);
    await agent
      .post("/api/auth/signin")
      .send({ email, password: "s3cret-pass" })
      .expect(200);
    expect((await agent.get("/api/auth/me").expect(200)).body.email).toBe(
      email,
    );
    await agent.post("/api/auth/signout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("gives the same error for an unknown email and a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/signin")
      .send({ email: "nobody@example.com", password: "whatever1" })
      .expect(401);
    expect(res.body.error).toBe("Incorrect email or password.");
  });
});

describe("boards", () => {
  it("requires a session", async () => {
    await request(app).get("/api/boards").expect(401);
    await request(app).post("/api/boards").send({ name: "X" }).expect(401);
  });

  it("creates up to three boards", async () => {
    const { agent } = await signUp();
    await agent.post("/api/boards").send({ name: "  " }).expect(400);
    const second = await agent
      .post("/api/boards")
      .send({ name: " Roadmap " })
      .expect(201);
    expect(second.body).toMatchObject({
      name: "Roadmap",
      data: createEmptyBoard(),
    });
    await agent.post("/api/boards").send({ name: "Third" }).expect(201);
    const fourth = await agent
      .post("/api/boards")
      .send({ name: "Fourth" })
      .expect(409);
    expect(fourth.body.error).toBe("You can have up to 3 boards.");
    const names = (await agent.get("/api/boards")).body.map(
      (b: { name: string }) => b.name,
    );
    expect(names).toEqual(["My board", "Roadmap", "Third"]);
  });

  it("saves and reloads board data", async () => {
    const { agent } = await signUp();
    const [{ id }] = (await agent.get("/api/boards")).body;
    const data = createEmptyBoard();
    data.columns[1].name = "Next";
    data.cards.c1 = { id: "c1", title: "Ship", details: "Release v1" };
    data.columns[1].cardIds.push("c1");
    await agent.put(`/api/boards/${id}`).send(data).expect(204);
    expect((await agent.get(`/api/boards/${id}`)).body.data).toEqual(data);

    data.columns[1].cardIds = [];
    await agent.put(`/api/boards/${id}`).send(data).expect(400);
  });

  it("deletes a board but never the last one", async () => {
    const { agent } = await signUp();
    const [{ id: first }] = (await agent.get("/api/boards")).body;
    await agent.delete(`/api/boards/${first}`).expect(409);
    const { body: second } = await agent
      .post("/api/boards")
      .send({ name: "Second" });
    await agent.delete(`/api/boards/${first}`).expect(204);
    expect((await agent.get("/api/boards")).body).toEqual([
      { id: second.id, name: "Second" },
    ]);
  });

  it("keeps each user's boards private", async () => {
    const owner = await signUp();
    const other = await signUp();
    const [{ id }] = (await owner.agent.get("/api/boards")).body;
    await other.agent.get(`/api/boards/${id}`).expect(404);
    await other.agent
      .put(`/api/boards/${id}`)
      .send(createEmptyBoard())
      .expect(404);
    await other.agent.delete(`/api/boards/${id}`).expect(404);
    expect((await other.agent.get("/api/boards")).body).toHaveLength(1);
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/nothing").expect(404);
    expect(res.body.error).toBe("Not found.");
  });
});
