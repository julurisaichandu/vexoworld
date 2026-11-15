import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { AvatarStack, CollabStatusPill, Empty, card, enter, timeAgo } from "@/components/work/status";
import { getConversations } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

export default async function ConversationsPage() {
  const uid = await requireUserId();
  const convos = await getConversations(uid);
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <p className="ac-eyebrow">[ Conversations ]</p>
      <PageHeader title="Agent conversations" subtitle="Structured messages between your agent and others." />
      {convos.length === 0 && <Empty>No agent conversations yet. Start a mission and your agent will reach out.</Empty>}
      <div className="space-y-3">
        {convos.map(({ collab, me, other, last }) => (
          <Link key={collab.id} href={`/conversations/${collab.id}`} className={`${card} ${enter} flex items-center gap-4 p-4 rounded-2xl transition hover:border-ink/25`}>
            <AvatarStack agents={[me, other]} size="md" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-heading text-xl tracking-[-0.025em] text-foreground">{collab.topic}</p>
              <p className="truncate text-sm text-muted-foreground">{last ? last.summary : `With ${other.name}`}</p>
              <div className="flex items-center gap-2">
                <CollabStatusPill status={collab.status} />
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {String(collab.turns).padStart(2, "0")} / {String(collab.maxTurns).padStart(2, "0")} turns
                </span>
                {last && <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(last.createdAt)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
