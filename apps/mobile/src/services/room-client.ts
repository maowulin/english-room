import type { RtcGrantCredentials } from "@/services/rtc-client";

export type GuestSession = { playerId: string; nickname: string };
export type RoomMember = { playerId: string; ready: boolean };
export type Room = {
  id: string;
  code: string;
  title: string;
  status: "waiting" | "live" | "ended" | "recording_failed";
  version?: number;
  members: RoomMember[];
};
export type ReportItem = {
  playerName: string;
  scoreJobId: string;
  status: "completed" | "processing" | "waiting" | "failed";
  score?: number;
  pronunciation?: number;
  fluency?: number;
  recognizedText?: string;
};
export type RoomReport = { roomId: string; items: ReportItem[] };

export const roomApiPaths = {
  guestSessions: "/v1/guest-sessions",
  rooms: "/v1/rooms",
  roomByCode: "/v1/rooms/by-code/{code}",
  joinRoom: "/v1/rooms/{id}/members",
  room: "/v1/rooms/{id}",
  ready: "/v1/rooms/{id}/members/me/ready",
  start: "/v1/rooms/{id}/start",
  end: "/v1/rooms/{id}/end",
  report: "/v1/rooms/{id}/report",
  retry: "/v1/score-jobs/{id}/retry",
  rtcGrants: "/v1/rooms/{id}/rtc-grants",
} as const;

export interface RoomClient {
  /** Returns the bearer token for authorized API/WebSocket calls; never log or render this value. */
  getAccessToken?(): string | undefined;
  createGuestSession(input: { nickname: string }): Promise<GuestSession>;
  createRoom(input: { title: string }): Promise<Room>;
  getRoomByCode(code: string): Promise<Room>;
  joinRoom(roomId: string, input: { playerId: string }): Promise<Room>;
  getRoom(roomId: string): Promise<Room>;
  setReady(roomId: string, ready: boolean): Promise<Room>;
  startRoom(roomId: string): Promise<Room>;
  endRoom(roomId: string): Promise<Room>;
  getRoomReport(roomId: string): Promise<RoomReport>;
  retryScoreJob(scoreJobId: string): Promise<ReportItem>;
  issueRtcGrant(roomId: string): Promise<RtcGrantCredentials>;
}

export class FakeRoomClient implements RoomClient {
  // Demo/Fake: Phase 1 control-plane substitute; not a production room service.
  private rooms = new Map<string, Room>();
  private reports = new Map<string, RoomReport>();
  private sequence = 1;

  async createGuestSession(input: { nickname: string }): Promise<GuestSession> {
    return { playerId: `guest-${this.sequence++}`, nickname: input.nickname };
  }

  async createRoom(input: { title: string }): Promise<Room> {
    const id = `room-${this.sequence++}`;
    const room: Room = {
      id,
      code: `MINT${String(this.sequence).padStart(2, "0")}`,
      title: input.title,
      status: "waiting",
      members: [],
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoomByCode(code: string): Promise<Room> {
    const room = [...this.rooms.values()].find((candidate) => candidate.code === code);
    if (!room) throw new Error("未找到该房间");
    return room;
  }

  async joinRoom(roomId: string, input: { playerId: string }): Promise<Room> {
    const room = await this.getRoom(roomId);
    if (!room.members.some((member) => member.playerId === input.playerId)) {
      room.members.push({ playerId: input.playerId, ready: false });
    }
    return room;
  }

  async getRoom(roomId: string): Promise<Room> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("房间不存在");
    return room;
  }

  async setReady(roomId: string, ready: boolean): Promise<Room> {
    const room = await this.getRoom(roomId);
    if (room.members[0]) room.members[0].ready = ready;
    return room;
  }

  async startRoom(roomId: string): Promise<Room> {
    const room = await this.getRoom(roomId);
    room.status = "live";
    return room;
  }

  async endRoom(roomId: string): Promise<Room> {
    const room = await this.getRoom(roomId);
    room.status = "ended";
    this.reports.set(roomId, {
      roomId,
      items: [
        { playerName: "Mint", scoreJobId: `score-${roomId}-1`, status: "completed", score: 88 },
        { playerName: "Ava", scoreJobId: `score-${roomId}-2`, status: "processing" },
        { playerName: "Noah", scoreJobId: `score-${roomId}-3`, status: "waiting" },
        { playerName: "Luna", scoreJobId: `score-${roomId}-4`, status: "failed" },
      ],
    });
    return room;
  }

  async getRoomReport(roomId: string): Promise<RoomReport> {
    return this.reports.get(roomId) ?? { roomId, items: [] };
  }

  async retryScoreJob(scoreJobId: string): Promise<ReportItem> {
    for (const report of this.reports.values()) {
      const item = report.items.find((candidate) => candidate.scoreJobId === scoreJobId);
      if (item) {
        item.status = "processing";
        return item;
      }
    }
    throw new Error("评分任务不存在");
  }

  async issueRtcGrant(roomId: string): Promise<RtcGrantCredentials> {
    const room = await this.getRoom(roomId);
    return {
      roomId: room.id,
      strRoomId: room.id,
      playerId: room.members[0]?.playerId ?? "demo-player",
      trtcUserId: "u_demo",
      sdkAppId: 14000000,
      userSig: "demo-fake-usersig",
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      ttlSeconds: 600,
    };
  }
}

type HttpRoomClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  idGenerator?: () => string;
  accessToken?: string;
};

