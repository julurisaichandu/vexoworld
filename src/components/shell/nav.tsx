"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Activity, Bot, Compass, Home, Inbox, MessagesSquare, MoreHorizontal, Settings, Target, Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/agent", label: "My Agent", icon: Bot },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/missions", label: "Missions", icon: Target },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/connections", label: "Connections", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

const active = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function Count({ n }: { n: number }) {
  return n > 0 ? (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold leading-5 text-white">{n}</span>
  ) : null;
}

export function SidebarNav({ pending, onNavigate }: { pending: number; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const on = active(path, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              on ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className={`size-[18px] ${on ? "text-indigo-600" : ""}`} />
            {label}
            {href === "/inbox" && <Count n={pending} />}
          </Link>
        );
      })}
    </nav>
  );
}

const TABS = ["/", "/agent", "/missions", "/inbox"];

export function MobileTabs({ pending, menu }: { pending: number; menu: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = ITEMS.filter((i) => TABS.includes(i.href));
  const moreOn = !TABS.some((t) => active(path, t));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link key={href} href={href} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${on ? "text-indigo-600" : "text-slate-500"}`}>
              <Icon className="size-5" />
              {href === "/agent" ? "Agent" : label}
              {href === "/inbox" && pending > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">{pending}</span>
              )}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${moreOn ? "text-indigo-600" : "text-slate-500"}`}>
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-white p-4">
          <SheetHeader>
            <SheetTitle className="font-heading text-lg">More</SheetTitle>
          </SheetHeader>
          <SidebarNav pending={pending} onNavigate={() => setOpen(false)} />
          <div className="mt-2 border-t border-border pt-3">{menu}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
