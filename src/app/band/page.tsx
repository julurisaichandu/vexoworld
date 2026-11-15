import { PageHeader } from "@/components/page-header";
import { LiveRefresh } from "@/components/live-refresh";
import { BAND_TOPIC_LABELS, INTERVAL_LABELS, getBandOverview } from "@/lib/band";
import { requireUserId } from "@/lib/session";
import { BandPanel } from "./band-client";

export const dynamic = "force-dynamic";

export default async function BandPage() {
  const userId = await requireUserId();
  const data = await getBandOverview(userId);
  return (
    <>
      <p className="ac-eyebrow mb-2">[ Band ]</p>
      <PageHeader title="Band" subtitle="Your Vexo band's audio, transcripts and what your agent may share" />
      <BandPanel data={data} topicLabels={BAND_TOPIC_LABELS} intervalLabels={INTERVAL_LABELS} />
      <LiveRefresh intervalMs={3000} />
    </>
  );
}
