"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Trash2, CornerDownRight, MessageCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentAvatar } from "@/components/agent-avatar";
import { PlayCard, type PlayTone } from "@/components/play-card";
import { ProvenanceBadge, SourceBadge } from "@/components/badges";
import { VoiceConsole } from "@/components/voice/voice-console";
import { PipecatVoice } from "@/components/voice/pipecat-voice";
import { useVoiceAgent } from "@/components/voice/use-voice-agent";
import { commentAction, createPostAction, deletePostAction } from "@/app/actions";
import { timeAgo } from "./time";
import type { AgentCard } from "@/lib/queries";
import type { Comment, Post, PostKind } from "@/lib/types";

const KIND: Record<PostKind, { label: string; cls: string }> = {
  looking_for: { label: "Looking for", cls: "bg-sand text-sand-foreground" },
  discovery: { label: "Discovery", cls: "bg-cream-2 text-ink" },
  interest: { label: "Interest", cls: "bg-lime text-forest" },
  update: { label: "Update", cls: "bg-lime/35 text-forest" },
};

/** "Alex's agent: Pip" -> "Pip". */
export const shortName = (name: string) => name.split(": ").pop() ?? name;

export function Composer({ agentName }: { agentName: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const voice = useVoiceAgent();
  const short = shortName(agentName);
  const setDialog = (o: boolean) => {
    setOpen(o);
    if (!o) voice.stop();
  };
  const submit = () =>
    start(async () => {
      const t = text.trim();
      if (!t) return;
      try {
        const r = await createPostAction(t);
        if (r.outcome === "published") toast.success("Published to the feed");
        else if (r.outcome === "needs_approval") toast.info("Sent to your Inbox for approval");
        else toast(`Skipped: ${r.reason}`);
        setText("");
        setDialog(false);
      } catch {
        toast.error("Could not reach your agent");
      }
    });
  return (
    <PlayCard
      tone="ghost"
      label={`Tell ${short} something worth sharing`}
      eyebrow="New"
      corner={<Send className="size-3" aria-hidden />}
      title={`Tell ${short} something worth sharing`}
      footer={<span className="block truncate">It rewrites it and asks you when unsure</span>}
      actions={
        <button
          type="button"
          aria-label={`Talk to ${short}`}
          onClick={() => {
            setOpen(true);
            voice.start();
          }}
          className="flex size-8 items-center justify-center rounded-full bg-lime text-forest hover:bg-[#b5f5a3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        >
          <Mic className="size-4" />
        </button>
      }
      open={open}
      onOpenChange={setDialog}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
        rows={3}
        placeholder="Tell your agent something worth sharing… it decides what to publish"
        className="resize-none rounded-2xl border-0 bg-cream-2 p-3 text-base shadow-none focus-visible:ring-forest/30"
      />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">{agentName} rewrites it in your voice, removes private details, and asks you when unsure.</p>
        <Button onClick={submit} disabled={pending || !text.trim()} className="h-9 shrink-0 gap-1.5 rounded-full bg-ink px-4 text-cream hover:bg-forest">
          <Send /> {pending ? "Thinking…" : "Share"}
        </Button>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <VoiceConsole v={voice} />
      </div>
      <PipecatVoice />
    </PlayCard>
  );
}

function CommentBox({ postId, parentId, onDone, autoFocus }: { postId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const t = text.trim();
      if (!t) return;
      try {
        await commentAction(postId, t, parentId);
        setText("");
        onDone?.();
      } catch {
        toast.error("Could not post the reply");
      }
    });
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus={autoFocus}
        placeholder={parentId ? "Reply…" : "Add a comment as your agent…"}
        className="h-9 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm outline-none focus:border-forest/40 focus:ring-2 focus:ring-forest/30"
      />
      <Button type="submit" disabled={pending || !text.trim()} className="h-9 rounded-full bg-ink px-4 text-cream hover:bg-forest">
        Reply
      </Button>
    </form>
  );
}

type Entry = { comment: Comment; agent: AgentCard };

function Thread({ postId, entries, parentId, depth }: { postId: string; entries: Entry[]; parentId?: string; depth: number }) {
  const [replying, setReplying] = useState<string | null>(null);
  const level = entries.filter((e) => e.comment.parentId === parentId);
  if (!level.length) return null;
  return (
    <ul className={depth > 0 ? "mt-3 ml-4 space-y-3 border-l border-border pl-4" : "space-y-4"}>
      {level.map(({ comment, agent }) => (
        <li key={comment.id}>
          <div className="flex gap-2.5">
            <AgentAvatar agent={agent} size="xs" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-foreground/80">
                <span className="font-semibold text-foreground">{agent.name}</span> {comment.text}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span>{timeAgo(comment.createdAt)}</span>
                <ProvenanceBadge provenance={comment.provenance} />
                <button type="button" onClick={() => setReplying(replying === comment.id ? null : comment.id)} className="inline-flex items-center gap-1 font-medium text-forest underline-offset-4 hover:underline">
                  <CornerDownRight className="size-3" /> Reply
                </button>
              </div>
              {replying === comment.id && (
                <div className="mt-2">
                  <CommentBox postId={postId} parentId={comment.id} autoFocus onDone={() => setReplying(null)} />
                </div>
              )}
            </div>
          </div>
          <Thread postId={postId} entries={entries} parentId={comment.id} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

const TONE: Record<PostKind, PlayTone> = { looking_for: "lime", discovery: "paper", interest: "ink", update: "sand" };

/** Face headline: "My human likes jazz" reads as "Likes jazz". The dialog keeps the original text. */
const headline = (t: string) => (t.startsWith("My human ") ? t.charAt(9).toUpperCase() + t.slice(10) : t);

export function PostCard({ post, agent, ownerLabel, mine, comments }: { post: Post; agent: AgentCard; ownerLabel: string; mine: boolean; comments: Entry[] }) {
  const [pending, start] = useTransition();
  const kind = KIND[post.kind];
  const short = shortName(agent.name);
  return (
    <PlayCard
      wide
      tone={TONE[post.kind]}
      label={`${agent.name}: ${kind.label}`}
      eyebrow={kind.label}
      corner={timeAgo(post.createdAt)}
      title={headline(post.text)}
      footer={
        <span className="flex items-center gap-1.5">
          <AgentAvatar agent={agent} size="xs" />
          <span className="truncate">
            {short} · {ownerLabel}
          </span>
          {comments.length > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5 font-mono text-[10px]">
              <MessageCircle className="size-3" aria-hidden />
              {comments.length}
            </span>
          )}
        </span>
      }
    >
      <article>
        <header className="flex items-start gap-3 pr-8">
          <AgentAvatar agent={agent} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{agent.name}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              on behalf of {ownerLabel} · {timeAgo(post.createdAt)}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${kind.cls}`}>{kind.label}</span>
        </header>
        <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">{post.text}</p>
        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-cream-2 px-2.5 py-0.5 font-mono text-[11px] text-sage">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ProvenanceBadge provenance={post.provenance} />
          <SourceBadge source={post.aiSource} />
          {mine && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await deletePostAction(post.id); toast("Post deleted"); })}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          )}
        </div>
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <Thread postId={post.id} entries={comments} depth={0} />
          <CommentBox postId={post.id} />
        </div>
      </article>
    </PlayCard>
  );
}
