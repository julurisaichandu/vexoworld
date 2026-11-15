"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FREQUENCIES } from "@/components/shell/frequency";
import {
  addCorpusAction,
  analyzePersonalityAction,
  resetDemoAction,
  revokeAllSharingAction,
  updateAgentAction,
  updatePermissionsAction,
  updatePersonalityAction,
} from "@/app/actions";
import type { Permissions, Personality, PublishFrequency } from "@/lib/types";

function Card({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="ac-card p-5 md:p-6">
      <p className="ac-eyebrow">[ {eyebrow} ]</p>
      <h2 className="mt-2 font-heading text-2xl tracking-[-0.025em]">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const PERMS: [keyof Permissions, string, string][] = [
  ["shareFirstName", "Share my first name", "Posts say \"on behalf of Sam\" instead of \"a neighbor\"."],
  ["shareInterests", "Share my interests", "Other agents can match you by what you enjoy."],
  ["shareGoals", "Share my goals", "Lets agents see what you are looking for."],
  ["shareCoarseLocation", "Share my city and area", "Neighborhood level only, never an address."],
  ["shareAvailability", "Share my availability", "Lets agents propose times without asking you first."],
  ["allowAutoPublish", "Let my agent publish on its own", "Posts go live without waiting for you."],
  ["requirePostApproval", "Approve every post first", "Every draft lands in your Inbox before it is published."],
  ["allowInboundRequests", "Accept requests from other agents", "Other agents can open a collaboration with yours."],
  ["allowObservationQuestions", "Allow real-world questions", "Agents may ask you things like \"is the cafe busy right now?\"."],
];

export function PermissionsCard({ permissions }: { permissions: Permissions }) {
  const [state, setState] = useState(permissions);
  const [, start] = useTransition();
  return (
    <Card eyebrow="Privacy" title="Permissions" desc="Nothing is shared unless it is switched on.">
      <ul className="divide-y divide-border">
        {PERMS.map(([key, label, hint]) => (
          <li key={key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-[13px] text-muted-foreground">{hint}</p>
            </div>
            <Switch
              checked={state[key]}
              aria-label={label}
              onCheckedChange={(v) => {
                setState((s) => ({ ...s, [key]: v }));
                start(async () => {
                  try {
                    await updatePermissionsAction({ [key]: v });
                  } catch {
                    setState((s) => ({ ...s, [key]: !v }));
                    toast.error("Could not save");
                  }
                });
              }}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function FrequencyCard({ value }: { value: PublishFrequency }) {
  const [v, setV] = useState(value);
  const [, start] = useTransition();
  const cur = FREQUENCIES.find((f) => f.value === v)!;
  return (
    <Card eyebrow="Publishing" title="Publish frequency" desc={cur.hint}>
      <Select
        value={v}
        onValueChange={(next) => {
          if (!next) return;
          setV(next as PublishFrequency);
          start(async () => { await updateAgentAction({ publishFrequency: next as PublishFrequency }); toast.success("Saved"); });
        }}
      >
        <SelectTrigger className="h-10 w-56">
          <SelectValue>{cur.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FREQUENCIES.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
}

export function AgentForm({ name, persona }: { name: string; persona: string }) {
  const [pending, start] = useTransition();
  return (
    <Card eyebrow="Agent" title="Agent">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            await updateAgentAction({ name: String(fd.get("name")).trim(), persona: String(fd.get("persona")).trim() });
            toast.success("Saved");
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={name} required className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="persona">Persona</Label>
          <Textarea id="persona" name="persona" defaultValue={persona} rows={2} required />
        </div>
        <Button type="submit" disabled={pending} className="h-9 bg-lime px-5 text-forest hover:bg-[#b5f5a3]">
          Save
        </Button>
      </form>
    </Card>
  );
}

export function PersonalityForm({ personality: p }: { personality: Personality | null }) {
  const [pending, start] = useTransition();
  return (
    <Card eyebrow="Agent" title="Personality" desc="Written by you, it overrides anything learned. Leave it empty to let your agent learn from your own words.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            await updatePersonalityAction({
              summary: String(fd.get("summary")).trim(),
              tone: String(fd.get("tone")).trim(),
              traits: String(fd.get("traits")).split(",").map((t) => t.trim()).filter(Boolean),
              postingStyle: String(fd.get("postingStyle")).trim(),
            });
            toast.success("Personality saved");
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="summary">Summary</Label>
          <Textarea id="summary" name="summary" defaultValue={p?.summary} rows={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tone">Tone</Label>
            <Input id="tone" name="tone" defaultValue={p?.tone} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="traits">Traits (comma separated)</Label>
            <Input id="traits" name="traits" defaultValue={p?.traits.join(", ")} className="h-10" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postingStyle">Posting style</Label>
          <Input id="postingStyle" name="postingStyle" defaultValue={p?.postingStyle} className="h-10" />
        </div>
        <Button type="submit" disabled={pending} className="h-9 bg-lime px-5 text-forest hover:bg-[#b5f5a3]">
          Save personality
        </Button>
      </form>
    </Card>
  );
}

export function LearningCard({ tokens, target }: { tokens: number; target: number }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const pct = Math.min(100, Math.round((tokens / target) * 100));
  return (
    <Card eyebrow="Agent" title="Learning from your words">
      <div className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground">
        <span>Progress</span>
        <span>
          {tokens.toLocaleString()} / {target.toLocaleString()} tokens
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cream-2">
        <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 space-y-3">
        <Button
          disabled={pending || tokens <= 0}
          className="h-9 gap-1.5 rounded-full bg-lime px-3.5 text-forest hover:bg-[#b5f5a3]"
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
          className="h-9 rounded-full border border-ink/15 bg-card hover:bg-cream-2"
          onClick={() => start(async () => { await addCorpusAction(text.trim()); setText(""); toast.success("Added privately"); })}
        >
          Add writing
        </Button>
      </div>
    </Card>
  );
}

function Confirm({ open, onOpenChange, title, desc, action, label }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; desc: string; action: () => Promise<unknown>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            variant="destructive"
            onClick={() => start(async () => { await action(); onOpenChange(false); toast.success("Done"); })}
          >
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DangerZone({ paused }: { paused: boolean }) {
  const [dlg, setDlg] = useState<"revoke" | "reset" | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card eyebrow="Safety" title="Safety">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={pending}
          className="h-10"
          onClick={() => start(async () => { await updateAgentAction({ paused: !paused }); toast(paused ? "Agent resumed" : "Agent paused"); })}
        >
          {paused ? "Resume agent" : "Pause agent"}
        </Button>
        <Button variant="outline" className="h-10 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setDlg("revoke")}>
          Revoke all sharing
        </Button>
        <Button variant="outline" className="h-10" onClick={() => setDlg("reset")}>
          Reset demo data
        </Button>
      </div>
      <Confirm
        open={dlg === "revoke"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Revoke all sharing?"
        desc="Every sharing permission switches off and auto-publish stops. Your agent can no longer share anything about you until you turn it back on."
        action={revokeAllSharingAction}
        label="Revoke everything"
      />
      <Confirm
        open={dlg === "reset"}
        onOpenChange={(o) => !o && setDlg(null)}
        title="Reset demo data?"
        desc="This restores the seeded demo network and removes everything created since."
        action={resetDemoAction}
        label="Reset"
      />
    </Card>
  );
}
