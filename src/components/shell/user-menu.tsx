"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, LogOut, Repeat } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AgentAvatar } from "@/components/agent-avatar";
import { signInDemo, signOut } from "@/app/actions";
import type { Agent } from "@/lib/types";

export function UserMenu({
  user,
  agent,
  users,
  tone = "dark",
}: {
  user: { id: string; name: string };
  agent: Pick<Agent, "name" | "color" | "avatarSeed">;
  users: { id: string; name: string; handle: string; agentName: string; color: string }[];
  tone?: "dark" | "light";
}) {
  const dark = tone === "dark";
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e) throw e;
        toast.error("Something went wrong");
      }
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className={`flex w-full items-center gap-3 rounded-full p-2 pr-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-lime/60 ${
          dark ? "bg-white/5 hover:bg-white/10" : "hover:bg-cream-2"
        }`}
      >
        <AgentAvatar agent={agent} size="md" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${dark ? "text-cream" : "text-foreground"}`}>{user.name}</span>
          <span className={`block truncate font-mono text-[11px] ${dark ? "text-cream/60" : "text-muted-foreground"}`}>{agent.name}</span>
        </span>
        <ChevronsUpDown className={`size-4 ${dark ? "text-cream/50" : "text-muted-foreground"}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64 rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <Repeat className="size-3.5" /> Switch human
        </div>
        {users.map((u) => (
          <DropdownMenuItem key={u.id} disabled={u.id === user.id} onClick={() => run(() => signInDemo(u.id))}>
            <span className="size-3 rounded-full" style={{ background: u.color }} />
            <span className="flex-1 truncate">{u.name}</span>
            <span className="truncate text-xs text-muted-foreground">{u.agentName}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run(() => signOut())}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
