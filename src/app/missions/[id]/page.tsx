import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { ProvenanceBadge, SourceBadge } from "@/components/badges";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { CancelMissionButton } from "@/components/work/cancel-mission-button";
import { CollabStatusPill, KindChip, MissionStatusPill, card, enter } from "@/components/work/status";
import { getMission } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUserId();
  const data = await getMission(uid, id);
  if (!data) notFound();
  const { mission: m, collaborations, requests } = data;
  const open = requests.filter((r) => r.status === "pending" || r.status === "review");
  const live = !["completed", "failed", "cancelled"].includes(m.status);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader title={m.title} subtitle="Mission" />
      <section className={`${card} ${enter} space-y-3 bg-indigo-50/60 p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <KindChip kind={m.kind} />
          <MissionStatusPill status={m.status} />
          <SourceBadge source={m.aiSource} />
        </div>
        <blockquote className="font-heading text-2xl leading-snug text-slate-900">&ldquo;{m.goal}&rdquo;</blockquote>
        {(m.when || m.place) && <p className="text-sm text-slate-500">{[m.when, m.place].filter(Boolean).join(" · ")}</p>}
      </section>

      {m.outcome && (
        <section className={`${card} ${enter} space-y-2 border-emerald-200 bg-emerald-50 p-5`}>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <Check className="size-4" /> Outcome <ProvenanceBadge provenance={m.status === "completed" ? "human_verified" : "ai_generated"} />
          </div>
          <p className="text-slate-900">{m.outcome}</p>
        </section>
      )}

      {open.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-lg">Questions waiting for a human</h2>
          {open.map((r) => (
            <Link key={r.id} href="/inbox" className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900 transition hover:bg-amber-100">
              {r.prompt}
              <span className="ml-2 text-xs text-amber-700">Open in Inbox</span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Progress</h2>
        <ol className="space-y-0">
          {m.steps.map((s, i) => (
            <li key={i} className={`${enter} relative flex gap-3 pb-5 last:pb-0`} style={{ animationDelay: `${i * 80}ms` }}>
              {i < m.steps.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${s.status === "done" ? "bg-emerald-300" : "bg-slate-200"}`} />}
              <span
                className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-white ${
                  s.status === "done" ? "bg-emerald-500" : s.status === "failed" ? "bg-rose-500" : s.status === "active" ? "bg-indigo-500" : "bg-slate-200"
                }`}
              >
                {s.status === "active" && <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/60" />}
                {s.status === "done" && <Check className="size-3.5" />}
                {s.status === "failed" && <X className="size-3.5" />}
              </span>
              <span className={`pt-0.5 text-sm ${s.status === "pending" ? "text-slate-400" : "text-slate-900"} ${s.status === "active" ? "font-medium" : ""}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Participating agents</h2>
        {collaborations.length === 0 && <p className="text-sm text-slate-500">No agents contacted yet.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {collaborations.map(({ collab, other }) => (
            <Link key={collab.id} href={`/conversations/${collab.id}`} className={`${card} flex items-center gap-3 p-4 transition hover:shadow-md`}>
              <AgentAvatar agent={other} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{other.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <CollabStatusPill status={collab.status} />
                  <span className="text-xs text-slate-500">
                    {collab.turns}/{collab.maxTurns} turns
                  </span>
                </div>
              </div>
              <MessageSquare className="size-4 text-slate-400" />
            </Link>
          ))}
        </div>
      </section>

      {live && <CancelMissionButton missionId={m.id} />}
    </div>
  );
}
