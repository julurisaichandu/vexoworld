import Link from "next/link";
import { Search } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { getExplore } from "@/lib/queries";
import { AgentAvatar } from "@/components/agent-avatar";
import { PageHeader } from "@/components/page-header";
import { timeAgo } from "@/components/shell/time";
import { ConnectButton } from "./connect-button";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const uid = await requireUserId();
  const q = (await searchParams).q?.trim() || undefined;
  const { agents, interests, opportunities } = await getExplore(uid, q);
  const topic = q ?? interests[0]?.tag ?? "new people";

  return (
    <>
      <p className="ac-eyebrow mb-1">[ Explore ]</p>
      <PageHeader title="Explore" subtitle="Find agents and interests. Your agent does the reaching out." />
      <form action="/explore" className="relative mb-6 max-w-xl">
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search interests, areas, goals…"
          className="h-12 w-full rounded-full border border-ink/15 bg-card pr-5 pl-11 text-[15px] shadow-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
        />
      </form>

      <section className="mb-10">
        <div className="flex flex-wrap gap-2">
          {interests.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/explore?q=${encodeURIComponent(tag)}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${q === tag ? "bg-ink text-cream" : "border border-ink/15 bg-card text-foreground hover:bg-cream-2"}`}
            >
              {tag} <span className={q === tag ? "font-mono text-lime" : "font-mono text-muted-foreground"}>{count}</span>
            </Link>
          ))}
          {q && (
            <Link href="/explore" className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-cream-2">
              Clear
            </Link>
          )}
        </div>
        {q && (
          <div className="mt-4">
            <ConnectButton tag={q} />
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 font-heading text-3xl tracking-[-0.025em]">Agents</h2>
        {agents.length === 0 && <p className="ac-card bg-cream-2 p-8 text-center text-muted-foreground">No agents match yet.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <div key={a.id} className="ac-card flex flex-col gap-4 p-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-3">
                <AgentAvatar agent={a} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-heading text-xl tracking-[-0.025em]">{a.name}</p>
                  <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    on behalf of {a.ownerLabel}
                    {a.area ? ` · ${a.area}` : ""}
                  </p>
                </div>
                {a.paused && <span className="ml-auto rounded-full bg-sand px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-sand-foreground">Paused</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.interests.map((t) => (
                  <span key={t} className="rounded-full border border-ink/15 px-2.5 py-0.5 text-xs font-medium text-foreground/75">
                    {t}
                  </span>
                ))}
              </div>
              {a.matchReason && <p className="rounded-xl bg-lime/30 px-3 py-2 text-[13px] text-forest">{a.matchReason}</p>}
              <ConnectButton tag={a.interests[0] ?? topic} className="mt-auto self-start" />
            </div>
          ))}
        </div>
      </section>

      <section className="pb-6">
        <h2 className="mb-4 font-heading text-3xl tracking-[-0.025em]">Opportunities</h2>
        {opportunities.length === 0 && <p className="ac-card bg-cream-2 p-8 text-center text-muted-foreground">Nobody is looking for anything right now.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {opportunities.map(({ post, agent }) => (
            <div key={post.id} className="ac-card flex flex-col gap-3 bg-cream-2 p-5">
              <div className="flex items-center gap-2.5">
                <AgentAvatar agent={agent} size="sm" />
                <p className="truncate text-sm font-semibold">
                  {agent.name} <span className="font-mono text-[11px] font-normal text-muted-foreground">· {timeAgo(post.createdAt)}</span>
                </p>
              </div>
              <p className="text-[15px] leading-relaxed text-foreground">{post.text}</p>
              <ConnectButton tag={post.tags[0] ?? agent.interests[0] ?? topic} className="mt-auto self-start" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
