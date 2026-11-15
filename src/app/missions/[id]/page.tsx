import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { AgentAvatar } from "@/components/agent-avatar";
import { ProvenanceBadge, SourceBadge } from "@/components/badges";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { CancelMissionButton } from "@/components/work/cancel-mission-button";
import { CollabStatusPill, KindChip, MissionStatusPill, enter } from "@/components/work/status";
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
      <p className="ac-eyebrow -mb-3">[ Mission ]</p>
      <PageHeader title={m.title} subtitle="Mission" />
      <section className={`ac-panel-dark ${enter} space-y-3 p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <KindChip kind={m.kind} />
          <MissionStatusPill status={m.status} />
          <SourceBadge source={m.aiSource} />
        </div>
        <blockquote className="font-heading text-3xl leading-[1.1] tracking-[-0.025em] text-cream">&ldquo;{m.goal}&rdquo;</blockquote>
        {(m.when || m.place) && <p className="font-mono text-xs text-cream/70">{[m.when, m.place].filter(Boolean).join(" · ")}</p>}
      </section>

      {m.outcome && (
        <section className={`ac-card ${enter} space-y-2 border-lime bg-lime/15 p-5`}>
          <div className="flex items-center gap-2 text-sm font-medium text-forest">
            <Check className="size-4" /> Outcome <ProvenanceBadge provenance={m.status === "completed" ? "human_verified" : "ai_generated"} />
          </div>
          <p className="text-foreground">{m.outcome}</p>
        </section>
      )}

      {open.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-2xl tracking-[-0.025em]">Questions waiting for a human</h2>
          {open.map((r) => (
            <Link key={r.id} href="/inbox" className="block rounded-2xl border border-border bg-sand p-4 text-sm text-sand-foreground transition hover:bg-sand/70">
              {r.prompt}
              <span className="ml-2 font-mono text-[11px] uppercase tracking-wider">Open in Inbox</span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-heading text-2xl tracking-[-0.025em]">Progress</h2>
        <ol className="space-y-0">
          {m.steps.map((s, i) => (
            <li key={i} className={`${enter} relative flex gap-3 pb-5 last:pb-0`} style={{ animationDelay: `${i * 80}ms` }}>
              {i < m.steps.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${s.status === "done" ? "bg-lime" : "bg-border"}`} />}
              <span
                className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${
                  s.status === "done" ? "bg-lime text-forest" : s.status === "failed" ? "bg-destructive text-cream" : s.status === "active" ? "border-2 border-ink bg-card" : "border border-border bg-card"
                }`}
              >
                {s.status === "active" && <span className="absolute inset-0 animate-ping rounded-full bg-lime/60" />}
                {s.status === "done" && <Check className="size-3.5" />}
                {s.status === "failed" && <X className="size-3.5" />}
              </span>
              <span className={`pt-0.5 text-sm ${s.status === "pending" ? "text-muted-foreground" : "text-foreground"} ${s.status === "active" ? "font-medium" : ""}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl tracking-[-0.025em]">Participating agents</h2>
        {collaborations.length === 0 && <p className="text-sm text-muted-foreground">No agents contacted yet.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {collaborations.map(({ collab, other }) => (
            <Link key={collab.id} href={`/conversations/${collab.id}`} className={`ac-card flex items-center gap-3 p-4 transition hover:shadow-md`}>
              <AgentAvatar agent={other} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-lg text-foreground">{other.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <CollabStatusPill status={collab.status} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {collab.turns}/{collab.maxTurns} turns
                  </span>
                </div>
              </div>
              <MessageSquare className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {live && <CancelMissionButton missionId={m.id} />}
    </div>
  );
}
