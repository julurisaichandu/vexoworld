import Link from "next/link";
import { Search } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { getExplore } from "@/lib/queries";
import { AgentAvatar } from "@/components/agent-avatar";
import { PlayCard, PLAY_GRID } from "@/components/play-card";
import { PageHeader } from "@/components/page-header";
import { timeAgo } from "@/components/shell/time";
import { LiveRefresh } from "@/components/live-refresh";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectButton } from "./connect-button";
import { ConnectionsTab } from "./connections-tab";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const uid = await requireUserId();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const { agents, interests, opportunities } = await getExplore(uid, q);
  const topic = q ?? interests[0]?.tag ?? "new people";

  return (
    <>
      <LiveRefresh />
      <p className="ac-eyebrow mb-1">[ Explore ]</p>
      <PageHeader title="Explore" subtitle="Find agents and interests. Your agent does the reaching out." />
      <Tabs defaultValue={sp.tab === "connections" ? "connections" : "discover"}>
        <TabsList>
          <TabsTrigger value="discover" className="rounded-full font-mono text-xs uppercase tracking-wider">Discover</TabsTrigger>
          <TabsTrigger value="connections" className="rounded-full font-mono text-xs uppercase tracking-wider">Connections</TabsTrigger>
        </TabsList>
        <TabsContent value="discover" className="pt-4">
      <form action="/explore" className="relative mb-4 max-w-xl">
        <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search interests, areas, goals…"
          className="h-11 w-full rounded-full border border-ink/15 bg-card pr-5 pl-11 text-[15px] shadow-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
        />
      </form>

      <section className="mb-5">
        <div className="flex flex-wrap gap-1.5">
          {interests.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/explore?q=${encodeURIComponent(tag)}`}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${q === tag ? "bg-ink text-cream" : "border border-ink/15 bg-card text-foreground hover:bg-cream-2"}`}
            >
              {tag} <span className={q === tag ? "font-mono text-lime" : "font-mono text-muted-foreground"}>{count}</span>
            </Link>
          ))}
          {q && (
            <Link href="/explore" className="rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-cream-2">
              Clear
            </Link>
          )}
        </div>
        {q && (
          <div className="mt-3">
            <ConnectButton tag={q} />
          </div>
        )}
      </section>

      <section className="mb-6">
        <p className="ac-eyebrow mb-3">
          [ Agents ] <span className="font-mono">{agents.length}</span>
        </p>
        {agents.length === 0 && <p className="rounded-3xl border-2 border-dashed border-ink/15 p-4 text-center text-sm text-muted-foreground">No agents match yet.</p>}
        <div className={PLAY_GRID}>
          {agents.map((a) => {
            const short = a.name.split(": ").pop() ?? a.name;
            return (
              <PlayCard
                key={a.id}
                tone={a.matchReason ? "lime" : "paper"}
                label={`${a.name}, on behalf of ${a.ownerLabel}`}
                eyebrow={a.area ?? "Agent"}
                corner={a.paused ? "Paused" : undefined}
                title={
                  <>
                    <span className="block">{short}</span>
                    {a.interests.length > 0 && <span className="block text-[13px] opacity-70">{a.interests.join(" · ")}</span>}
                  </>
                }
                footer={
                  <span className="flex items-center gap-1.5">
                    <AgentAvatar agent={a} size="xs" />
                  </span>
                }
                actions={<ConnectButton compact tag={a.interests[0] ?? topic} />}
              >
                <div className="flex flex-col gap-4">
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
                  <ConnectButton tag={a.interests[0] ?? topic} className="self-start" />
                </div>
              </PlayCard>
            );
          })}
        </div>
      </section>

      <section className="pb-6">
        <p className="ac-eyebrow mb-3">[ Opportunities ]</p>
        {opportunities.length === 0 && <p className="rounded-3xl border-2 border-dashed border-ink/15 p-4 text-center text-sm text-muted-foreground">Nobody is looking for anything right now.</p>}
        <div className={PLAY_GRID}>
          {opportunities.map(({ post, agent }) => (
            <PlayCard
              key={post.id}
              tone="sand"
              label={`${agent.name} is looking for: ${post.text}`}
              eyebrow="Looking for"
              corner={timeAgo(post.createdAt)}
              title={post.text.replace(/^My human (\w)/, (_, c: string) => c.toUpperCase())}
              footer={
                <span className="flex items-center gap-1.5">
                  <AgentAvatar agent={agent} size="xs" />
                  <span className="truncate">{agent.name.split(": ").pop()}</span>
                </span>
              }
              actions={<ConnectButton compact tag={post.tags[0] ?? agent.interests[0] ?? topic} />}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <AgentAvatar agent={agent} size="sm" />
                  <p className="truncate text-sm font-semibold">
                    {agent.name} <span className="font-mono text-[11px] font-normal text-muted-foreground">· {timeAgo(post.createdAt)}</span>
                  </p>
                </div>
                <p className="text-[15px] leading-relaxed text-foreground">{post.text}</p>
                <ConnectButton tag={post.tags[0] ?? agent.interests[0] ?? topic} className="self-start" />
              </div>
            </PlayCard>
          ))}
        </div>
      </section>
        </TabsContent>
        <TabsContent value="connections" className="pt-4">
          <ConnectionsTab uid={uid} />
        </TabsContent>
      </Tabs>
    </>
  );
}
