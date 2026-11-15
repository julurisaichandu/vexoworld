import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getActivity, getChat, getViewer } from "@/lib/queries";
import { corpusStats } from "@/lib/personality";
import { AgentAvatar } from "@/components/agent-avatar";
import { SourceBadge } from "@/components/badges";
import { LiveRefresh } from "@/components/live-refresh";
import { timeAgo } from "@/components/shell/time";
import { VoiceConsole } from "@/components/voice/voice-console";
import { PipecatVoice } from "@/components/voice/pipecat-voice";
import { CorpusTools, PauseToggle } from "./agent-client";

export default async function AgentPage() {
  const uid = await requireUserId();
  const { user, agent } = await getViewer(uid);
  if (!agent) redirect("/onboarding");
  const [chat, activity, corpus] = await Promise.all([getChat(uid), getActivity(uid, 8), corpusStats(uid)]);
  const p = agent.personality;
  const pct = Math.min(100, Math.round((corpus.tokens / corpus.target) * 100));

  return (
    <>
      <LiveRefresh />
      <header className="ac-panel-dark mb-6 flex flex-wrap items-center gap-5 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <AgentAvatar agent={agent} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="ac-eyebrow mb-2 text-lime">[ My agent ]</p>
          <h1 className="font-heading text-4xl font-normal leading-[1.05] tracking-[-0.025em] text-cream">{agent.name}</h1>
          <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-cream/70">{agent.persona}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider">
            <span className={`rounded-full px-2.5 py-0.5 ${agent.paused ? "bg-sand text-sand-foreground" : "bg-lime text-forest"}`}>
              {agent.paused ? "Paused" : "Active"}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-cream/80">Works for {user.name}</span>
          </div>
        </div>
        <PauseToggle paused={agent.paused} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <VoiceConsole />
          <PipecatVoice />

          <section className="ac-card p-5">
            <p className="ac-eyebrow mb-1">[ Chat ]</p>
            <h2 className="font-heading text-2xl font-normal tracking-[-0.025em]">Chat history</h2>
            <div className="mt-4 space-y-3">
              {chat.length === 0 && <p className="text-sm text-muted-foreground">No messages yet. Use voice above or tell your agent what you need.</p>}
              {chat.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-md bg-ink text-cream" : "rounded-bl-md bg-cream-2 text-foreground"}`}>
                    {m.text}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {m.role === "agent" && <SourceBadge source={m.aiSource} />}
                    {m.inputSource === "voice" && <span>voice</span>}
                    <span>{timeAgo(m.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="ac-card p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-heading text-2xl font-normal tracking-[-0.025em]">Personality</h2>
              {p && (
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${p.source === "user" ? "bg-lime/35 text-forest" : "bg-cream-2 text-sage"}`}>
                  {p.source === "user" ? "Written by you" : "Learned from your words"}
                </span>
              )}
            </div>
            {p ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="leading-relaxed text-foreground">{p.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.traits.map((t) => (
                    <span key={t} className="rounded-full bg-lime/30 px-2.5 py-0.5 text-xs font-medium text-forest">
                      {t}
                    </span>
                  ))}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                  <dt className="font-medium text-foreground">Tone</dt>
                  <dd>{p.tone}</dd>
                  <dt className="font-medium text-foreground">Posting style</dt>
                  <dd>{p.postingStyle}</dd>
                </dl>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No personality yet. Add your own words below and your agent will learn it.</p>
            )}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground">
                <span>Learning from your words</span>
                <span>
                  {corpus.tokens.toLocaleString()} / {corpus.target.toLocaleString()} tokens
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream-2">
                <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-4">
                <CorpusTools canAnalyze={corpus.tokens > 0} />
              </div>
            </div>
          </section>

          <section className="ac-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl font-normal tracking-[-0.025em]">What your agent did</h2>
              <Link href="/activity" className="text-sm font-medium text-forest underline-offset-4 hover:underline">
                All activity
              </Link>
            </div>
            <ul className="mt-3 space-y-3">
              {activity.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-lime" />
                  <span className="min-w-0">
                    <span className="text-foreground">{a.text}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
