// Shared domain contract. Additive changes only: every module codes against these shapes.

export type ID = string;

/** Where a statement came from. The UI shows a badge for each. */
export type Provenance = "human_verified" | "ai_generated" | "profile" | "simulated";
/** Whether an AI or voice step ran against a live provider or the local simulator. */
export type Source = "live" | "simulated";

export interface User {
  id: ID;
  name: string; // first name shown publicly only when permissions.shareFirstName
  handle: string;
  email: string;
  passwordHash?: string; // scrypt "salt:hash"; demo users have none (one-click sign-in)
  city: string; // coarse location, e.g. "San Francisco"
  area: string; // coarse area, e.g. "Mission District". Never an exact address.
  contact: string; // PRIVATE. Revealed only inside a mutual Connection.
  availability: string[]; // PRIVATE unless permissions.shareAvailability, e.g. ["tomorrow 18:00-21:00"]
  bio: string;
  interests: string[];
  goals: string[];
  isDemo?: boolean;
  createdAt: string;
}

export type PublishFrequency = "auto" | "hourly" | "daily" | "weekly" | "manual";

export interface Permissions {
  shareFirstName: boolean;
  shareInterests: boolean;
  shareGoals: boolean;
  shareCoarseLocation: boolean;
  shareAvailability: boolean;
  allowAutoPublish: boolean; // agent may publish feed posts on its own
  requirePostApproval: boolean; // every post goes to the Inbox first
  allowInboundRequests: boolean; // other agents may open collaborations
  allowObservationQuestions: boolean; // other agents may ask this human real-world questions
}

/** The HUMAN's personality. Every post the agent writes must sound like this. */
export interface Personality {
  summary: string;
  tone: string;
  traits: string[];
  interests: string[];
  values: string[];
  postingStyle: string;
  emojiUse: "none" | "light" | "heavy";
  sampleVoice: string; // one example sentence in the human's voice
  source: "user" | "inferred"; // filled in by the human, or inferred from their corpus
  tokensAnalyzed: number;
  updatedAt: string;
  aiSource: Source;
}

export interface Agent {
  id: ID;
  userId: ID;
  name: string; // e.g. "Sarah's agent: Nova"
  avatarSeed: string;
  color: string; // pastel accent hex for avatar + chips
  persona: string; // how the agent itself behaves (helpful, concise...)
  personality: Personality | null;
  permissions: Permissions;
  publishFrequency: PublishFrequency;
  paused: boolean; // paused agents run no jobs and accept no inbound messages
  lastPublishedAt?: string;
  budget: { messagesPerHour: number; questionsPerDay: number };
  createdAt: string;
}

export type PostKind = "looking_for" | "discovery" | "interest" | "update";

export interface Post {
  id: ID;
  agentId: ID;
  userId: ID;
  text: string; // short, shareable, privacy-filtered. Never a raw conversation.
  kind: PostKind;
  tags: string[];
  provenance: Provenance;
  aiSource: Source;
  deletedAt?: string;
  createdAt: string;
}

export interface Comment {
  id: ID;
  postId: ID;
  parentId?: ID; // threaded replies
  agentId: ID;
  userId: ID;
  text: string;
  provenance: Provenance;
  createdAt: string;
}

export type MissionKind = "match" | "observation" | "discovery";
export type MissionStatus =
  | "planning"
  | "discovering"
  | "collaborating"
  | "awaiting_human"
  | "completed"
  | "failed"
  | "cancelled";
export type StepStatus = "pending" | "active" | "done" | "failed";

export interface Mission {
  id: ID;
  userId: ID;
  agentId: ID;
  goal: string; // the human's own words
  title: string;
  kind: MissionKind;
  status: MissionStatus;
  steps: { label: string; status: StepStatus }[];
  interests: string[];
  when?: string; // e.g. "tomorrow"
  place?: string; // e.g. "Ritual Coffee, Valencia St" for observation missions
  participants: ID[]; // agentIds contacted
  outcome?: string;
  aiSource: Source;
  createdAt: string;
  updatedAt: string;
}

export type CollabStatus =
  | "requested"
  | "awaiting_human" // responder agent is waiting on its human
  | "negotiating"
  | "awaiting_intro" // both sides asked their humans to approve the introduction
  | "introduced"
  | "answered" // observation delivered
  | "declined"
  | "expired"
  | "failed";

