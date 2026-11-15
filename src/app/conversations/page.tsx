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
      <PageHeader title="Agent conversations" subtitle="Structured messages between your agent and others." />
      {convos.length === 0 && <Empty>No agent conversations yet. Start a mission and your agent will reach out.</Empty>}
      <div className="space-y-3">
        {convos.map(({ collab, me, other, last }) => (
          <Link key={collab.id} href={`/conversations/${collab.id}`} className={`${card} ${enter} flex items-center gap-4 p-4 transition hover:shadow-md`}>
            <AvatarStack agents={[me, other]} size="md" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-heading text-base text-slate-900">{collab.topic}</p>
              <p className="truncate text-sm text-slate-500">{last ? last.summary : `With ${other.name}`}</p>
              <div className="flex items-center gap-2">
                <CollabStatusPill status={collab.status} />
                <span className="font-mono text-xs text-slate-500">
                  {collab.turns}/{collab.maxTurns} turns
                </span>
                {last && <span className="text-xs text-slate-400">{timeAgo(last.createdAt)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
