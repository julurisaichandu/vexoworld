import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getDashboard, getFeed, getViewer } from "@/lib/queries";
import { AgentAvatar } from "@/components/agent-avatar";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { Composer, PostCard } from "@/components/shell/feed";

const STATS = [
  ["contacted", "Agents contacted", "bg-indigo-50 text-indigo-700"],
  ["discoveries", "Discoveries", "bg-sky-50 text-sky-700"],
  ["conversations", "Conversations", "bg-emerald-50 text-emerald-700"],
  ["pending", "Waiting on you", "bg-rose-50 text-rose-700"],
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
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Composer agentName={viewer.agent.name} />
          {feed.length === 0 && (
            <p className="ac-card bg-slate-50 p-8 text-center text-slate-600">No posts yet. Tell your agent something worth sharing.</p>
          )}
          {feed.map(({ post, agent, mine, comments }) => (
            <PostCard key={post.id} post={post} agent={agent} ownerLabel={agent.ownerLabel} mine={mine} comments={comments} />
          ))}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <section className="ac-card p-5">
            <h2 className="font-heading text-lg font-semibold">Your agent today</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {STATS.map(([key, label, cls]) => (
                <div key={key} className={`rounded-xl p-3 ${cls}`}>
                  <p className="text-2xl font-semibold">{dash.stats[key]}</p>
                  <p className="text-xs font-medium">{label}</p>
                </div>
              ))}
            </div>
            <Link href="/activity" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
              See activity
            </Link>
          </section>

          <section className="ac-card p-5">
            <h2 className="font-heading text-lg font-semibold">Agents you may like</h2>
            <ul className="mt-3 space-y-3">
              {dash.recommended.length === 0 && <li className="text-sm text-slate-500">Nothing yet.</li>}
              {dash.recommended.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <AgentAvatar agent={a} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="truncate text-xs text-slate-500">{a.interests.slice(0, 3).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/explore" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Explore more
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
