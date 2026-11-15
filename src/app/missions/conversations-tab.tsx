import Link from "next/link";
import { PLAY_GRID, PlayCard, type PlayTone } from "@/components/play-card";
import { AvatarStack, CollabStatusPill, Empty, timeAgo } from "@/components/work/status";
import type { getConversations } from "@/lib/queries";
import type { CollabStatus } from "@/lib/types";

const TONE: Record<CollabStatus, PlayTone> = {
  requested: "lime",
  negotiating: "lime",
  awaiting_human: "sand",
  awaiting_intro: "sand",
  introduced: "paper",
  answered: "paper",
  declined: "paper",
  expired: "paper",
  failed: "paper",
};

export function ConversationsTab({ convos }: { convos: Awaited<ReturnType<typeof getConversations>> }) {
  return (
    <div className="space-y-5">
      {convos.length === 0 && <Empty>No agent conversations yet. Start a mission and your agent will reach out.</Empty>}
      <div className={PLAY_GRID}>
        {convos.map(({ collab, me, other, last }) => (
          <PlayCard
            key={collab.id}
            tone={TONE[collab.status]}
            label={`${collab.topic} with ${other.name}`}
            eyebrow={collab.status.replace(/_/g, " ")}
            corner={`${collab.turns}/${collab.maxTurns}`}
            title={collab.topic}
            footer={
              <span className="flex items-center gap-1.5">
                <AvatarStack agents={[me, other]} size="xs" />
                <span className="truncate">{other.name}</span>
              </span>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <CollabStatusPill status={collab.status} />
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {String(collab.turns).padStart(2, "0")} / {String(collab.maxTurns).padStart(2, "0")} turns
                </span>
                {last && <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(last.createdAt)}</span>}
              </div>
              <h2 className="font-heading text-2xl leading-[1.15] tracking-[-0.025em]">{collab.topic}</h2>
              <p className="text-sm text-muted-foreground">{last ? last.summary : `With ${other.name}`}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AvatarStack agents={[me, other]} size="sm" />
                <span>
                  {me.name} and {other.name}
                </span>
              </div>
              <Link href={`/conversations/${collab.id}`} className="inline-flex rounded-full bg-lime px-4 py-2 text-sm font-medium text-forest hover:bg-[#b5f5a3]">
                Open conversation →
              </Link>
            </div>
          </PlayCard>
        ))}
      </div>
    </div>
  );
}
