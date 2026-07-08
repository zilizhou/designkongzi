import { authFetch } from "./auth";
import type {
  AuthUser,
  Book,
  Chapter,
  ChatHandlers,
  ChatRequest,
  CaseDetail,
  CaseListResp,
  CaseStats,
  ApplyResult,
  Concept,
  Contribution,
  ContributionListResp,
  CorpusStats,
  DeveloperMe,
  InstitutionAdminItem,
  PluginItem,
  ReachStats,
  CrossCivView,
  Favorite,
  FeedItem,
  GamifyProfile,
  GraphData,
  Passage,
  PassageBrief,
  TopicBrief,
  TopicCard,
} from "./types";

import { getApiBase } from "./apiBase";
const apiBase = () => getApiBase();

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── 经典内容 ──────────────────────────────────────────────────
export const getBooks = () => getJSON<Book[]>("/api/v1/books");
export const getChapters = (bookId: string) =>
  getJSON<Chapter[]>(`/api/v1/books/${bookId}/chapters`);
export const getPassages = (chapterId: string) =>
  getJSON<PassageBrief[]>(`/api/v1/chapters/${chapterId}/passages`);
export const getPassage = (refId: string, lang = "zh") =>
  getJSON<Passage>(`/api/v1/passages/${refId}?lang=${lang}`);
export const getConcept = (id: string, lang = "zh") =>
  getJSON<Concept>(`/api/v1/concepts/${id}?lang=${lang}`);
export const getFeed = (lang = "en", limit = 20) =>
  getJSON<FeedItem[]>(`/api/v1/feed?lang=${lang}&limit=${limit}`);

// ── 语料统计 ───────────────────────────────────────────────────
export const getCorpusStats = () => getJSON<CorpusStats>("/api/v1/corpus/stats");