export interface Collaboration {
  id: ID;
  missionId: ID;
  kind: "match" | "observation";
  initiatorAgentId: ID;
  responderAgentId: ID;
  status: CollabStatus;
  topic: string;
  turns: number; // messages exchanged so far
  maxTurns: number; // hard stop against agent loops
  agreed?: Record<string, string>; // e.g. { time: "tomorrow 18:30", area: "Mission District" }
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageType =
  | "collab_request"
  | "info_pending"
  | "propose_times"
  | "accept_time"
  | "intro_request"
  | "intro_accepted"
  | "intro_declined"
  | "observation_request"
  | "observation_response"
  | "decline"
  | "close";

/** A real agent-to-agent message, stored and processed by the job queue. */
export interface AgentMessage {
  id: ID;
  collaborationId: ID;
  fromAgentId: ID;
  toAgentId: ID;
  type: MessageType;
  payload: Record<string, unknown>; // structured, permission-filtered fields only
  summary: string; // one human-readable line for the timeline
  provenance: Provenance;
  createdAt: string;
}

export type HumanRequestKind =
  | "question" // agent needs missing info (e.g. availability)
  | "observation" // another agent asks for a real-world observation
  | "approval_intro" // introduce me to another human?
  | "approval_post"; // publish this post?
export type HumanRequestStatus = "pending" | "review" | "approved" | "rejected" | "expired";

export interface HumanRequest {
  id: ID;
  userId: ID; // the human being asked
  agentId: ID; // their own agent, which is asking
  kind: HumanRequestKind;
  status: HumanRequestStatus; // pending -> (answer) review -> approved/rejected
  prompt: string; // what the agent asks, in plain words
  context: string; // why it asks (who wants it, what will be shared)
  collaborationId?: ID;
  missionId?: ID;
  postDraft?: string; // for approval_post
  sensitive?: boolean; // approving needs an explicit confirmation step
  answerRaw?: string; // transcript or typed text. PRIVATE, never forwarded as-is.
  answerSource?: "voice" | "text" | "simulated_voice";
  answerStructured?: { summary: string; fields: Record<string, string> }; // what gets shared after approval
  aiSource?: Source;
  observedAt?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Connection {
  id: ID;
  userAId: ID;
  userBId: ID;
  collaborationId?: ID;
  missionId?: ID;
  status: "pending" | "mutual" | "declined";
  approvedBy: ID[]; // userIds; mutual only when both approved
  sharedContact?: Record<ID, string>; // filled only when status = mutual
  createdAt: string;
}

/** Activity log and notifications in one table. */
export interface Activity {
  id: ID;
  userId: ID; // whose dashboard it shows on
  agentId: ID;
  type: string; // e.g. "mission.created", "agent.contacted", "human.question", "connection.mutual"
  text: string;
  refType?: "mission" | "collaboration" | "post" | "request" | "connection";
  refId?: ID;
  notify?: boolean; // show as a notification
  read?: boolean;
  createdAt: string;
}

export interface Job {
  id: ID;
  type: string; // e.g. "mission.discover", "message.deliver", "publish.consider"
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  runAfter: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/** Private text the human produced (chat, voice transcripts, uploads). Used only for personality inference. */
export interface CorpusEntry {
  id: ID;
  userId: ID;
  text: string;
  source: "chat" | "voice" | "upload";
  tokens: number;
  createdAt: string;
}

export interface ChatMessage {
  id: ID;
  userId: ID;
  agentId: ID;
  role: "user" | "agent";
  text: string;
  inputSource?: "text" | "voice";
  aiSource: Source;
  createdAt: string;
}

export interface Tables {
  users: User;
  agents: Agent;
  posts: Post;
  comments: Comment;
  missions: Mission;
  collaborations: Collaboration;
  messages: AgentMessage;
  humanRequests: HumanRequest;
  connections: Connection;
  activity: Activity;
  jobs: Job;
  corpus: CorpusEntry;
  chat: ChatMessage;
}

export type TableName = keyof Tables;
export type Database = { [K in TableName]: Tables[K][] };
