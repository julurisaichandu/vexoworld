"use client";

import Link from "next/link";
import { Mic, Square, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useVoiceAgent, VoiceStatus } from "./use-voice-agent";

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Tap the mic to talk",
  connecting: "Connecting...",
  listening: "Listening",
  thinking: "Thinking...",
  speaking: "Speaking (talk to interrupt)",
  error: "Something went wrong",
};

export function VoiceConsole({ v }: { v: ReturnType<typeof useVoiceAgent> }) {
  const running = v.status === "listening" || v.status === "thinking" || v.status === "speaking" || v.status === "connecting";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={running ? v.stop : v.start}
          aria-label={running ? "Stop listening" : "Start talking to your agent"}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-forest hover:bg-[#b5f5a3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime/40 ${running ? "ring-4 ring-lime/40" : ""}`}
        >
          {running ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
        </button>
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground/80" aria-live="polite">
          {v.mode === "simulated" && v.status === "idle" ? "No speech available (simulated voice)" : STATUS_LABEL[v.status]}
        </p>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="size-3.5" /> AI replies are unverified
        </span>
      </div>
      {v.interim && <p className="text-sm text-muted-foreground" aria-live="polite">{v.interim}</p>}
      {v.error && <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{v.error}</p>}

      {v.pendingConfirm && (
        <div className="space-y-2 rounded-2xl bg-cream-2 p-3">
          <p className="text-sm font-medium">Needs your confirmation</p>
          <p className="text-sm text-foreground/80">{v.pendingConfirm.prompt}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={v.confirm} className="rounded-full bg-ink text-cream hover:bg-forest">
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={v.dismissConfirm} className="rounded-full">
              Not now
            </Button>
          </div>
        </div>
      )}

      {v.turns.length > 0 && (
        <ol className="max-h-60 space-y-2 overflow-y-auto" aria-label="Conversation">
          {v.turns.map((t, i) => (
            <li key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm ${t.role === "user" ? "bg-ink text-cream" : "bg-cream-2 text-foreground"}`}>
                <p>{t.text}</p>
                {t.role === "agent" && t.aiSource && (
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t.aiSource === "live" ? "AI-generated, unverified" : "Simulated, unverified"}</p>
                )}
                {t.actions && t.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.actions.map((a, j) =>
                      a.href ? (
                        <Link key={j} href={a.href} className="rounded-full bg-lime px-2.5 py-1 text-xs font-medium text-forest hover:bg-[#b5f5a3]">
                          {a.label}
                        </Link>
                      ) : (
                        <span key={j} className="rounded-full bg-card px-2.5 py-1 text-xs text-muted-foreground">
                          {a.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