// ── 开发者公开 API（无需登录）─────────────────────────────────
export async function applyForApi(body: {
  name: string;
  country: string;
  contact_email: string;
  purpose: string;
}) {
  const r = await fetch(`${apiBase()}/api/v1/developers/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<ApplyResult>;
}

export async function getDeveloperMe(apiKey: string) {
  const r = await fetch(`${apiBase()}/api/v1/developers/me`, {
    headers: { "X-API-Key": apiKey },
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<DeveloperMe>;
}

export const listInstitutions = (status?: string) =>
  authJSON<InstitutionAdminItem[]>(
    `/api/v1/admin/institutions${status ? `?status=${status}` : ""}`,
  );
export const updateInstitution = (id: number, body: { status?: string; monthly_quota?: number }) =>
  authJSON<{ id: number; status: string; monthly_quota: number }>(
    `/api/v1/admin/institutions/${id}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
export const issueKey = (id: number, label = "default") =>
  authJSON<{ id: number; key: string; label: string; institution_id: number }>(
    `/api/v1/admin/institutions/${id}/keys?label=${encodeURIComponent(label)}`,
    { method: "POST" },
  );
export const revokeKey = (keyId: number) =>
  authJSON<{ ok: boolean }>(`/api/v1/admin/keys/${keyId}`, { method: "DELETE" });

// ── 共创广场 ───────────────────────────────────────────────────
export const listContribs = (params: { topic_id?: string; status?: string; sort?: string; page?: number; page_size?: number }) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
  return getJSON<ContributionListResp>(`/api/v1/contributions?${qs.toString()}`);
};
export const submitContrib = (body: {
  kind?: string;
  topic_id?: string;
  civilization?: string;
  headline: string;
  detail?: string;
  sources?: { label: string; citation: string }[];
  lang?: string;
}) => authJSON<Contribution>("/api/v1/contributions", { method: "POST", body: JSON.stringify(body) });
export const voteContrib = (id: number, value: 1 | -1) =>
  authJSON<Contribution>(`/api/v1/contributions/${id}/vote?value=${value}`, { method: "POST" });
export const reviewContrib = (id: number, status: string) =>
  authJSON<Contribution>(`/api/v1/contributions/admin/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
export const myContribs = () => authJSON<Contribution[]>("/api/v1/contributions/mine");

// ── 插件清单 ───────────────────────────────────────────────────
export const listPlugins = () => getJSON<{ total: number; items: PluginItem[] }>("/api/v1/embed/plugins");

// ── 传播看板 ───────────────────────────────────────────────────
export const getReachStats = () => getJSON<ReachStats>("/api/v1/reach/stats");

// ── 礼之器游戏 ─────────────────────────────────────────────────
export const getLiToday = () =>
  authJSON<import("./types").LiTodayResp>("/api/v1/li/today");
export const getLiProgress = () =>
  authJSON<import("./types").LiProgressResp>("/api/v1/li/progress");
export const chooseLiOption = (sid: number, optionKey: string) =>
  authJSON<import("./types").LiChooseResp>(`/api/v1/li/scenario/${sid}/choose`, {
    method: "POST",
    body: JSON.stringify({ option_key: optionKey }),
  });
export const getLiHostToday = () =>
  authJSON<import("./types").LiHostTodayResp>("/api/v1/li/host/today");
export const submitLiHostResult = (key: string, scores: import("./types").LiHostScores) =>
  authJSON<import("./types").LiHostResultResp>(`/api/v1/li/host/${key}/result`, {
    method: "POST",
    body: JSON.stringify(scores),
  });
export const getLiHostLeaderboard = (limit = 10) =>
  authJSON<import("./types").LiHostLeaderboardResp>(`/api/v1/li/host/leaderboard?limit=${limit}`);

// ── 书艺游戏 ───────────────────────────────────────────────────
export const getShuToday = () =>
  authJSON<import("./types").ShuTodayResp>("/api/v1/shu/today");
export const answerShuCard = (cardId: number, optionKey: string) =>
  authJSON<import("./types").ShuAnswerResp>(`/api/v1/shu/card/${cardId}/answer`, {
    method: "POST",
    body: JSON.stringify({ option_key: optionKey }),
  });
export const assembleShuCard = (cardId: number, parts: string[]) =>
  authJSON<import("./types").ShuAssembleResp>(`/api/v1/shu/card/${cardId}/assemble`, {
    method: "POST",
    body: JSON.stringify({ parts }),
  });
export const traceShuCard = (
  cardId: number,
  strokes: number,
  durationMs: number,
  score: number = 0,
  precision: number = 0,
  recall: number = 0,
) =>
  authJSON<import("./types").ShuTraceResp>(`/api/v1/shu/card/${cardId}/trace`, {
    method: "POST",
    body: JSON.stringify({
      strokes,
      duration_ms: durationMs,
      score,
      precision,
      recall,
    }),
  });
export const getShuProgress = () =>
  authJSON<import("./types").ShuProgressResp>("/api/v1/shu/progress");
export const getShuLeaderboard = (limit = 20) =>
  getJSON<import("./types").ShuLeaderboardResp>(`/api/v1/shu/leaderboard?limit=${limit}`);

// ── 君子之路 · 总览 + 勋章 + 排行 ──────────────────────────────
export const getJourneyOverview = () =>
  authJSON<import("./types").JourneyOverviewResp>("/api/v1/journey/overview");
export const getJourneyLeaderboard = (limit = 20) =>
  authJSON<import("./types").JourneyLeaderboardResp>(`/api/v1/journey/leaderboard?limit=${limit}`);

// ── 御艺·五御 ──────────────────────────────────────────────────
export const getYuToday = () =>
  authJSON<import("./types").YuTodayResp>("/api/v1/yu/today");
export const driveYuScenario = (
  sid: number,
  trajectory: import("./types").YuTrajectoryPoint[],
  events: import("./types").YuEvent[],
) =>
  authJSON<import("./types").YuDriveResp>(`/api/v1/yu/scenario/${sid}/drive`, {
    method: "POST",
    body: JSON.stringify({ trajectory, events }),
  });
export const getYuProgress = () =>
  authJSON<import("./types").YuProgressResp>("/api/v1/yu/progress");

// ── 数艺·均输衰分 ──────────────────────────────────────────────
export const getMathToday = () =>
  authJSON<import("./types").MathTodayResp>("/api/v1/math/today");
export const solveMathScenario = (
  sid: number,
  allocations: Record<string, number>,
) =>
  authJSON<import("./types").MathSolveResp>(`/api/v1/math/scenario/${sid}/solve`, {
    method: "POST",
    body: JSON.stringify({ allocations }),
  });
export const getMathProgress = () =>
  authJSON<import("./types").MathProgressResp>("/api/v1/math/progress");

// ── 乐艺·五音合鸣 ──────────────────────────────────────────────
export const getYueToday = () =>
  authJSON<import("./types").YueTodayResp>("/api/v1/yue/today");
export const playYueScenario = (sid: number, sequence: import("./types").YueNote[]) =>
  authJSON<import("./types").YuePlayResp>(`/api/v1/yue/scenario/${sid}/play`, {
    method: "POST",
    body: JSON.stringify({ sequence }),
  });
export const getYueProgress = () =>
  authJSON<import("./types").YueProgressResp>("/api/v1/yue/progress");

// ── 射艺游戏 ───────────────────────────────────────────────────
export const startSheRound = () =>
  authJSON<import("./types").SheRoundResp>("/api/v1/she/round", { method: "POST" });
export const submitSheResult = (body: import("./types").SheResultIn) =>
  authJSON<import("./types").SheResultResp>("/api/v1/she/result", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const getSheProgress = () =>
  authJSON<import("./types").SheProgressResp>("/api/v1/she/progress");
export const getSheLeaderboard = (metric = "reflection", limit = 20) =>
  getJSON<import("./types").SheLeaderboardResp>(
    `/api/v1/she/leaderboard?metric=${metric}&limit=${limit}`,
  );

// ── 议题 / 跨文明 ───────────────────────────────────────────────
export const getTopics = (lang = "zh") =>
  getJSON<TopicBrief[]>(`/api/v1/topics?lang=${lang}`);
export const getTopic = (id: string, lang = "zh") =>
  getJSON<TopicCard & { cross_civ_views: CrossCivView[] }>(
    `/api/v1/topics/${id}?lang=${lang}`,
  );

// ── 跨文明对话案例库 ────────────────────────────────────────────
export const getCases = (params: {
  topic_id?: string;
  lang?: string;
  status?: string;
  q?: string;
  review?: string;
  page?: number;
  page_size?: number;
}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
  return getJSON<CaseListResp>(`/api/v1/cases?${qs.toString()}`);
};
export const getCase = (id: number) => getJSON<CaseDetail>(`/api/v1/cases/${id}`);
export const getCaseStats = () => getJSON<CaseStats>("/api/v1/cases/stats");

export const reviewCase = (
  id: number,
  body: { status?: string; quality?: number; review_note?: string },
) =>
  authJSON<CaseDetail>(`/api/v1/admin/cases/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
// promoteSelfAdmin 已移除：admin 通过后端 ADMIN_EMAILS 白名单授予

// ── 知识图谱 ───────────────────────────────────────────────────
export const getNeighborhood = (nodeId: string, depth = 2) =>
  getJSON<GraphData>(
    `/api/v1/graph/concept/${encodeURIComponent(nodeId)}/neighborhood?depth=${depth}`,
  );
export const getPath = (from: string, to: string) =>
  getJSON<GraphData>(
    `/api/v1/graph/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

// ── 游戏化 / 收藏 / 账户（需鉴权，authFetch 自动领游客 token）──────
async function authJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export const getGamifyProfile = () =>
  authJSON<GamifyProfile>("/api/v1/gamify/profile");
export const checkin = () =>
  authJSON<GamifyProfile>("/api/v1/gamify/checkin", { method: "POST" });
export const completeTask = (id: string) =>
  authJSON<GamifyProfile>(`/api/v1/gamify/task/${id}/complete`, { method: "POST" });

export const getFavorites = () => authJSON<Favorite[]>("/api/v1/gamify/favorites");
export const addFavorite = (target_type: string, target_ref: string, label = "") =>
  authJSON<{ ok: boolean; profile: GamifyProfile }>("/api/v1/gamify/favorites", {
    method: "POST",
    body: JSON.stringify({ target_type, target_ref, label }),
  });
export const removeFavorite = (id: number) =>
  authJSON<{ ok: boolean }>(`/api/v1/gamify/favorites/${id}`, { method: "DELETE" });

export const getMe = () => authJSON<AuthUser>("/api/v1/auth/me");
export const exportMe = () => authJSON<Record<string, unknown>>("/api/v1/auth/me/export");
export const upgradeAccount = (email: string, password: string, display_name?: string) =>
  authJSON<{ token: string; user: AuthUser }>("/api/v1/auth/upgrade", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name }),
  });

/** 邮箱登录（不需要鉴权 header）。 */
export async function loginByEmail(email: string, password: string) {
  const r = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<{ token: string; user: AuthUser }>;
}

// ── 对话（SSE 流式）────────────────────────────────────────────
// chat 走 POST，EventSource 不支持，这里用 fetch + ReadableStream 手动解析 SSE。
export async function streamChat(
  req: ChatRequest,
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (frame: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }
    switch (event) {
      case "agents":
        handlers.onAgents?.(data as never);
        break;
      case "topic":
        handlers.onTopic?.(data as never);
        break;
      case "citation":
        handlers.onCitation?.(data as never);
        break;
      case "token":
        handlers.onToken?.((data as { text: string }).text);
        break;
      case "verify":
        handlers.onVerify?.(data as never);
        break;
      case "cross_civ":
        handlers.onCrossCiv?.(data as never);
        break;
      case "followups":
        handlers.onFollowups?.(data as string[]);
        break;
      case "done":
        handlers.onDone?.(data as never);
        break;
      case "error":
        handlers.onError?.((data as { message: string }).message);
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 帧以空行分隔
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.trim()) dispatch(frame);
    }
  }
}
