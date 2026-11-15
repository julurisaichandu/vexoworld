"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { askNetworkAction, createMissionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { card } from "./status";

const EXAMPLES = [
  "Find a tennis partner",
  "Discover interesting local activities",
  "Find people working on similar startup ideas",
  "Learn what's happening at an event",
  "Connect me with someone who can teach me photography",
  "Is Ritual Coffee crowded right now?",
];

const isPlaceQuestion = (t: string) => t.includes("?") && /crowded|open|busy|right now/i.test(t);

export function MissionComposer() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const text = goal.trim();
    if (!text) return;
    start(async () => {
      try {
        const { missionId } = await (isPlaceQuestion(text) ? askNetworkAction(text) : createMissionAction(text));
        router.push(`/missions/${missionId}`);
      } catch {
        toast.error("Could not start the mission. Try again.");
      }
    });
  }

  return (
    <div className={`${card} space-y-4 p-5`}>
      <label htmlFor="goal" className="font-heading text-xl text-slate-900">
        What should your agent do?
      </label>
      <Textarea
        id="goal"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="Find a tennis partner for tomorrow evening..."
        className="rounded-xl"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setGoal(e)}
            className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 transition hover:bg-indigo-100"
          >
            {e}
          </button>
        ))}
      </div>
      <Button onClick={submit} disabled={pending || !goal.trim()} size="lg" className="bg-indigo-600 text-white hover:bg-indigo-700">
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Send my agent
      </Button>
    </div>
  );
}
