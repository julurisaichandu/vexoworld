"use client";

import type { ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type PlayTone = "paper" | "lime" | "ink" | "sand" | "ghost";

const TONE: Record<PlayTone, string> = {
  paper: "bg-card text-foreground ring-1 ring-ink/8",
  lime: "bg-lime text-forest",
  ink: "bg-ink text-cream",
  sand: "bg-sand text-sand-foreground",
  ghost: "bg-transparent text-muted-foreground border-2 border-dashed border-ink/15 hover:border-forest/40",
};

/** Lay PlayCards out with this: as many ~170px squares as the column fits (2 on a phone). */
export const PLAY_GRID = "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3";

/**
 * A small square "playable" card. The face shows a one-glance summary; clicking anywhere on it
 * expands the full content (`children`) in a dialog. `actions` stay clickable on the face.
 */
export function PlayCard({
  tone = "paper",
  label,
  eyebrow,
  corner,
  title,
  footer,
  actions,
  children,
  open,
  onOpenChange,
  wide,
}: {
  tone?: PlayTone;
  /** Accessible name: the trigger's aria-label and the dialog title. */
  label: string;
  eyebrow?: ReactNode;
  corner?: ReactNode;
  /** The summary headline, clamped to four lines. */
  title: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Wider dialog for long threads or forms. */
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}>
      <div
        className={`group relative flex aspect-square min-w-0 flex-col overflow-hidden rounded-3xl p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest/50 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background shadow-[0_1px_2px_rgb(14_23_17/0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgb(14_23_17/0.55)] odd:hover:-rotate-1 even:hover:rotate-1 motion-reduce:transition-none motion-reduce:hover:transform-none animate-in fade-in zoom-in-95 duration-300 ${TONE[tone]}`}
      >
        <DialogTrigger
          aria-label={`Open: ${label}`}
          className="absolute inset-0 z-0 cursor-pointer rounded-3xl outline-none"
        />
        <div className="pointer-events-none relative flex min-h-5 items-start justify-between gap-2 font-mono text-[10px] uppercase tracking-wider opacity-80">
          <span className="min-w-0 truncate">{eyebrow}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {corner}
            <Maximize2 className="size-3 opacity-0 transition-opacity group-hover:opacity-70" aria-hidden />
          </span>
        </div>
        <div className="pointer-events-none relative mt-2 line-clamp-4 font-heading text-[17px] leading-[1.18] tracking-[-0.015em] break-words">
          {title}
        </div>
        <div className="pointer-events-none relative mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0 flex-1 text-xs">{footer}</div>
          {actions && <div className="pointer-events-auto relative z-10 shrink-0">{actions}</div>}
        </div>
      </div>
      <DialogContent className={`max-h-[85dvh] overflow-y-auto rounded-3xl bg-card p-6 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
