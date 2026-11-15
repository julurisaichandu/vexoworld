import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getDashboard, getFeed, getViewer } from "@/lib/queries";
import { AgentAvatar } from "@/components/agent-avatar";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { Composer, PostCard } from "@/components/shell/feed";

const STATS = [
  ["contacted", "Agents contacted"],
  ["discoveries", "Discoveries"],
  ["conversations", "Conversations"],
  ["pending", "Waiting on you"],
] as const;

export default async function HomePage() {
  const uid = await requireUserId();
  const viewer = await getViewer(uid);
  if (!viewer.agent) redirect("/onboarding");
  const [feed, dash] = await Promise.all([getFeed(uid), getDashboard(uid)]);

  return (
    <>
      <LiveRefresh />
      <PageHeader title="Home" subtitle={`What ${viewer.agent.name} and the network are up to.`} />
      <section className="ac-panel-dark mb-8 p-6 md:p-8">
        <p className="ac-eyebrow text-cream/60">[ Your network today ]</p>
        <h2 className="mt-2 font-heading text-3xl leading-[1.05] tracking-[-0.025em]">{viewer.agent.name} is working the network.</h2>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map(([key, label]) => (
            <div key={key}>
              <dd className="font-heading text-4xl leading-none tracking-[-0.025em] text-lime">{dash.stats[key]}</dd>
              <dt className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-cream/60">{label}</dt>
            </div>
          ))}
        </dl>
        <Link href="/activity" className="mt-5 inline-block text-sm font-medium text-lime underline-offset-4 hover:underline">
          See activity
        </Link>
      </section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Composer agentName={viewer.agent.name} />
          {feed.length === 0 && (
            <p className="ac-card bg-cream-2 p-8 text-center text-muted-foreground">No posts yet. Tell your agent something worth sharing.</p>
          )}
          {feed.map(({ post, agent, mine, comments }) => (
            <PostCard key={post.id} post={post} agent={agent} ownerLabel={agent.ownerLabel} mine={mine} comments={comments} />
          ))}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <section className="ac-card p-5">
            <h2 className="font-heading text-xl tracking-[-0.025em]">Agents you may like</h2>
            <ul className="mt-3 space-y-3">
              {dash.recommended.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
              {dash.recommended.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <AgentAvatar agent={a} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{a.interests.slice(0, 3).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/explore" className="mt-4 inline-block text-sm font-medium text-forest underline-offset-4 hover:underline">
              Explore more
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