type RoomSnapshot = {
  room_id: string;
  room_code: string;
  title: string;
  status: string;
  version: number;
  members: { player_id: string; ready: boolean }[];
};

type ApiError = Error & { status?: number };

/**
 * Phase 1 Demo room-status compatibility table (App-side only).
 * Backend (tonight): lobby → live → processing
 * Legacy aliases kept: waiting, active, ended
 * Phase 2 delete when Backend exports shared App enums.
 */
export function mapBackendRoomStatus(status: string): Room["status"] {
  if (status === "lobby" || status === "waiting") return "waiting";
  if (status === "live" || status === "active") return "live";
  if (status === "processing" || status === "ended") return "ended";
  if (status === "recording_failed") return "recording_failed";
  throw new Error(`未知房间状态：${status}`);
}

function isConflictError(error: unknown): boolean {
  return error instanceof Error && (error as ApiError).status === 409;
}

export class HttpRoomClient implements RoomClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly idGenerator: () => string;
  private token?: string;
  private playerId?: string;
  private versions = new Map<string, number>();

  constructor({
    baseUrl,
    fetcher,
    idGenerator = () => `${Date.now()}-${Math.random()}`,
    accessToken,
  }: HttpRoomClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    const runtimeFetch = fetcher ?? globalThis.fetch?.bind(globalThis);
    if (!runtimeFetch) throw new Error("当前运行环境未提供 globalThis.fetch，无法请求 API");
    this.fetcher = runtimeFetch;
    this.idGenerator = idGenerator;
    if (accessToken) this.token = accessToken;
  }

  getAccessToken(): string | undefined {
    return this.token;
  }

  getPlayerId(): string | undefined {
    return this.playerId;
  }

  async createGuestSession(input: { nickname: string }): Promise<GuestSession> {
    const payload = await this.request("/v1/guest-sessions", { method: "POST", body: JSON.stringify({ display_name: input.nickname }) }, false) as { player_id: string; access_token: string; profile: { display_name: string } };
    this.playerId = payload.player_id;
    this.token = payload.access_token;
    return { playerId: payload.player_id, nickname: payload.profile.display_name };
  }
  async createRoom(input: { title: string }): Promise<Room> {
    return this.mapRoom(await this.request("/v1/rooms", { method: "POST", body: JSON.stringify(input) }) as RoomSnapshot);
  }
  async getRoomByCode(code: string): Promise<Room> { return this.mapRoom(await this.request(`/v1/rooms/by-code/${encodeURIComponent(code)}`, { method: "GET" }, false) as RoomSnapshot); }
  async joinRoom(roomId: string, _input: { playerId: string }): Promise<Room> { return this.mapRoom(await this.request(`/v1/rooms/${roomId}/members`, { method: "POST" }) as RoomSnapshot); }
  async getRoom(roomId: string): Promise<Room> { return this.mapRoom(await this.request(`/v1/rooms/${roomId}`, { method: "GET" }, false) as RoomSnapshot); }
  async setReady(roomId: string, _ready: boolean): Promise<Room> { return this.versioned(roomId, "PUT", "/members/me/ready"); }
  async startRoom(roomId: string): Promise<Room> { return this.versioned(roomId, "POST", "/start"); }
  async endRoom(roomId: string): Promise<Room> { return this.versioned(roomId, "POST", "/end"); }
  async getRoomReport(roomId: string): Promise<RoomReport> {
    const payload = await this.request(`/v1/rooms/${roomId}/report`, { method: "GET" }) as { room: RoomSnapshot; score_jobs: { score_job_id: string; player_id: string; status: ReportItem["status"]; scores?: Record<string, number> }[] };
    this.mapRoom(payload.room);
    return { roomId, items: payload.score_jobs.map((job) => this.mapReportItem(job)) };
  }
  async retryScoreJob(scoreJobId: string): Promise<ReportItem> {
    const job = await this.request(`/v1/score-jobs/${scoreJobId}/retry`, { method: "POST" }) as { score_job_id: string; player_id: string; status: ReportItem["status"]; scores?: Record<string, number> };
    return this.mapReportItem(job);
  }
  async issueRtcGrant(roomId: string): Promise<RtcGrantCredentials> {
    const payload = await this.request(`/v1/rooms/${roomId}/rtc-grants`, { method: "POST" }) as {
      room_id: string;
      str_room_id: string;
      player_id: string;
      trtc_user_id: string;
      sdk_app_id: number;
      user_sig: string;
      expires_at: number;
      ttl_seconds: number;
    };
    return {
      roomId: payload.room_id,
      strRoomId: payload.str_room_id,
      playerId: payload.player_id,
      trtcUserId: payload.trtc_user_id,
      sdkAppId: payload.sdk_app_id,
      userSig: payload.user_sig,
      expiresAt: payload.expires_at,
      ttlSeconds: payload.ttl_seconds,
    };
  }
  private mapReportItem(job: { score_job_id: string; player_id: string; status: string; scores?: Record<string, number>; recognized_text?: string }): ReportItem {
    const status = job.status === "success" ? "completed" : job.status;
    if (!["completed", "processing", "waiting", "failed"].includes(status)) throw new Error(`未知评分状态：${job.status}`);
    return { playerName: job.player_id, scoreJobId: job.score_job_id, status: status as ReportItem["status"], score: job.scores?.overall, pronunciation: job.scores?.pronunciation, fluency: job.scores?.fluency, recognizedText: job.recognized_text };
  }
  private async versioned(roomId: string, method: "POST" | "PUT", suffix: string): Promise<Room> {
    await this.refreshVersion(roomId);
    try {
      return await this.versionedOnce(roomId, method, suffix);
    } catch (error) {
      if (!isConflictError(error)) throw error;
      await this.refreshVersion(roomId);
      return this.versionedOnce(roomId, method, suffix);
    }
  }
  private async refreshVersion(roomId: string): Promise<void> {
    await this.getRoom(roomId);
  }
  private async versionedOnce(roomId: string, method: "POST" | "PUT", suffix: string): Promise<Room> {
    return this.mapRoom(await this.request(`/v1/rooms/${roomId}${suffix}`, { method, body: JSON.stringify({ room_version: this.versions.get(roomId) ?? 1 }) }) as RoomSnapshot);
  }
  private mapRoom(snapshot: RoomSnapshot): Room {
    const room: Room = {
      id: snapshot.room_id,
      code: snapshot.room_code,
      title: snapshot.title,
      status: mapBackendRoomStatus(snapshot.status),
      version: snapshot.version,
      members: snapshot.members.map((member) => ({ playerId: member.player_id, ready: member.ready })),
    };
    this.versions.set(room.id, snapshot.version);
    return room;
  }
  private async request(path: string, init: RequestInit, authorize = true): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorize && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (init.method && init.method !== "GET") headers["Idempotency-Key"] = this.idGenerator();
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const error: ApiError = new Error(`API 请求失败（HTTP ${response.status}）`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
}
