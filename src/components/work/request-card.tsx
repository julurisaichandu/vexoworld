"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { answerRequestAction, decideRequestAction } from "@/app/actions";
import { SourceBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { VoiceAnswer } from "@/components/voice/voice-answer";
import type { HumanRequest } from "@/lib/types";
import { Pill, card, enter } from "./status";

type Answer = NonNullable<HumanRequest["answerSource"]>;
const SOURCE_LABEL: Record<Answer, string> = { voice: "Voice via Deepgram", text: "Typed", simulated_voice: "Simulated voice" };
const KIND_LABEL: Record<HumanRequest["kind"], string> = {
  question: "Question",
  observation: "Observation",
  approval_intro: "Introduction",
  approval_post: "Post",
};

export function RequestCard({ request: r }: { request: HumanRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(r.answerStructured?.summary ?? "");
  const [confirm, setConfirm] = useState(false);

  const done = r.status === "approved" || r.status === "rejected" || r.status === "expired";
  const askable = r.kind === "question" || r.kind === "observation";

  function after(res: { error?: string } | void, ok: string) {
    if (res && res.error) toast.error(res.error);
    else toast.success(ok);
    router.refresh();
  }
  const answer = (t: string, source: Answer) => {
    if (!t.trim()) return;
    start(async () => after(await answerRequestAction(r.id, t.trim(), source), "Answer saved. Review it before it is shared."));
  };
  const decide = (decision: "approve" | "reject", opts?: { confirmed?: boolean; editedSummary?: string }, ok?: string) =>
    start(async () => after(await decideRequestAction(r.id, decision, opts), ok ?? (decision === "approve" ? "Approved" : "Declined")));

  const structured = r.answerStructured;

  return (
    <div className={`${card} ${enter} space-y-4 p-5 ${r.status === "pending" || r.status === "review" ? "border-l-4 border-l-amber-400" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={r.kind === "approval_intro" ? "rose" : r.kind === "approval_post" ? "sky" : "indigo"}>{KIND_LABEL[r.kind]}</Pill>
        {r.sensitive && <Pill tone="amber">Sensitive</Pill>}
        {done && <Pill tone={r.status === "approved" ? "emerald" : "slate"}>{r.status}</Pill>}
        {r.status === "review" && <Pill tone="amber">Review before sharing</Pill>}
      </div>

      <div>
        <p className="font-heading text-lg leading-snug text-slate-900">{r.prompt}</p>
        <p className="mt-1 text-sm text-slate-500">{r.context}</p>
      </div>

      {r.kind === "approval_intro" && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">They will see your first name and contact. Nothing is shared until both of you approve.</p>
      )}
      {r.kind === "approval_post" && r.postDraft && (
        <blockquote className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-slate-800">{r.postDraft}</blockquote>
      )}

      {r.answerSource && (
        <p className="text-xs text-slate-500">
          Answered: {SOURCE_LABEL[r.answerSource]}
          {r.observedAt && ` · observed ${new Date(r.observedAt).toLocaleString()}`}
        </p>
      )}

      {askable && r.status === "pending" && (
        <div className="space-y-3">
          <VoiceAnswer onTranscript={(t, s) => answer(t, s)} />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Or type your answer..." className="rounded-xl" />
          <Button disabled={pending || !text.trim()} onClick={() => answer(text, "text")} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {pending && <Loader2 className="animate-spin" />} Send answer
          </Button>
        </div>
      )}

      {structured && (r.status === "review" || done) && (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
            What your agent will share {r.aiSource && <SourceBadge source={r.aiSource} />}
          </div>
          {editing ? (
            <Textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={3} className="rounded-xl bg-white" />
          ) : (
            <p className="text-sm text-slate-900">{structured.summary}</p>
          )}
          {Object.keys(structured.fields).length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {Object.entries(structured.fields).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {r.status === "review" && structured && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => decide("approve", editing && edited.trim() !== structured.summary ? { editedSummary: edited.trim() } : undefined, "Approved and sent")}
          >
            <Check /> Approve &amp; send
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setEditing((e) => !e)}>
            <Pencil /> {editing ? "Stop editing" : "Edit"}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => decide("reject", undefined, "Not shared")}>
            <X /> Don&apos;t share
          </Button>
        </div>
      )}

      {(r.kind === "approval_intro" || r.kind === "approval_post") && r.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => (r.kind === "approval_intro" ? setConfirm(true) : decide("approve", r.sensitive ? { confirmed: true } : undefined, "Post published"))}
          >
            <Check /> {r.kind === "approval_post" ? "Approve & publish" : "Approve"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => decide("reject", undefined, r.kind === "approval_post" ? "Post rejected" : "Declined")}>
            <X /> {r.kind === "approval_post" ? "Reject" : "Decline"}
          </Button>
        </div>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-rose-500" /> Confirm introduction
            </DialogTitle>
            <DialogDescription>
              This shares your first name and contact with the other person, and only if they approve too. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Not yet</Button>
            <Button
              disabled={pending}
              className="bg-rose-500 text-white hover:bg-rose-600"
              onClick={() => {
                setConfirm(false);
                decide("approve", { confirmed: true }, "Approved. Waiting for the other person if needed.");
              }}
            >
              Yes, introduce me
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
