"use client";

import { useEffect, useRef, useState } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const URL = process.env.NEXT_PUBLIC_PIPECAT_URL;

type Line = { who: "you" | "agent"; text: string };

export function PipecatVoice() {
  const clientRef = useRef<PipecatClient | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => () => void clientRef.current?.disconnect(), []);

  if (!URL) {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Pipecat live voice is optional — run voice-agent/ and set NEXT_PUBLIC_PIPECAT_URL
      </div>
    );
  }

  const push = (who: Line["who"], text: string) =>
    setLines((l) => (l.at(-1)?.who === who ? [...l.slice(0, -1), { who, text: `${l.at(-1)!.text} ${text}` }] : [...l, { who, text }]).slice(-20));

  async function connect() {
    setError(null);
    setLines([]);
    setStatus("connecting");
    try {
      const res = await fetch("/api/voice/pipecat-token", { method: "POST" });
      if (!res.ok) throw new Error("Sign in to use live voice");
      const { token } = await res.json();
      const client = new PipecatClient({
        transport: new SmallWebRTCTransport(),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onBotReady: () => setStatus("live"),
          onDisconnected: () => setStatus("idle"),
          onUserTranscript: (t) => t.final && push("you", t.text),
          onBotOutput: (o) => o.output_type !== "word" && push("agent", o.text),
          onTrackStarted: (track, p) => {
            if (p?.local || track.kind !== "audio" || !audioRef.current) return;
            audioRef.current.srcObject = new MediaStream([track]);
          },
          onError: () => setError("Voice connection error"),
        },
      });
      clientRef.current = client;
      await client.startBotAndConnect({
        endpoint: `${URL}/start`,
        requestData: { transport: "webrtc", enableDefaultIceServers: true, body: { token } },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect");
      setStatus("idle");
      await clientRef.current?.disconnect().catch(() => {});
    }
  }

  async function disconnect() {
    await clientRef.current?.disconnect();
    setStatus("idle");
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          Live voice (Pipecat)
          <Badge variant={status === "live" ? "default" : "secondary"}>{status}</Badge>
        </div>
        {status === "idle" ? (
          <Button size="sm" onClick={connect}>Connect</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={disconnect}>Disconnect</Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {lines.length > 0 && (
        <ul className="space-y-1 text-sm">
          {lines.map((l, i) => (
            <li key={i}>
              <span className="font-medium">{l.who === "you" ? "You" : "Agent"}:</span> {l.text}
            </li>
          ))}
        </ul>
      )}
      <audio ref={audioRef} autoPlay />
    </div>
  );
}
