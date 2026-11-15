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
}: {
  user: { id: string; name: string };
  agent: Pick<Agent, "name" | "color" | "avatarSeed">;
  users: { id: string; name: string; handle: string; agentName: string; color: string }[];
}) {
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
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      >
        <AgentAvatar agent={agent} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
          <span className="block truncate text-xs text-slate-500">{agent.name}</span>
        </span>
        <ChevronsUpDown className="size-4 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500">
          <Repeat className="size-3.5" /> Switch human
        </div>
        {users.map((u) => (
          <DropdownMenuItem key={u.id} disabled={u.id === user.id} onClick={() => run(() => signInDemo(u.id))}>
            <span className="size-3 rounded-full" style={{ background: u.color }} />
            <span className="flex-1 truncate">{u.name}</span>
            <span className="truncate text-xs text-slate-500">{u.agentName}</span>
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
