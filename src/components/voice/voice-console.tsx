"use client";

import Link from "next/link";
import { useState } from "react";
import { Mic, Square, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoiceAgent, type VoiceMode, type VoiceStatus } from "./use-voice-agent";

const SUGGESTIONS = [
  "Find someone who wants to go hiking this weekend",
  "What have the other agents discovered today?",
  "Ask whether anyone nearby knows about a good AI event",
  "What has my agent been doing?",
];

const MODE_LABEL: Record<VoiceMode, string> = { live: "Live · Deepgram", browser: "Browser voice", simulated: "Simulated voice" };
const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Tap the mic to talk",
  connecting: "Connecting...",
  listening: "Listening",
  thinking: "Thinking...",
  speaking: "Speaking (talk to interrupt)",
  error: "Something went wrong",
};

export function VoiceConsole() {
  const v = useVoiceAgent();
  const [text, setText] = useState("");
  const recording = v.status === "listening" || v.status === "thinking" || v.status === "speaking";
  const running = recording || v.status === "connecting";
  const simulated = v.mode === "simulated";

  return (
    <section className="space-y-5 ac-panel-dark p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {v.mode ? (
            <Badge variant="secondary" className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${v.mode === "live" ? "bg-lime/20 text-lime" : "bg-sand text-sand-foreground"}`}>
              {MODE_LABEL[v.mode]}
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider border-white/15 text-cream/70">Voice ready</Badge>
          )}
          {recording && (
            <Badge className="rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider bg-lime text-forest" role="status">
              <span className="size-1.5 animate-pulse rounded-full bg-forest" /> Mic on
            </Badge>
          )}
        </div>
        <span className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-cream/50">
          <ShieldCheck className="size-3.5" /> AI replies are unverified
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative flex size-28 items-center justify-center">
          {recording && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-lime/40" />
              <span className="absolute inset-3 animate-ping rounded-full bg-lime/40 [animation-delay:300ms]" />
            </>
          )}
          <button
            type="button"
            onClick={running ? v.stop : v.start}
            aria-label={running ? "Stop listening" : "Start talking to your agent"}
            className={`relative flex size-20 items-center justify-center rounded-full bg-lime text-forest shadow-lg transition-colors hover:bg-[#b5f5a3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime/40 ${
              running ? "ring-4 ring-lime/40" : ""
            }`}
          >
            {running ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
          </button>
        </div>
        <p className="text-sm font-medium text-cream/80" aria-live="polite">
          {simulated && v.status === "idle" ? "No speech available. Type below (simulated voice)." : STATUS_LABEL[v.status]}
        </p>
        <p className={`min-h-6 max-w-prose text-center text-base ${v.interim ? "text-cream/50" : "text-transparent"}`} aria-live="polite">
          {v.interim || "..."}
        </p>
      </div>

      {v.error && <p className="rounded-2xl bg-destructive/15 px-3 py-2 text-sm text-[#ff9a86]">{v.error}</p>}

      {v.pendingConfirm && (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-cream">Needs your confirmation</p>
          <p className="text-sm text-cream/80">{v.pendingConfirm.prompt}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={v.confirm} className="rounded-full bg-lime text-forest hover:bg-[#b5f5a3]">
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={v.dismissConfirm} className="rounded-full border-white/15 bg-white/10 text-cream hover:bg-white/15 hover:text-cream">
              Not now
            </Button>
          </div>
          <p className="text-xs text-cream/50">You can also say &quot;confirm&quot;.</p>
        </div>
      )}

      {v.turns.length > 0 && (
        <ol className="max-h-96 space-y-3 overflow-y-auto" aria-label="Conversation">
          {v.turns.map((t, i) => (
            <li key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm ${t.role === "user" ? "bg-white/10 text-cream" : "bg-lime/15 text-cream"}`}>
                <p>{t.text}</p>
                {t.role === "agent" && t.aiSource && (
                  <p className="font-mono text-[10.5px] uppercase tracking-wider text-cream/50">{t.aiSource === "live" ? "AI-generated, unverified" : "Simulated, unverified"}</p>
                )}
                {t.actions && t.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.actions.map((a, j) =>
                      a.href ? (
                        <Link key={j} href={a.href} className="rounded-full bg-lime px-2.5 py-1 text-xs font-medium text-forest hover:bg-[#b5f5a3]">
                          {a.label}
                        </Link>
                      ) : (
                        <span key={j} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-cream/70">
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

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => v.sendText(s)}
            disabled={v.status === "thinking"}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-cream/80 hover:bg-white/10 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          v.sendText(text);
          setText("");
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={simulated ? "Type what you would say (simulated voice)" : "Or type to your agent"} aria-label="Message your agent" className="h-9 rounded-full border-white/10 bg-white/5 px-4 text-cream placeholder:text-cream/40" />
        <Button type="submit" disabled={!text.trim() || v.status === "thinking"} className="rounded-full bg-lime text-forest hover:bg-[#b5f5a3]">
          Send
        </Button>
      </form>
    </section>
  );
}
