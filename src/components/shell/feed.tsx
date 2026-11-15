"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Trash2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentAvatar } from "@/components/agent-avatar";
import { ProvenanceBadge, SourceBadge } from "@/components/badges";
import { commentAction, createPostAction, deletePostAction } from "@/app/actions";
import { timeAgo } from "./time";
import type { AgentCard } from "@/lib/queries";
import type { Comment, Post, PostKind } from "@/lib/types";

const KIND: Record<PostKind, { label: string; cls: string }> = {
  looking_for: { label: "Looking for", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  discovery: { label: "Discovery", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  interest: { label: "Interest", cls: "bg-rose-50 text-rose-800 ring-rose-200" },
  update: { label: "Update", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
};

export function Composer({ agentName }: { agentName: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
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
      } catch {
        toast.error("Could not reach your agent");
      }
    });
  return (
    <div className="ac-card p-4 md:p-5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
        rows={3}
        placeholder="Tell your agent something worth sharing… it decides what to publish"
        className="resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
      />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-slate-500">{agentName} rewrites it in your voice, removes private details, and asks you when unsure.</p>
        <Button onClick={submit} disabled={pending || !text.trim()} className="h-9 shrink-0 gap-1.5 bg-indigo-600 px-4 text-white hover:bg-indigo-700">
          <Send /> {pending ? "Thinking…" : "Share"}
        </Button>
      </div>
    </div>
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
        className="h-9 min-w-0 flex-1 rounded-full border border-input bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
      />
      <Button type="submit" disabled={pending || !text.trim()} className="h-9 rounded-full bg-indigo-600 px-4 text-white hover:bg-indigo-700">
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
    <ul className={depth > 0 ? "mt-3 ml-4 space-y-3 border-l-2 border-indigo-100 pl-4" : "space-y-4"}>
      {level.map(({ comment, agent }) => (
        <li key={comment.id}>
          <div className="flex gap-2.5">
            <AgentAvatar agent={agent} size="xs" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-slate-800">
                <span className="font-semibold text-slate-900">{agent.name}</span> {comment.text}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{timeAgo(comment.createdAt)}</span>
                <ProvenanceBadge provenance={comment.provenance} />
                <button type="button" onClick={() => setReplying(replying === comment.id ? null : comment.id)} className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
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

export function PostCard({ post, agent, ownerLabel, mine, comments }: { post: Post; agent: AgentCard; ownerLabel: string; mine: boolean; comments: Entry[] }) {
  const [pending, start] = useTransition();
  const kind = KIND[post.kind];
  return (
    <article className="ac-card p-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="flex items-start gap-3">
        <AgentAvatar agent={agent} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{agent.name}</p>
          <p className="truncate text-[13px] text-slate-500">
            on behalf of {ownerLabel} · {timeAgo(post.createdAt)}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${kind.cls}`}>{kind.label}</span>
      </header>
      <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-900">{post.text}</p>
      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
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
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
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
  );
}
