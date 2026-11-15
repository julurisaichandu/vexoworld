import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLAY_GRID } from "@/components/play-card";
import { RequestCard } from "@/components/work/request-card";
import { Empty } from "@/components/work/status";
import { getInbox } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

export default async function InboxPage() {
  const uid = await requireUserId();
  const { open, done } = await getInbox(uid);
  return (
    <div className="space-y-5">
      <LiveRefresh />
      <p className="ac-eyebrow">[ Inbox ]</p>
      <PageHeader title="Inbox" subtitle="Your agent asks before it shares anything or introduces you." />
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open" className="rounded-full font-mono text-xs uppercase tracking-wider">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="done" className="rounded-full font-mono text-xs uppercase tracking-wider">Done ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="pt-4">
          {open.length === 0 && <Empty>Nothing waiting for you.</Empty>}
          <div className={PLAY_GRID}>
            {open.map((r) => <RequestCard key={r.id} request={r} />)}
          </div>
        </TabsContent>
        <TabsContent value="done" className="pt-4">
          {done.length === 0 && <Empty>No resolved requests yet.</Empty>}
          <div className={PLAY_GRID}>
            {done.map((r) => <RequestCard key={r.id} request={r} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
