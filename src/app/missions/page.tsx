import Link from "next/link";
import { Plus } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { PLAY_GRID, PlayCard, type PlayTone } from "@/components/play-card";
import { AvatarStack, Empty, KindChip, MissionStatusPill, timeAgo } from "@/components/work/status";
import { getConversations, getInbox, getMissions } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

const KIND = { match: "Match", observation: "Observation", discovery: "Discovery" } as const;
const STEP_MARK = { done: "✓", active: "…", failed: "✕", pending: "·" } as const;

export default async function MissionsPage() {
  const uid = await requireUserId();
  const [missions, inbox, convos] = await Promise.all([getMissions(uid), getInbox(uid), getConversations(uid)]);
  const waiting = new Set(inbox.open.map((r) => r.missionId));
  const others = (missionId: string) => convos.filter((c) => c.collab.missionId === missionId).map((c) => c.other);
  return (
    <div className="space-y-5">
      <LiveRefresh />
      <PageHeader title="Missions" subtitle="Goals your agent is working on for you." />
      <div className={PLAY_GRID}>
        <Link
          href="/missions/new"
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 text-muted-foreground transition hover:border-forest/40 hover:text-forest"
        >
          <Plus className="size-6" aria-hidden />
          <span className="font-heading text-lg">New mission</span>
        </Link>
        {missions.map((m) => {
          const done = m.steps.filter((s) => s.status === "done").length;
          const pct = m.steps.length ? Math.round((done / m.steps.length) * 100) : 0;
          const awaiting = waiting.has(m.id);
          const tone: PlayTone = awaiting || m.status === "awaiting_human" ? "lime" : m.status === "completed" || m.status === "failed" || m.status === "cancelled" ? "paper" : "ink";
          const agents = others(m.id);
          return (
            <PlayCard
              key={m.id}
              tone={tone}
              label={m.title}
              eyebrow={awaiting ? "Awaiting you" : KIND[m.kind]}
              corner={`${done}/${m.steps.length}`}
              title={m.title}
              wide
              footer={
                <span className="flex flex-col gap-1.5">
                  <span className="h-1 overflow-hidden rounded-full bg-current/15">
                    <span className="block h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="flex items-center justify-between gap-1.5">
                    <AvatarStack agents={agents} size="xs" />
                    <span className="font-mono text-[10px] opacity-70">{timeAgo(m.updatedAt)}</span>
                  </span>
                </span>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <KindChip kind={m.kind} />
                  <MissionStatusPill status={m.status} />
                  {awaiting && <span className="rounded-full bg-sand px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sand-foreground">Awaiting you</span>}
                </div>
                <h2 className="font-heading text-2xl leading-[1.15] tracking-[-0.025em]">{m.title}</h2>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream-2">
                  <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {done}/{m.steps.length} steps · {timeAgo(m.updatedAt)}
                </p>
                {m.steps.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {m.steps.map((s, i) => (
                      <li key={i} className={`flex gap-2 ${s.status === "pending" ? "text-muted-foreground" : ""}`}>
                        <span className="w-4 shrink-0 font-mono">{STEP_MARK[s.status]}</span>
                        <span>{s.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {agents.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AvatarStack agents={agents} size="sm" />
                    <span>{agents.map((a) => a.name).join(", ")}</span>
                  </div>
                )}
                <Link href={`/missions/${m.id}`} className="inline-flex rounded-full bg-lime px-4 py-2 text-sm font-medium text-forest hover:bg-[#b5f5a3]">
                  Open mission →
                </Link>
              </div>
            </PlayCard>
          );
        })}
      </div>
      {missions.length === 0 && <Empty>No missions yet. Give your agent something to do.</Empty>}
    </div>
  );
}
