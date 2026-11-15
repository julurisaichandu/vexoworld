import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestCard } from "@/components/work/request-card";
import { Empty } from "@/components/work/status";
import { getInbox } from "@/lib/queries";
import { requireUserId } from "@/lib/session";

export default async function InboxPage() {
  const uid = await requireUserId();
  const { open, done } = await getInbox(uid);
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader title="Inbox" subtitle="Your agent asks before it shares anything or introduces you." />
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="done">Done ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-4 pt-4">
          {open.length === 0 && <Empty>Nothing waiting for you.</Empty>}
          {open.map((r) => <RequestCard key={r.id} request={r} />)}
        </TabsContent>
        <TabsContent value="done" className="space-y-4 pt-4">
          {done.length === 0 && <Empty>No resolved requests yet.</Empty>}
          {done.map((r) => <RequestCard key={r.id} request={r} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
