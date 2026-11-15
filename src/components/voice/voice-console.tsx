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
    <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {v.mode ? (
            <Badge variant="secondary" className={v.mode === "live" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}>
              {MODE_LABEL[v.mode]}
            </Badge>
          ) : (
            <Badge variant="outline">Voice ready</Badge>
          )}
          {recording && (
            <Badge className="bg-[#ff6b57] text-white" role="status">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> Mic on
            </Badge>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> AI replies are unverified
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative flex size-28 items-center justify-center">
          {recording && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ff6b57]/25" />
              <span className="absolute inset-3 animate-ping rounded-full bg-[#ff6b57]/25 [animation-delay:300ms]" />
            </>
          )}
          <button
            type="button"
            onClick={running ? v.stop : v.start}
            aria-label={running ? "Stop listening" : "Start talking to your agent"}
            className={`relative flex size-20 items-center justify-center rounded-full text-white shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 ${
              running ? "bg-[#ff6b57] hover:bg-[#f2573f]" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {running ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
          </button>
        </div>
        <p className="text-sm font-medium text-slate-700" aria-live="polite">
          {simulated && v.status === "idle" ? "No speech available. Type below (simulated voice)." : STATUS_LABEL[v.status]}
        </p>
        <p className={`min-h-6 max-w-prose text-center text-base ${v.interim ? "text-slate-400" : "text-transparent"}`} aria-live="polite">
          {v.interim || "..."}
        </p>
      </div>

      {v.error && <p className="rounded-lg bg-[#ff6b57]/10 px-3 py-2 text-sm text-[#c2412d]">{v.error}</p>}

      {v.pendingConfirm && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Needs your confirmation</p>
          <p className="text-sm text-amber-900/90">{v.pendingConfirm.prompt}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={v.confirm} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={v.dismissConfirm}>
              Not now
            </Button>
          </div>
          <p className="text-xs text-amber-900/70">You can also say &quot;confirm&quot;.</p>
        </div>
      )}

      {v.turns.length > 0 && (
        <ol className="max-h-96 space-y-3 overflow-y-auto" aria-label="Conversation">
          {v.turns.map((t, i) => (
            <li key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm ${t.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900"}`}>
                <p>{t.text}</p>
                {t.role === "agent" && t.aiSource && (
                  <p className="text-[11px] text-slate-500">{t.aiSource === "live" ? "AI-generated, unverified" : "Simulated, unverified"}</p>
                )}
                {t.actions && t.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.actions.map((a, j) =>
                      a.href ? (
                        <Link key={j} href={a.href} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
                          {a.label}
                        </Link>
                      ) : (
                        <span key={j} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
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
            className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
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
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={simulated ? "Type what you would say (simulated voice)" : "Or type to your agent"} aria-label="Message your agent" />
        <Button type="submit" disabled={!text.trim() || v.status === "thinking"} className="bg-indigo-600 text-white hover:bg-indigo-700">
          Send
        </Button>
      </form>
    </section>
  );
}
