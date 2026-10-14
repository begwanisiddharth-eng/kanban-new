import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/lib/api";
import { useIdleTimeout } from "./useIdleTimeout";

vi.mock("@/lib/api", async (original) => {
  const actual = await original<typeof import("@/lib/api")>();
  return { ...actual, api: { heartbeat: vi.fn(async () => undefined) } };
});

const MINUTE = 60_000;
const onTimeout = vi.fn();
const onExpired = vi.fn();

function setup() {
  return renderHook(() => useIdleTimeout({ onTimeout, onExpired }));
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("useIdleTimeout", () => {
  it("warns at 18 idle minutes and times out at 20", () => {
    const { result } = setup();
    advance(18 * MINUTE - 2000);
    expect(result.current.secondsLeft).toBeNull();
    advance(2000);
    expect(result.current.secondsLeft).toBe(120);
    advance(MINUTE);
    expect(result.current.secondsLeft).toBe(60);
    expect(onTimeout).not.toHaveBeenCalled();
    advance(MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("activity resets the countdown and sends a heartbeat each minute", () => {
    setup();
    for (let i = 0; i < 25; i++) {
      advance(MINUTE);
      fireEvent.keyDown(window);
    }
    expect(onTimeout).not.toHaveBeenCalled();
    expect(vi.mocked(api.heartbeat).mock.calls.length).toBeGreaterThanOrEqual(
      24,
    );
  });

  it("sends no heartbeat while the user is idle", () => {
    setup();
    advance(10 * MINUTE);
    expect(api.heartbeat).not.toHaveBeenCalled();
  });

  it("only the button ends the warning", () => {
    const { result } = setup();
    advance(18 * MINUTE);
    fireEvent.pointerMove(window);
    advance(1000);
    expect(result.current.secondsLeft).not.toBeNull();
    act(() => result.current.staySignedIn());
    expect(result.current.secondsLeft).toBeNull();
    expect(api.heartbeat).toHaveBeenCalledTimes(1);
    advance(19 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("reports a session the server has already ended", async () => {
    vi.mocked(api.heartbeat).mockRejectedValueOnce(
      new ApiError(401, "Sign in to continue."),
    );
    setup();
    advance(1000);
    fireEvent.keyDown(window);
    advance(MINUTE);
    await act(async () => {});
    expect(onExpired).toHaveBeenCalled();
  });
});
