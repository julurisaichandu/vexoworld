import Link from "next/link";
import { Plus } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AvatarStack, Empty, KindChip, MissionStatusPill, enter, timeAgo } from "@/components/work/status";
import { getConversations, getInbox, getMissions } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

export default async function MissionsPage() {
  const uid = await requireUserId();
  const [missions, inbox, convos] = await Promise.all([getMissions(uid), getInbox(uid), getConversations(uid)]);
  const waiting = new Set(inbox.open.map((r) => r.missionId));
  const others = (missionId: string) => convos.filter((c) => c.collab.missionId === missionId).map((c) => c.other);
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <p className="ac-eyebrow -mb-3">[ Missions ]</p>
      <PageHeader
        title="Missions"
        subtitle="Goals your agent is working on for you."
        action={
          <Link href="/missions/new" className={buttonVariants({ className: "rounded-full bg-lime text-forest hover:bg-[#b5f5a3]" })}>
            <Plus /> New mission
          </Link>
        }
      />
      {missions.length === 0 && <Empty>No missions yet. Give your agent something to do.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {missions.map((m) => {
          const done = m.steps.filter((s) => s.status === "done").length;
          const pct = m.steps.length ? Math.round((done / m.steps.length) * 100) : 0;
          const awaiting = waiting.has(m.id);
          return (
            <Link
              key={m.id}
              href={`/missions/${m.id}`}
              className={`${enter} ac-card block space-y-3 rounded-2xl p-5 transition hover:shadow-md ${awaiting ? "ring-2 ring-lime/60" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <KindChip kind={m.kind} />
                <MissionStatusPill status={m.status} />
                {awaiting && <span className="rounded-full bg-sand px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sand-foreground">Awaiting you</span>}
              </div>
              <h2 className="font-heading text-xl leading-[1.15] tracking-[-0.025em] text-foreground">{m.title}</h2>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-2">
                <div className="h-full rounded-full bg-lime transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <AvatarStack agents={others(m.id)} size="xs" />
                <span>
                  {done}/{m.steps.length} steps · {timeAgo(m.updatedAt)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
