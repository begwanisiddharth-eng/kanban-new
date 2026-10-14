import { useEffect, useRef, useState } from "react";

import { api, isSessionExpired } from "@/lib/api";

export const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
export const IDLE_WARNING_MS = 18 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
] as const;

type IdleOptions = { onTimeout: () => void; onExpired: () => void };

/**
 * Tracks activity in the page. Active users send a heartbeat each minute so
 * the server keeps the session alive; after 18 idle minutes a warning shows,
 * and at 20 minutes onTimeout runs.
 */
export function useIdleTimeout({ onTimeout, onExpired }: IdleOptions) {
  const lastActivity = useRef(Date.now());
  const lastHeartbeat = useRef(Date.now());
  const warningRef = useRef(false);
  const callbacks = useRef({ onTimeout, onExpired });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    callbacks.current = { onTimeout, onExpired };
  });

  useEffect(() => {
    const heartbeat = () => {
      lastHeartbeat.current = Date.now();
      api.heartbeat().catch((e) => {
        if (isSessionExpired(e)) callbacks.current.onExpired();
      });
    };
    const markActive = () => {
      if (!warningRef.current) lastActivity.current = Date.now();
    };
    const tick = () => {
      const now = Date.now();
      const idle = now - lastActivity.current;
      if (idle >= IDLE_TIMEOUT_MS) {
        clearInterval(timer);
        callbacks.current.onTimeout();
        return;
      }
      warningRef.current = idle >= IDLE_WARNING_MS;
      setSecondsLeft(
        warningRef.current ? Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000) : null,
      );
      if (
        lastActivity.current > lastHeartbeat.current &&
        now - lastHeartbeat.current >= HEARTBEAT_MS
      )
        heartbeat();
    };
    const timer = setInterval(tick, 1000);
    for (const event of ACTIVITY_EVENTS)
      window.addEventListener(event, markActive, { passive: true });
    return () => {
      clearInterval(timer);
      for (const event of ACTIVITY_EVENTS)
        window.removeEventListener(event, markActive);
    };
  }, []);

  const staySignedIn = () => {
    warningRef.current = false;
    lastActivity.current = Date.now();
    setSecondsLeft(null);
    lastHeartbeat.current = Date.now();
    api.heartbeat().catch((e) => {
      if (isSessionExpired(e)) callbacks.current.onExpired();
    });
  };

  return { secondsLeft, staySignedIn };
}
