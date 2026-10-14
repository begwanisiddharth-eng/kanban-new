"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SquareKanban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

const COPY = {
  signin: {
    title: "Sign in",
    subtitle: "Welcome back. Sign in to open your boards.",
    submit: "Sign in",
    pending: "Signing in...",
    switch: ["New here?", "Create an account", "/signup"],
  },
  signup: {
    title: "Create your account",
    subtitle: "Start with an empty board and up to three in total.",
    submit: "Create account",
    pending: "Creating account...",
    switch: ["Already have an account?", "Sign in", "/signin"],
  },
} as const;

const REASONS: Record<string, string> = {
  timeout: "You were signed out after 20 minutes of inactivity.",
  expired: "Your session has ended. Please sign in again.",
};

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    setNotice(REASONS[reason ?? ""] ?? null);
    api.me().then(
      () => router.replace("/"),
      () => {},
    );
  }, [router]);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      await (mode === "signin" ? api.signIn : api.signUp)(email, password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-navy grid size-10 place-items-center rounded-xl text-white shadow-sm">
            <SquareKanban className="size-5" aria-hidden />
          </div>
          <span className="text-navy text-xl font-bold tracking-tight">
            Kanban
          </span>
        </div>
        <div className="border-border bg-surface rounded-2xl border p-6 shadow-sm">
          <h1 className="text-navy text-lg font-semibold">{copy.title}</h1>
          <p className="text-muted mt-1 text-sm">{copy.subtitle}</p>
          {notice && (
            <p
              role="status"
              className="border-accent/60 bg-accent/10 text-navy mt-4 rounded-lg border px-3 py-2 text-sm"
            >
              {notice}
            </p>
          )}
          <form action={submit} className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={mode === "signup" ? 8 : undefined}
                aria-describedby={
                  mode === "signup" ? "password-hint" : undefined
                }
                required
              />
              {mode === "signup" && (
                <p id="password-hint" className="text-muted text-sm">
                  At least 8 characters.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? copy.pending : copy.submit}
            </Button>
          </form>
        </div>
        <p className="text-navy/70 mt-6 text-center text-sm">
          {copy.switch[0]}{" "}
          <Link
            href={copy.switch[2]}
            className="text-navy decoration-primary hover:decoration-navy focus-visible:ring-ring/50 rounded-sm font-semibold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-[3px]"
          >
            {copy.switch[1]}
          </Link>
        </p>
      </div>
    </main>
  );
}
