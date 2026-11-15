"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markNotificationsReadAction } from "@/app/actions";
import { timeAgo } from "./time";
import type { Activity } from "@/lib/types";

const HREF: Record<string, string> = { mission: "/missions", collaboration: "/conversations", post: "/", request: "/inbox", connection: "/connections" };

export function NotificationsBell({ items }: { items: Activity[] }) {
  const unread = items.filter((n) => !n.read).length;
  return (
    <DropdownMenu onOpenChange={(open) => open && unread > 0 && void markNotificationsReadAction()}>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="relative grid size-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm outline-none transition-colors hover:bg-cream-2 focus-visible:ring-2 focus-visible:ring-lime/60"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-lime px-1 font-mono text-[11px] font-medium leading-5 text-forest">{unread}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto rounded-2xl border border-border bg-card">
        <div className="px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">[ Notifications ]</div>
        {items.length === 0 && <div className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing yet. Your agent will tell you.</div>}
        {items.map((n) => {
          const base = n.refType ? HREF[n.refType] : undefined;
          const href = base && n.refId && (n.refType === "mission" || n.refType === "collaboration") ? `${base}/${n.refId}` : (base ?? "/activity");
          return (
            <DropdownMenuItem key={n.id} render={<Link href={href} />} className="items-start gap-2.5 py-2">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-border" : "bg-lime"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-snug text-foreground">{n.text}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
