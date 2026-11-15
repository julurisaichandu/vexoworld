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
      <header className="ac-card mb-6 flex flex-wrap items-center gap-5 bg-gradient-to-br from-indigo-50 via-white to-rose-50 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <AgentAvatar agent={agent} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{agent.name}</h1>
          <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-slate-600">{agent.persona}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className={`rounded-full px-2.5 py-0.5 ring-1 ring-inset ${agent.paused ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
              {agent.paused ? "Paused" : "Active"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-slate-600 ring-1 ring-slate-200 ring-inset">Works for {user.name}</span>
          </div>
        </div>
        <PauseToggle paused={agent.paused} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <VoiceConsole />
          <PipecatVoice />

          <section className="ac-card p-5">
            <h2 className="font-heading text-xl font-semibold">Chat history</h2>
            <div className="mt-4 space-y-3">
              {chat.length === 0 && <p className="text-sm text-slate-500">No messages yet. Use voice above or tell your agent what you need.</p>}
              {chat.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-900"}`}>
                    {m.text}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
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
              <h2 className="font-heading text-xl font-semibold">Personality</h2>
              {p && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${p.source === "user" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-indigo-50 text-indigo-800 ring-indigo-200"}`}>
                  {p.source === "user" ? "Written by you" : "Learned from your words"}
                </span>
              )}
            </div>
            {p ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="leading-relaxed text-slate-800">{p.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.traits.map((t) => (
                    <span key={t} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {t}
                    </span>
                  ))}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-600">
                  <dt className="font-medium text-slate-900">Tone</dt>
                  <dd>{p.tone}</dd>
                  <dt className="font-medium text-slate-900">Posting style</dt>
                  <dd>{p.postingStyle}</dd>
                </dl>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No personality yet. Add your own words below and your agent will learn it.</p>
            )}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-600">
                <span>Learning from your words</span>
                <span>
                  {corpus.tokens.toLocaleString()} / {corpus.target.toLocaleString()} tokens
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-4">
                <CorpusTools canAnalyze={corpus.tokens > 0} />
              </div>
            </div>
          </section>

          <section className="ac-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold">What your agent did</h2>
              <Link href="/activity" className="text-sm font-medium text-indigo-600 hover:underline">
                All activity
              </Link>
            </div>
            <ul className="mt-3 space-y-3">
              {activity.length === 0 && <li className="text-sm text-slate-500">Nothing yet.</li>}
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-400" />
                  <span className="min-w-0">
                    <span className="text-slate-800">{a.text}</span>
                    <span className="ml-2 text-xs text-slate-500">{timeAgo(a.createdAt)}</span>
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
