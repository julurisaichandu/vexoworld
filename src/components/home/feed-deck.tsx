"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { PLAY_GRID } from "@/components/play-card";
import { Composer, PostCard, shortName } from "@/components/shell/feed";
import { AgentGraph, buildGraph, type FeedItem, type GraphAgent } from "./agent-graph";

const STATS = [
  ["contacted", "Agents contacted"],
  ["discoveries", "Discoveries"],
  ["conversations", "Conversations"],
  ["pending", "Waiting on you"],
] as const;

const emptyTile = "flex aspect-square min-w-0 items-center justify-center rounded-3xl border-2 border-dashed border-ink/15 p-3.5 text-center font-heading text-[17px] leading-[1.18] text-muted-foreground";

export function FeedDeck({
  feed,
  me,
  agentName,
  stats,
  recommended,
}: {
  feed: FeedItem[];
  me: GraphAgent;
  agentName: string;
  stats: Record<(typeof STATS)[number][0], number>;
  recommended: Pick<GraphAgent, "id" | "name" | "color" | "avatarSeed">[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => buildGraph(feed, me), [feed, me]);
  const picked = nodes.find((n) => n.id === selected);
  const shown = selected ? feed.filter((f) => f.agent.id === selected) : feed;
  return (
    <div className="space-y-4">
      <section className="ac-panel-dark rounded-3xl p-4 md:p-5">
        <p className="ac-eyebrow text-cream/60">[ Your network ]</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <AgentGraph nodes={nodes} edges={edges} selected={selected} onSelect={setSelected} />
          </div>
          <div className="shrink-0 sm:w-52">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {STATS.map(([key, label]) => (
                <div key={key}>
                  <dd className="font-heading text-2xl leading-none tracking-[-0.025em] text-lime">{stats[key]}</dd>
                  <dt className="mt-1 font-mono text-[9.5px] uppercase leading-tight tracking-wider text-cream/60">{label}</dt>
                </div>
              ))}
            </dl>
            <Link href="/activity" className="mt-3 inline-block text-sm font-medium text-lime underline-offset-4 hover:underline">
              See activity
            </Link>
            {recommended.length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-cream/60">You may like</p>
                <div className="mt-1.5 flex gap-1.5">
                  {recommended.slice(0, 4).map((a) => (
                    <Link key={a.id} href="/explore" title={a.name} aria-label={a.name}>
                      <AgentAvatar agent={a} size="xs" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{picked ? `Showing ${shortName(picked.name)}` : "Showing all agents"}</span>
        {picked && (
          <button type="button" onClick={() => setSelected(null)} className="rounded-full bg-cream-2 px-2.5 py-0.5 text-ink hover:bg-border">
            Clear
          </button>
        )}
      </div>

      <div className={PLAY_GRID}>
        <Composer agentName={agentName} />
        {shown.map(({ post, agent, mine, comments }) => (
          <PostCard key={post.id} post={post} agent={agent} ownerLabel={agent.ownerLabel} mine={mine} comments={comments} />
        ))}
        {shown.length === 0 && <p className={emptyTile}>{picked ? "No posts from this agent yet." : "No posts yet."}</p>}
      </div>
    </div>
  );
}
