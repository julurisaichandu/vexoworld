import { ownerLabel } from "@/lib/privacy";
import { store } from "@/lib/store";
import type { Activity, Agent, AgentMessage, ChatMessage, Collaboration, Comment, Connection, HumanRequest, Mission, Post, User } from "@/lib/types";

export type AgentCard = {
  id: string;
  userId: string;
  name: string;
  color: string;
  avatarSeed: string;
  ownerLabel: string;
  area?: string;
  interests: string[];
  paused: boolean;
};

// Read models only ever copy permission-filtered fields of other users. Never add contact, availability, answerRaw or corpus here.
async function cards() {
  const [users, agents] = await Promise.all([store.list("users"), store.list("agents")]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const byAgent = new Map<string, AgentCard>();
  const byUser = new Map<string, AgentCard>();
  for (const a of agents) {
    const u = userById.get(a.userId);
    if (!u) continue;
    const card: AgentCard = {
      id: a.id,
      userId: a.userId,
      name: a.name,
      color: a.color,
      avatarSeed: a.avatarSeed,
      ownerLabel: ownerLabel(u, a),
      area: a.permissions.shareCoarseLocation ? u.area : undefined,
      interests: a.permissions.shareInterests ? u.interests : [],
      paused: a.paused,
    };
    byAgent.set(a.id, card);
    byUser.set(a.userId, card);
  }
  return { users: userById, byAgent, byUser };
}

const unknownCard = (id: string): AgentCard => ({ id, userId: "", name: "Unknown agent", color: "#E5E7EB", avatarSeed: id, ownerLabel: "a neighbor", interests: [], paused: false });
const card = (c: Awaited<ReturnType<typeof cards>>, agentId: string) => c.byAgent.get(agentId) ?? unknownCard(agentId);

const myAgent = async (userId: string): Promise<Agent | null> => (await store.list("agents", { userId }))[0] ?? null;
const open = (r: HumanRequest) => r.status === "pending" || r.status === "review";

export async function getViewer(userId: string): Promise<{ user: User; agent: Agent | null; unread: number; pending: number }> {
  const user = await store.get("users", userId);
  if (!user) throw new Error("unknown user");
  const [agent, activity, requests] = await Promise.all([myAgent(userId), store.list("activity", { userId }), store.list("humanRequests", { userId })]);
  return { user, agent, unread: activity.filter((a) => a.notify && !a.read).length, pending: requests.filter(open).length };
}

export async function getDemoUsers() {
  const c = await cards();
  return [...c.users.values()]
    .filter((u) => u.isDemo)
    .map((u) => ({ id: u.id, name: u.name, handle: u.handle, agentName: c.byUser.get(u.id)?.name ?? "", color: c.byUser.get(u.id)?.color ?? "#E5E7EB" }));
}

export async function getFeed(userId: string): Promise<{ post: Post; agent: AgentCard; mine: boolean; comments: { comment: Comment; agent: AgentCard }[] }[]> {
  const [c, posts, comments] = await Promise.all([cards(), store.list("posts"), store.list("comments", undefined, { order: "asc" })]);
  return posts
    .filter((p) => !p.deletedAt)
    .map((post) => ({
      post,
      agent: card(c, post.agentId),
      mine: post.userId === userId,
      comments: comments.filter((m) => m.postId === post.id).map((comment) => ({ comment, agent: card(c, comment.agentId) })),
    }));
}

export async function getExplore(userId: string, q?: string) {
  const [c, posts, viewer] = await Promise.all([cards(), store.list("posts"), store.get("users", userId)]);
  const mine = new Set((viewer?.interests ?? []).map((i) => i.toLowerCase()));
  const live = posts.filter((p) => !p.deletedAt && p.userId !== userId);
  const needle = q?.trim().toLowerCase();
  const agents = [...c.byAgent.values()]
    .filter((a) => a.userId !== userId)
    .map((a) => {
      const shared = a.interests.filter((i) => mine.has(i.toLowerCase()));
      const hay = [a.name, a.area ?? "", ...a.interests, ...live.filter((p) => p.agentId === a.id).map((p) => `${p.text} ${p.tags.join(" ")}`)].join(" ").toLowerCase();
      const hit = needle ? hay.includes(needle) : true;
      return { a, hit, matchReason: needle && hit ? `Matches "${q}"` : shared.length ? `You both like ${shared.join(", ")}` : undefined };
    })
    .filter((x) => x.hit)
    .map((x) => ({ ...x.a, matchReason: x.matchReason }));
  const counts = new Map<string, number>();
  for (const a of c.byAgent.values()) for (const i of a.interests) counts.set(i.toLowerCase(), (counts.get(i.toLowerCase()) ?? 0) + 1);
  return {
    agents,
    interests: [...counts].map(([tag, count]) => ({ tag, count })).sort((x, y) => y.count - x.count),
    opportunities: live.filter((p) => p.kind === "looking_for" || p.kind === "discovery").map((post) => ({ post, agent: card(c, post.agentId) })),
  };
}

export const getChat = (userId: string): Promise<ChatMessage[]> => store.list("chat", { userId }, { order: "asc" });
export const getMissions = (userId: string): Promise<Mission[]> => store.list("missions", { userId });

export async function getMission(userId: string, id: string) {
  const mission = await store.get("missions", id);
  if (!mission || mission.userId !== userId) return null;
  const [c, collabs, requests] = await Promise.all([cards(), store.list("collaborations", { missionId: id }, { order: "asc" }), store.list("humanRequests", { userId })]);
  return {
    mission,
    collaborations: collabs.map((collab) => ({ collab, other: card(c, collab.responderAgentId) })),
    requests: requests.filter((r) => r.missionId === id),
  };
}

async function myCollabs(userId: string): Promise<{ agent: Agent; collabs: Collaboration[] } | null> {
  const agent = await myAgent(userId);
  if (!agent) return null;
  const all = await store.list("collaborations");
  return { agent, collabs: all.filter((c) => c.initiatorAgentId === agent.id || c.responderAgentId === agent.id) };
}

export async function getConversations(userId: string) {
  const mine = await myCollabs(userId);
  if (!mine) return [];
  const [c, messages, missions] = await Promise.all([cards(), store.list("messages", undefined, { order: "asc" }), store.list("missions", { userId })]);
  return mine.collabs.map((collab) => {
    const iAmInitiator = collab.initiatorAgentId === mine.agent.id;
    const last = messages.filter((m) => m.collaborationId === collab.id).at(-1);
    return {
      collab,
      me: card(c, mine.agent.id),
      other: card(c, iAmInitiator ? collab.responderAgentId : collab.initiatorAgentId),
      mission: iAmInitiator ? missions.find((m) => m.id === collab.missionId) : undefined,
      last,
    };
  });
}

export async function getConversation(userId: string, id: string): Promise<{ collab: Collaboration; mission?: Mission; initiator: AgentCard; responder: AgentCard; messages: AgentMessage[] } | null> {
  const mine = await myCollabs(userId);
  const collab = mine?.collabs.find((x) => x.id === id);
  if (!mine || !collab) return null;
  const [c, messages, mission] = await Promise.all([cards(), store.list("messages", { collaborationId: id }, { order: "asc" }), store.get("missions", collab.missionId)]);
  return {
    collab,
    mission: mission?.userId === userId ? mission : undefined,
    initiator: card(c, collab.initiatorAgentId),
    responder: card(c, collab.responderAgentId),
    messages,
  };
}

export async function getInbox(userId: string): Promise<{ open: HumanRequest[]; done: HumanRequest[] }> {
  const all = await store.list("humanRequests", { userId });
  return { open: all.filter(open), done: all.filter((r) => !open(r)) };
}

export async function getConnections(userId: string): Promise<{ connection: Connection; other: AgentCard; otherName?: string; contact?: string }[]> {
  const [c, all] = await Promise.all([cards(), store.list("connections")]);
  return all
    .filter((x) => x.userAId === userId || x.userBId === userId)
    .map((connection) => {
      const otherId = connection.userAId === userId ? connection.userBId : connection.userAId;
      const mutual = connection.status === "mutual";
      return {
        connection: { ...connection, sharedContact: mutual ? connection.sharedContact : undefined },
        other: c.byUser.get(otherId) ?? unknownCard(otherId),
        otherName: mutual ? c.users.get(otherId)?.name : undefined,
        contact: mutual ? connection.sharedContact?.[otherId] : undefined,
      };
    });
}

export const getActivity = (userId: string, limit = 50): Promise<Activity[]> => store.list("activity", { userId }, { limit });
export async function getNotifications(userId: string): Promise<Activity[]> {
  return (await store.list("activity", { userId }, { limit: 100 })).filter((a) => a.notify);
}

export async function getDashboard(userId: string) {
  const [explore, mine, missions, requests, posts, recent] = await Promise.all([
    getExplore(userId),
    myCollabs(userId),
    store.list("missions", { userId }),
    store.list("humanRequests", { userId }),
    store.list("posts"),
    getActivity(userId, 8),
  ]);
  const recommended = explore.agents.filter((a) => a.matchReason).slice(0, 4);
  return {
    stats: {
      contacted: mine?.collabs.filter((c) => c.initiatorAgentId === mine.agent.id).length ?? 0,
      discoveries: posts.filter((p) => !p.deletedAt && p.kind === "discovery" && p.userId !== userId).length,
      conversations: mine?.collabs.length ?? 0,
      pending: requests.filter(open).length,
      recommended: recommended.length,
      completed: missions.filter((m) => m.status === "completed").length,
    },
    recommended,
    recent,
  };
}
