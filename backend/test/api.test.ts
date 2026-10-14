import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("does not set a persistent cookie", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/signup")
      .send({ email: "cookie@example.com", password: "password123" });
    expect(res.headers["set-cookie"][0]).not.toMatch(/Max-Age|Expires/);
  });

  it("refuses a second sign-in while the account is signed in", async () => {
    const { email, agent } = await signUp();
    const other = request.agent(app);
    const res = await other
      .post("/api/auth/signin")
      .send({ email, password: "password123" })
      .expect(409);
    expect(res.body.error).toMatch(/already signed in somewhere else/);
    await agent.get("/api/auth/me").expect(200);
    await other.get("/api/auth/me").expect(401);
  });

  it("changes the password with the current one", async () => {
    const { email, agent } = await signUp("first-pass");
    const wrong = await agent
      .post("/api/auth/password")
      .send({ currentPassword: "nope", newPassword: "second-pass" })
      .expect(400);
    expect(wrong.body.error).toBe("Your current password is incorrect.");
    await agent
      .post("/api/auth/password")
      .send({ currentPassword: "first-pass", newPassword: "short" })
      .expect(400);
    await agent
      .post("/api/auth/password")
      .send({ currentPassword: "first-pass", newPassword: "second-pass" })
      .expect(204);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/signout").expect(204);
    await agent
      .post("/api/auth/signin")
      .send({ email, password: "first-pass" })
      .expect(401);
    await agent
      .post("/api/auth/signin")
      .send({ email, password: "second-pass" })
      .expect(200);
  });

  it("accepts a heartbeat only with a session", async () => {
    await request(app).post("/api/auth/heartbeat").expect(401);
    const { agent } = await signUp();
    await agent.post("/api/auth/heartbeat").expect(204);
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
    const { email, agent: signUpAgent } = await signUp("s3cret-pass");
    const agent = request.agent(app);
    await agent.get("/api/auth/me").expect(401);
    await agent
      .post("/api/auth/signin")
      .send({ email, password: "wrong-pass" })
      .expect(401);
    await agent
      .post("/api/auth/signin")
      .send({ email, password: "s3cret-pass" })
      .expect(409);
    await signUpAgent.post("/api/auth/signout").expect(204);
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

describe("chat", () => {
  afterEach(() => vi.restoreAllMocks());

  const body = () => ({
    board: createEmptyBoard(),
    messages: [{ role: "user", content: "What is on my board?" }],
  });

  it("requires a session and a valid request", async () => {
    await request(app).post("/api/chat").send(body()).expect(401);
    const { agent } = await signUp();
    await agent
      .post("/api/chat")
      .send({ ...body(), messages: [] })
      .expect(400);
  });

  it("forwards the request to the chat service", async () => {
    const answer = { reply: "It is empty.", actions: [] };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(answer));
    const { agent } = await signUp();
    const res = await agent.post("/api/chat").send(body()).expect(200);
    expect(res.body).toEqual(answer);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/chat");
    expect(JSON.parse(String(init?.body))).toEqual(body());
  });

  it("passes on chat service errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ detail: "Add GROQ_API_KEY." }, { status: 503 }),
    );
    const { agent } = await signUp();
    const res = await agent.post("/api/chat").send(body()).expect(503);
    expect(res.body.error).toBe("Add GROQ_API_KEY.");
  });

  it("passes on the usage limit and board size statuses", async () => {
    const { agent } = await signUp();
    for (const status of [413, 429]) {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        Response.json({ detail: `Status ${status}.` }, { status }),
      );
      const res = await agent.post("/api/chat").send(body()).expect(status);
      expect(res.body.error).toBe(`Status ${status}.`);
    }
  });

  it("reports when the chat service is not running", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("refused"));
    const { agent } = await signUp();
    const res = await agent.post("/api/chat").send(body()).expect(503);
    expect(res.body.error).toMatch(/not running/);
  });

  it("reports a chat service that takes too long", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("timed out", "TimeoutError"),
    );
    const { agent } = await signUp();
    const res = await agent.post("/api/chat").send(body()).expect(504);
    expect(res.body.error).toMatch(/took too long/);
  });

  it("copes with an error that is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );
    const { agent } = await signUp();
    const res = await agent.post("/api/chat").send(body()).expect(502);
    expect(res.body.error).toMatch(/could not answer/);
  });
});
