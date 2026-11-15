"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pause, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCorpusAction, analyzePersonalityAction, updateAgentAction } from "@/app/actions";

export function PauseToggle({ paused }: { paused: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="h-10 gap-2 px-4"
      onClick={() => start(async () => { await updateAgentAction({ paused: !paused }); toast(paused ? "Agent resumed" : "Agent paused"); })}
    >
      {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
    </Button>
  );
}

export function CorpusTools({ canAnalyze }: { canAnalyze: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Button
        disabled={pending || !canAnalyze}
        className="h-9 gap-1.5 bg-indigo-600 px-3.5 text-white hover:bg-indigo-700"
        onClick={() =>
          start(async () => {
            const r = await analyzePersonalityAction();
            if (r.ok) toast.success("Personality updated");
            else toast(r.reason ?? "Not enough writing yet");
          })
        }
      >
        <Sparkles /> Analyze now
      </Button>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste your own writing (private, never published)" />
      <Button
        variant="outline"
        disabled={pending || !text.trim()}
        className="h-9"
        onClick={() => start(async () => { await addCorpusAction(text.trim()); setText(""); toast.success("Added privately"); })}
      >
        Add writing
      </Button>
    </div>
  );
}
