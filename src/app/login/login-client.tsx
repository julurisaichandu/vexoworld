"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentAvatar } from "@/components/agent-avatar";
import { signIn, signInDemo, signUp } from "@/app/actions";

type Demo = { id: string; name: string; handle: string; agentName: string; color: string };

export function DemoCards({ users }: { users: Demo[] }) {
  const [pending, start] = useTransition();
  const [who, setWho] = useState<string | null>(null);
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          disabled={pending}
          onClick={() => {
            setWho(u.id);
            start(async () => {
              try {
                await signInDemo(u.id);
              } catch (e) {
                if (e && typeof e === "object" && "digest" in e) throw e;
                toast.error("Could not sign in");
              }
            });
          }}
          className="ac-card group flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 disabled:opacity-60"
        >
          <AgentAvatar agent={{ name: u.agentName, color: u.color, avatarSeed: u.id }} size="md" />
          <span className="min-w-0">
            <span className="block font-semibold text-slate-900">{who === u.id && pending ? "Signing in…" : u.name}</span>
            <span className="block truncate text-sm text-slate-500">{u.agentName}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function AuthForms() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="ac-card mt-4 p-5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(undefined);
            }}
            className={`rounded-lg py-2 transition ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await (mode === "in" ? signIn(fd) : signUp(fd));
            if (res?.error) setError(res.error);
          });
        }}
      >
        {mode === "up" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" required autoComplete="name" className="h-10" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={mode === "up" ? 8 : undefined} autoComplete={mode === "in" ? "current-password" : "new-password"} className="h-10" />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Button type="submit" disabled={pending} className="h-10 w-full bg-indigo-600 text-white hover:bg-indigo-700">
          {pending ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
