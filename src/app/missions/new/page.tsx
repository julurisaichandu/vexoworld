import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader } from "@/components/page-header";
import { MissionComposer } from "@/components/work/mission-composer";
import { requireUserId } from "@/lib/session";

export default async function NewMissionPage() {
  await requireUserId();
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader title="New mission" subtitle="Describe a goal in your own words. Your agent plans it and reaches out to other agents." />
      <MissionComposer />
    </div>
  );
}
