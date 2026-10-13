import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSession,
  deleteSession,
  SESSION_TTL,
  validateSession,
} from "../src/sessions";
import { getDb } from "../src/db";
import { createUser } from "../src/users";

const user = createUser("session@example.com", "hash")!;

afterEach(() => vi.useRealTimers());

describe("sessions", () => {
  it("resolves a token to its user", () => {
    const { token } = createSession(user.id);
    expect(validateSession(token)).toEqual(user);
  });

  it("stores only a hash of the token", () => {
    const { token } = createSession(user.id);
    const ids = getDb().prepare("SELECT id FROM sessions").pluck().all();
    expect(ids).not.toContain(token);
  });

  it("rejects unknown, deleted and expired tokens", () => {
    expect(validateSession("nope")).toBeNull();
    const { token } = createSession(user.id);
    deleteSession(token);
    expect(validateSession(token)).toBeNull();

    const expired = createSession(user.id).token;
    vi.useFakeTimers({ now: Date.now() + SESSION_TTL + 1000 });
    expect(validateSession(expired)).toBeNull();
  });
});
