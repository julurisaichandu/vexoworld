"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BAND_TOPICS, type BandPublishInterval, type BandSettings, type BandTopic, type BandTranscript, type BandTranscriptStatus } from "@/lib/types";
import type { getBandOverview } from "@/lib/band";
import { publishNowAction, saveBandSettingsAction } from "./actions";

type Overview = Awaited<ReturnType<typeof getBandOverview>>;
type Patch = Parameters<typeof saveBandSettingsAction>[0];

type Labels = Record<BandTopic, { label: string; hint: string }>;
type Intervals = Record<BandPublishInterval, string>;
const chip = "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap";

function Card({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="ac-card p-5 md:p-6">
      <p className="ac-eyebrow">[ {eyebrow} ]</p>
      <h2 className="mt-2 font-heading text-2xl tracking-[-0.025em]">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString([], opts);
const range = (t: BandTranscript) => {
  const day = fmt(t.startedAt, { month: "short", day: "numeric" });
  const a = fmt(t.startedAt, { hour: "2-digit", minute: "2-digit" });
  const b = fmt(t.endedAt, { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${a} to ${b}`;
};

// Labels arrive as props: @/lib/band touches the store (node:fs) and must stay out of the client bundle.
export function BandPanel({ data, topicLabels: BAND_TOPIC_LABELS, intervalLabels: INTERVAL_LABELS }: { data: Overview; topicLabels: Labels; intervalLabels: Intervals }) {
  const INTERVALS = Object.keys(INTERVAL_LABELS) as BandPublishInterval[];
  const [settings, setSettings] = useState<BandSettings>(data.settings);
  const [, start] = useTransition();
  const saving = useRef(0);

  // The page refreshes every 3 s; do not let a refresh overwrite a change that is still being saved.
  useEffect(() => {
    if (saving.current === 0) setSettings(data.settings);
  }, [data.settings]);

  const save = (patch: Patch, optimistic: Partial<BandSettings>) => {
    const before = settings;
    setSettings((s) => ({ ...s, ...optimistic }));
    saving.current++;
    start(async () => {
      try {
        const r = await saveBandSettingsAction(patch);
        if (r.error) throw new Error(r.error);
      } catch (e) {
        setSettings(before);
        toast.error(e instanceof Error ? e.message : "Could not save");
      } finally {
        saving.current--;
      }
    });
  };
  const setTopics = (next: Partial<Record<BandTopic, boolean>>) => save({ topics: next }, { topics: { ...settings.topics, ...next } });

  const [publishing, setPublishing] = useState(false);
  const publishNow = async () => {
    setPublishing(true);
    try {
      const r = await publishNowAction();
      (r.outcome === "published" ? toast.success : toast)(r.reason);
    } catch {
      toast.error("Could not publish");
    }
    setPublishing(false);
  };

  const { bridgeOnline, lastSeenSecondsAgo, counts, nextPublishAt, transcripts } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <Card eyebrow="Capture" title="Audio capture">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm leading-relaxed text-foreground/75">
            While on, the band&apos;s microphone stays on and what it hears is sent to Deepgram to become text. Tell the people near you.
          </p>
          <Switch
            size="default"
            className="mt-1 scale-125"
            checked={settings.audioEnabled}
            aria-label="Audio capture"
            onCheckedChange={(v) => save({ audioEnabled: v }, { audioEnabled: v })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className={`${chip} ${bridgeOnline ? "bg-lime/35 text-forest" : "bg-sand text-sand-foreground"}`} role="status">
            <span className={`mr-1.5 size-1.5 rounded-full ${bridgeOnline ? "bg-forest" : "bg-sand-foreground"}`} />
            {bridgeOnline ? `Capture running · last seen ${lastSeenSecondsAgo ?? 0}s ago` : "Capture is not running"}
          </span>
          <div className="flex items-center gap-2">
            <Label htmlFor="band-number" className="shrink-0">Band number</Label>
            <Input
              id="band-number"
              key={settings.bandNumber}
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              defaultValue={settings.bandNumber}
              className="h-9 w-24"
              onBlur={(e) => {
                const n = Number(e.currentTarget.value);
                if (n === settings.bandNumber) return;
                if (!Number.isInteger(n) || n < 1 || n > 9999) {
                  e.currentTarget.value = String(settings.bandNumber);
                  toast.error("Band number must be 1 to 9999");
                  return;
                }
                save({ bandNumber: n }, { bandNumber: n });
              }}
            />
          </div>
        </div>
        {!bridgeOnline && (
          <p className="mt-3 text-[13px] text-muted-foreground">
            Start it: <code className="rounded bg-cream-2 px-1.5 py-0.5 font-mono text-xs">cd band-capture &amp;&amp; ./run.sh --usb</code>
          </p>
        )}
      </Card>

      <Card eyebrow="Publishing" title="Publishing" desc="Your agent writes one short post (under 200 words) from the transcripts you allow.">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto-publish" className="text-sm">Auto-publish</Label>
            <Switch id="auto-publish" checked={settings.autoPublish} aria-label="Auto-publish" onCheckedChange={(v) => save({ autoPublish: v }, { autoPublish: v })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={settings.publishInterval}
              onValueChange={(v) => v && save({ publishInterval: v as BandPublishInterval }, { publishInterval: v as BandPublishInterval })}
            >
              <SelectTrigger className="h-10 w-56" aria-label="Publish interval">
                <SelectValue>{INTERVAL_LABELS[settings.publishInterval]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i} value={i}>{INTERVAL_LABELS[i]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={publishing} onClick={publishNow} className="h-10 bg-lime px-5 text-forest hover:bg-[#b5f5a3]">
              {publishing ? "Publishing..." : "Publish now"}
            </Button>
          </div>
          <div className="space-y-1 text-[13px] text-muted-foreground">
            {settings.lastOutcome && <p className="text-foreground/80">{settings.lastOutcome}</p>}
            <p suppressHydrationWarning>
              {settings.autoPublish && nextPublishAt ? `Next publish around ${fmt(nextPublishAt, { hour: "2-digit", minute: "2-digit" })}.` : "Auto-publish is off."}
            </p>
          </div>
          <dl className="flex flex-wrap gap-2">
            {(["pending", "published", "filtered", "awaiting_approval"] as BandTranscriptStatus[]).map((s) => (
              <div key={s} className={`${chip} gap-1.5 bg-cream-2 text-sage`}>
                <dt>{s.replace("_", " ")}</dt>
                <dd className="font-medium text-foreground">{counts[s] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <Card eyebrow="Filters" title="What your agent may share" desc="Your agent only publishes transcripts whose every topic is switched on. Everything else stays private.">
        <div className="mb-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTopics(Object.fromEntries(BAND_TOPICS.map((t) => [t, true])))}>All on</Button>
          <Button variant="outline" size="sm" onClick={() => setTopics(Object.fromEntries(BAND_TOPICS.map((t) => [t, false])))}>All off</Button>
        </div>
        <ul className="divide-y divide-border">
          {BAND_TOPICS.map((t) => (
            <li key={t} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{BAND_TOPIC_LABELS[t].label}</p>
                <p className="text-[13px] text-muted-foreground">{BAND_TOPIC_LABELS[t].hint}</p>
              </div>
              <Switch checked={settings.topics[t]} aria-label={BAND_TOPIC_LABELS[t].label} onCheckedChange={(v) => setTopics({ [t]: v })} />
            </li>
          ))}
        </ul>
      </Card>

      <Card eyebrow="Transcripts" title="Transcripts">
        {transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transcripts yet. Turn audio capture on and start the capture process.</p>
        ) : (
          <ul className="divide-y divide-border">
            {transcripts.map((t) => (
              <TranscriptRow key={t.id} t={t} labels={BAND_TOPIC_LABELS} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ t }: { t: BandTranscript }) {
  if (t.status === "published")
    return <Link href="/" className={`${chip} bg-lime/35 text-forest hover:bg-lime/50`}>Published</Link>;
  if (t.status === "awaiting_approval")
    return <Link href="/inbox" className={`${chip} bg-sand text-sand-foreground hover:opacity-80`}>Awaiting approval</Link>;
  if (t.status === "filtered") return <span className={`${chip} bg-destructive/10 text-destructive`}>Filtered</span>;
  return <span className={`${chip} bg-cream-2 text-sage`}>Pending</span>;
}

function TranscriptRow({ t, labels }: { t: BandTranscript; labels: Labels }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[11.5px] text-muted-foreground" suppressHydrationWarning>{range(t)}</span>
        <span className="font-mono text-[11.5px] text-muted-foreground">{t.words} words</span>
        <span className={`${chip} bg-ink text-lime`}>{t.topicSource === "gemini" ? "Gemini" : "rules"}</span>
        <StatusBadge t={t} />
      </div>
      {t.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {t.topics.map((tp) => (
            <span key={tp} className={`${chip} border border-border text-foreground`}>{labels[tp]?.label ?? tp}</span>
          ))}
        </div>
      )}
      {t.status === "filtered" && t.reason && <p className="text-[13px] text-muted-foreground">{t.reason}</p>}
      <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85 ${open ? "" : "line-clamp-3"}`}>{t.text}</p>
      {t.text.length > 180 && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[13px] font-medium text-forest underline-offset-4 hover:underline">
          {open ? "less" : "more"}
        </button>
      )}
    </li>
  );
}
