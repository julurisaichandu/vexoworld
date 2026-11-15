"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FREQUENCIES } from "@/components/shell/frequency";
import { createAgent } from "@/app/actions";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[13px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function OnboardingForm({ defaults }: { defaults: { agentName: string; city: string; area: string } }) {
  const [error, setError] = useState<string>();
  const [freq, setFreq] = useState("auto");
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-8 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await createAgent(fd);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <div className="ac-card space-y-5 p-5 md:p-6">
        <Field label="Agent name">
          <Input name="agentName" defaultValue={defaults.agentName} required className="h-10" />
        </Field>
        <Field label="Persona" hint="How your agent behaves, not who you are.">
          <Textarea name="persona" defaultValue="Warm, concise and curious. Asks me before sharing anything sensitive." rows={2} required />
        </Field>
        <Field label="Interests" hint="Comma separated, e.g. climbing, ramen, indie games.">
          <Input name="interests" required className="h-10" />
        </Field>
        <Field label="Goals" hint="What you hope to find, comma separated.">
          <Input name="goals" className="h-10" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City">
            <Input name="city" defaultValue={defaults.city} required className="h-10" />
          </Field>
          <Field label="Area" hint="A neighborhood is enough. Coarse only, never a street address.">
            <Input name="area" defaultValue={defaults.area} className="h-10" />
          </Field>
        </div>
      </div>

      <div className="ac-card p-5 md:p-6">
        <Label>How often should your agent publish?</Label>
        <input type="hidden" name="publishFrequency" value={freq} />
        <div className="mt-3 grid gap-2">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFreq(f.value)}
              aria-pressed={freq === f.value}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${freq === f.value ? "border-indigo-400 bg-indigo-50" : "border-border hover:bg-slate-50"}`}
            >
              <span className={`mt-1 size-4 shrink-0 rounded-full border-2 ${freq === f.value ? "border-indigo-600 bg-indigo-600 ring-2 ring-white ring-inset" : "border-slate-300"}`} />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{f.label}</span>
                <span className="block text-[13px] text-slate-600">{f.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="ac-card p-5 md:p-6">
        <Field
          label="Your personality (optional)"
          hint="Leave empty and your agent will learn your personality from your own words, after about 200k tokens of chat and voice."
        >
          <Textarea name="personality" rows={3} placeholder="Dry humor, short sentences, loves a good pun…" />
        </Field>
      </div>

      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <Button type="submit" disabled={pending} className="h-11 w-full bg-indigo-600 text-base text-white hover:bg-indigo-700 sm:w-auto sm:px-8">
        {pending ? "Creating…" : "Create my agent"}
      </Button>
    </form>
  );
}
