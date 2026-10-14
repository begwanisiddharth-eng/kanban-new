import { afterEach, describe, expect, it, vi } from "vitest";

import { getDb } from "../src/db";
import {
  createSession,
  deleteSession,
  SESSION_IDLE_MS,
  validateSession,
} from "../src/sessions";
import { createUser } from "../src/users";

let n = 0;
const newUser = () => createUser(`session${++n}@example.com`, "hash")!;
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

afterEach(() => vi.useRealTimers());

describe("sessions", () => {
  it("resolves a token to its user", () => {
    const user = newUser();
    expect(validateSession(createSession(user.id)!)).toEqual(user);
  });

  it("stores only a hash of the token", () => {
    const token = createSession(newUser().id)!;
    const ids = getDb().prepare("SELECT id FROM sessions").pluck().all();
    expect(ids).not.toContain(token);
  });

  it("rejects unknown and deleted tokens", () => {
    expect(validateSession("nope")).toBeNull();
    const token = createSession(newUser().id)!;
    deleteSession(token);
    expect(validateSession(token)).toBeNull();
  });

  it("expires after 20 minutes without activity", () => {
    vi.useFakeTimers();
    const token = createSession(newUser().id)!;
    later(SESSION_IDLE_MS - 1000);
    expect(validateSession(token)).not.toBeNull();
    later(SESSION_IDLE_MS - 1000);
    expect(validateSession(token)).not.toBeNull();
    later(SESSION_IDLE_MS + 1000);
    expect(validateSession(token)).toBeNull();
  });

  it("allows only one active session per user", () => {
    vi.useFakeTimers();
    const user = newUser();
    const first = createSession(user.id)!;
    expect(createSession(user.id)).toBeNull();

    deleteSession(first);
    const second = createSession(user.id)!;
    expect(second).toBeTruthy();

    later(SESSION_IDLE_MS + 1000);
    expect(createSession(user.id)).toBeTruthy();
    expect(validateSession(second)).toBeNull();
  });
});
