"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Source = "voice" | "simulated_voice";
type Label = "Deepgram" | "browser speech" | "simulated";

type Recognition = {
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

export function VoiceAnswer({ onTranscript, disabled }: { onTranscript: (text: string, source: Source) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "recording" | "working" | "typed">("idle");
  const [seconds, setSeconds] = useState(0);
  const [label, setLabel] = useState<Label | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const browserNext = useRef(false); // set after Deepgram fails: the next click uses browser speech

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      recognition.current?.stop();
    },
    [],
  );

  const done = (t: string, l: Label, source: Source) => {
    setLabel(l);
    setPhase("idle");
    if (t.trim()) onTranscript(t.trim(), source);
    else setError("Nothing was heard. Try again.");
  };

  const startBrowser = (): boolean => {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return false;
    const rec = new Ctor();
    rec.lang = "en-US";
    heard.current = "";
    rec.onresult = (e) => {
      heard.current = Array.from(e.results, (r) => r[0].transcript).join(" ");
    };
    rec.onerror = () => {
      recognition.current = null;
      setPhase("typed");
    };
    rec.onend = () => {
      if (recognition.current !== rec) return;
      recognition.current = null;
      done(heard.current, "browser speech", "voice");
    };
    recognition.current = rec;
    rec.start();
    setSeconds(0);
    setPhase("recording");
    return true;
  };

  const begin = async () => {
    setError(null);
    setLabel(null);
    setSeconds(0);
    if (browserNext.current) {
      browserNext.current = false;
      if (!startBrowser()) setPhase("typed");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];
      const rec = new MediaRecorder(media);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        stream.current = null;
        setPhase("working");
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const res = await fetch("/api/voice/transcribe", { method: "POST", headers: { "Content-Type": blob.type }, body: blob }).catch(() => null);
        if (res?.ok) return done(((await res.json()) as { transcript: string }).transcript, "Deepgram", "voice");
        if (res?.status === 401) {
          setError("Please sign in again.");
          return setPhase("idle");
        }
        // The mic only starts from a click: ask again instead of reopening it from this callback.
        setError("Deepgram is unavailable. Press the mic again for browser speech, or type it below.");
        browserNext.current = true;
        setPhase("idle");
      };
      recorder.current = rec;
      rec.start();
      setPhase("recording");
    } catch {
      if (!startBrowser()) setPhase("typed");
    }
  };

  const end = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    else recognition.current?.stop();
  };

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      {phase !== "typed" && (
        <div className="flex items-center gap-3">
          {phase === "recording" ? (
            <Button type="button" size="sm" onClick={end} className="rounded-full bg-ink text-cream hover:bg-forest">
              <Square className="fill-current" /> Stop
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={begin} className="rounded-full border-ink/15 bg-card hover:bg-cream-2" disabled={disabled || phase === "working"}>
              <Mic /> {phase === "working" ? "Transcribing..." : "Answer by voice"}
            </Button>
          )}
          {phase === "recording" && (
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-forest" role="status">
              <span className="size-2 animate-pulse rounded-full bg-lime" /> Recording {mm}
            </span>
          )}
          {phase === "idle" && label && <span className="text-xs text-muted-foreground">{label === "simulated" ? "simulated voice" : `transcribed by ${label}`}</span>}
        </div>
      )}
      {phase === "typed" && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onTranscript(text.trim(), "simulated_voice");
            setLabel("simulated");
            setText("");
            setPhase("idle");
          }}
        >
          <Input className="rounded-full bg-cream-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type what you would say" disabled={disabled} />
          <Button type="submit" size="sm" className="rounded-full bg-lime text-forest hover:bg-[#b5f5a3]" disabled={disabled || !text.trim()}>
            Use as simulated voice answer
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-muted-foreground">{error}</p>}
    </div>
  );
}
