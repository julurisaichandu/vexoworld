"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
export type VoiceMode = "live" | "browser" | "simulated";
export type ChatAction = { label: string; href?: string };
export type Turn = { role: "user" | "agent"; text: string; aiSource?: "live" | "simulated"; actions?: ChatAction[] };
export type PendingConfirm = { requestId: string; prompt: string };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

const SpeechRecognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => Recognition>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isConfirmWord = (s: string) => /^\W*(yes\W+|ok\W+|okay\W+)?confirm(ed)?\W*$/i.test(s.trim());

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [mode, setMode] = useState<VoiceMode | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = useRef(false);
  const modeRef = useRef<VoiceMode | null>(null);
  const confirmRef = useRef<PendingConfirm | null>(null);
  const epoch = useRef(0); // bumped on barge-in so a stale reply is not spoken
  const queue = useRef<Promise<void>>(Promise.resolve());
  const ws = useRef<WebSocket | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ttsAbort = useRef<AbortController | null>(null);
  const finals = useRef("");

  const setConfirm = (c: PendingConfirm | null) => {
    confirmRef.current = c;
    setPendingConfirm(c);
  };
  const idleStatus = (): VoiceStatus => (active.current && modeRef.current !== "simulated" ? "listening" : "idle");

  const stopPlayback = useCallback(() => {
    ttsAbort.current?.abort();
    ttsAbort.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.src = "";
      audio.current = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, []);

  const speak = useCallback(async (text: string, myEpoch: number) => {
    const browserSpeak = () =>
      new Promise<void>((resolve) => {
        if (typeof speechSynthesis === "undefined") return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
      });
    if (epoch.current !== myEpoch) return;
    setStatus("speaking");
    if (modeRef.current !== "simulated") {
      const ctrl = new AbortController();
      ttsAbort.current = ctrl;
      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 1000) }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          if (epoch.current !== myEpoch) return URL.revokeObjectURL(url);
          const el = new Audio(url);
          audio.current = el;
          await new Promise<void>((resolve) => {
            el.onended = el.onerror = el.onpause = () => resolve();
            el.play().catch(() => resolve());
          });
          URL.revokeObjectURL(url);
          return;
        }
      } catch {
        if (ctrl.signal.aborted) return;
      }
    }
    if (epoch.current === myEpoch) await browserSpeak();
  }, []);

  const finishTurn = useCallback(
    async (reply: Turn, myEpoch: number) => {
      setTurns((t) => [...t, reply]);
      if (active.current && reply.text && epoch.current === myEpoch) await speak(reply.text, myEpoch);
      setStatus((s) => (s === "thinking" || s === "speaking" ? idleStatus() : s));
    },
    [speak],
  );

  const runTurn = useCallback(
    async (text: string) => {
      const myEpoch = epoch.current;
      setStatus("thinking");
      setError(null);
      try {
        if (confirmRef.current && isConfirmWord(text)) {
          const c = confirmRef.current;
          setConfirm(null);
          const res = await fetch("/api/agent/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: "decide_request", args: { requestId: c.requestId, decision: "approve", confirmed: true } }),
          });
          const data = await res.json().catch(() => ({}));
          const msg = typeof data?.say === "string" ? data.say : typeof data?.reply === "string" ? data.reply : typeof data?.text === "string" ? data.text : res.ok ? "Confirmed." : "That did not go through.";
          return await finishTurn({ role: "agent", text: msg, aiSource: "simulated" }, myEpoch);
        }
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, inputSource: "voice" }),
        });
        if (!res.ok) throw new Error(`Agent chat failed (${res.status})`);
        const data = (await res.json()) as { reply: string; actions?: ChatAction[]; aiSource: "live" | "simulated"; confirm?: PendingConfirm };
        if (data.confirm) setConfirm(data.confirm);
        await finishTurn({ role: "agent", text: data.reply, aiSource: data.aiSource, actions: data.actions }, myEpoch);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStatus(active.current ? "listening" : "error");
      }
    },
    [finishTurn],
  );

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setTurns((prev) => [...prev, { role: "user", text: t }]);
      queue.current = queue.current.then(() => runTurn(t));
    },
    [runTurn],
  );

  const onInterim = (text: string) => {
    setInterim(text);
    if (wordCount(text) >= 2) {
      epoch.current++;
      stopPlayback();
      setStatus((s) => (s === "speaking" ? "listening" : s));
    }
  };

  const teardown = useCallback(() => {
    active.current = false;
    const sock = ws.current;
    ws.current = null;
    if (sock) {
      try {
        if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: "CloseStream" }));
        sock.close();
      } catch {}
    }
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    const rec = recognition.current;
    recognition.current = null;
    if (rec) {
      rec.onend = null;
      rec.stop();
    }
    stopPlayback();
    finals.current = "";
  }, [stopPlayback]);

  const stop = useCallback(() => {
    epoch.current++;
    teardown();
    setInterim("");
    setStatus("idle");
  }, [teardown]);

  const startBrowser = useCallback(() => {
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) {
      modeRef.current = "simulated";
      setMode("simulated");
      active.current = true;
      setStatus("idle");
      return;
    }
    modeRef.current = "browser";
    setMode("browser");
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          setInterim("");
          sendText(r[0].transcript);
        } else live += r[0].transcript;
      }
      if (live) onInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone permission was denied.");
        stop();
      }
    };
    rec.onend = () => {
      if (recognition.current === rec) {
        try {
          rec.start();
        } catch {}
      }
    };
    recognition.current = rec;
    active.current = true;
    rec.start();
    setStatus("listening");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendText, stop]);

  const startLive = useCallback(async (): Promise<boolean> => {
    const tokenRes = await fetch("/api/voice/token", { method: "POST" }).catch(() => null);
    if (!tokenRes?.ok) return false;
    const { accessToken } = (await tokenRes.json()) as { accessToken: string };
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Microphone permission was denied.");
      setStatus("error");
      return true;
    }
    stream.current = media;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
    const params = new URLSearchParams({
      model: "nova-3",
      interim_results: "true",
      smart_format: "true",
      endpointing: "300",
      utterance_end_ms: "1000",
    });
    const sock = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["bearer", accessToken]);
    ws.current = sock;
    modeRef.current = "live";
    setMode("live");
    active.current = true;
    let opened = false;

    const flush = () => {
      const text = finals.current.trim();
      finals.current = "";
      setInterim("");
      if (text) sendText(text);
    };

    sock.onopen = () => {
      opened = true;
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size && sock.readyState === WebSocket.OPEN) sock.send(ev.data);
      };
      rec.start(250);
      setStatus("listening");
    };
    sock.onmessage = (ev) => {
      let msg: { type?: string; is_final?: boolean; speech_final?: boolean; channel?: { alternatives?: { transcript?: string }[] } };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === "UtteranceEnd") return flush();
      if (msg.type !== "Results") return;
      const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
      if (!text) return;
      if (msg.is_final) {
        finals.current += `${text} `;
        onInterim(finals.current);
        if (msg.speech_final) flush();
      } else onInterim(`${finals.current}${text}`);
    };
    sock.onerror = () => {
      if (!opened && ws.current === sock) {
        teardown();
        startBrowser();
      }
    };
    sock.onclose = () => {
      if (opened && ws.current === sock) {
        setError("Live voice connection closed.");
        stop();
      }
    };
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendText, startBrowser, stop, teardown]);

  /** Must be called from a user click: this is the only place the mic is ever opened. */
  const start = useCallback(async () => {
    if (active.current) return;
    setError(null);
    setStatus("connecting");
    if (!(await startLive())) startBrowser();
  }, [startLive, startBrowser]);

  const confirm = useCallback(() => {
    if (!confirmRef.current) return;
    sendText("confirm");
  }, [sendText]);

  useEffect(() => () => teardown(), [teardown]);

  return { status, mode, turns, interim, pendingConfirm, error, start, stop, sendText, confirm, dismissConfirm: () => setConfirm(null) };
}
