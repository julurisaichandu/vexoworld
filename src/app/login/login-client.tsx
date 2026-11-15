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
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          className="ac-card group flex flex-col gap-4 p-5 text-left transition hover:-translate-y-1 hover:border-lime hover:shadow-lg disabled:opacity-60"
        >
          <AgentAvatar agent={{ name: u.agentName, color: u.color, avatarSeed: u.id }} size="md" />
          <span className="min-w-0">
            <span className="block font-heading text-2xl leading-tight tracking-[-0.02em] text-foreground">{who === u.id && pending ? "Signing in…" : u.name}</span>
            <span className="mt-1 block truncate font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{u.agentName}</span>
          </span>
          <span className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream transition group-hover:bg-forest">
            Continue as {u.name.split(" ")[0]}
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
    <div className="ac-card mt-6 p-5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-cream-2 p-1 text-sm font-medium">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(undefined);
            }}
            className={`rounded-full py-2 transition ${mode === m ? "bg-ink text-cream shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
            <Input id="name" name="name" required autoComplete="name" className="h-10 rounded-xl border-border bg-card focus-visible:ring-forest/30" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-10 rounded-xl border-border bg-card focus-visible:ring-forest/30" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={mode === "up" ? 8 : undefined} autoComplete={mode === "in" ? "current-password" : "new-password"} className="h-10 rounded-xl border-border bg-card focus-visible:ring-forest/30" />
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className="h-10 w-full rounded-full bg-ink text-cream hover:bg-forest">
          {pending ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
