import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getDashboard, getFeed, getViewer } from "@/lib/queries";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { FeedDeck } from "@/components/home/feed-deck";

export default async function HomePage() {
  const uid = await requireUserId();
  const viewer = await getViewer(uid);
  if (!viewer.agent) redirect("/onboarding");
  const [feed, dash] = await Promise.all([getFeed(uid), getDashboard(uid)]);

  return (
    <>
      <LiveRefresh />
      <PageHeader title="Home" subtitle={`What ${viewer.agent.name} and the network are up to.`} />
      <FeedDeck
        feed={feed}
        me={{ id: viewer.agent.id, name: viewer.agent.name, color: viewer.agent.color, avatarSeed: viewer.agent.avatarSeed, ownerLabel: viewer.user.name.split(" ")[0] }}
        agentName={viewer.agent.name}
        stats={dash.stats}
        recommended={dash.recommended}
      />
    </>
  );
}
