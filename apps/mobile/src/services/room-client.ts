import type { RtcGrantCredentials } from "@/services/rtc-client";

const TOKEN_REFRESH_LEEWAY_SECONDS = 5 * 60;

export type GuestSession = { playerId: string; nickname: string };
export type RoomMember = { playerId: string; displayName?: string; ready: boolean };
export type Room = {
  id: string;
  code: string;
  title: string;
  status: "waiting" | "live" | "ended" | "recording_failed";
  version?: number;
  ownerPlayerId?: string;
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
  failureReason?: string;
};
export type RoomReport = {
  roomId: string;
  roomStatus?: Room["status"] | "processing";
  items: ReportItem[];
};

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
  revokeGuestSession(): Promise<void>;
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
  private playerNames = new Map<string, string>();
  private sequence = 1;

  async createGuestSession(input: { nickname: string }): Promise<GuestSession> {
    const playerId = `guest-${this.sequence++}`;
    this.playerNames.set(playerId, input.nickname);
    return { playerId, nickname: input.nickname };
  }

  async revokeGuestSession(): Promise<void> {}

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
    if (!room) throw new Error("Room not found");
    return room;
  }

  async joinRoom(roomId: string, input: { playerId: string }): Promise<Room> {
    const room = await this.getRoom(roomId);
    if (!room.members.some((member) => member.playerId === input.playerId)) {
      room.members.push({ playerId: input.playerId, displayName: this.playerNames.get(input.playerId), ready: false });
    }
    return room;
  }

  async getRoom(roomId: string): Promise<Room> {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
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
      roomStatus: "ended",
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
    throw new Error("Score job not found");
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
  owner_player_id?: string | null;
  members: { player_id: string; display_name?: string; ready: boolean }[];
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
  throw new Error(`Unknown room status: ${status}`);
}

function isConflictError(error: unknown): boolean {
  return error instanceof Error && (error as ApiError).status === 409;
}

export class HttpRoomClient implements RoomClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly idGenerator: () => string;
  private token?: string;
  private tokenExpiresAt?: number;
  private playerId?: string;
  private refreshInFlight?: Promise<void>;
  private versions = new Map<string, number>();

  constructor({
    baseUrl,
    fetcher,
    idGenerator = () => `${Date.now()}-${Math.random()}`,
    accessToken,
  }: HttpRoomClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    const runtimeFetch = fetcher ?? globalThis.fetch?.bind(globalThis);
    if (!runtimeFetch) throw new Error("globalThis.fetch is unavailable in this runtime; cannot request the API");
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
    const payload = await this.request("/v1/guest-sessions", { method: "POST", body: JSON.stringify({ display_name: input.nickname }) }, false) as { player_id: string; access_token: string; profile: { display_name: string }; expires_at?: number };
    this.playerId = payload.player_id;
    this.token = payload.access_token;
    this.tokenExpiresAt = payload.expires_at;
    return { playerId: payload.player_id, nickname: payload.profile.display_name };
  }
  async revokeGuestSession(): Promise<void> {
    if (!this.token) return;
    await this.request("/v1/guest-sessions/me", { method: "DELETE" });
    this.playerId = undefined;
    this.token = undefined;
    this.tokenExpiresAt = undefined;
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
    const payload = await this.request(`/v1/rooms/${roomId}/report`, { method: "GET" }) as { room: RoomSnapshot; score_jobs: { score_job_id: string; player_id: string; display_name?: string; status: ReportItem["status"]; scores?: Record<string, number>; failure_reason?: string | null }[] };
    this.mapRoom(payload.room);
    return {
      roomId,
      roomStatus:
        payload.room.status === "processing"
          ? "processing"
          : mapBackendRoomStatus(payload.room.status),
      items: payload.score_jobs.map((job) => this.mapReportItem(job)),
    };
  }
  async retryScoreJob(scoreJobId: string): Promise<ReportItem> {
    const job = await this.request(`/v1/score-jobs/${scoreJobId}/retry`, { method: "POST" }) as { score_job_id: string; player_id: string; display_name?: string; status: ReportItem["status"]; scores?: Record<string, number>; failure_reason?: string | null };
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
  private mapReportItem(job: { score_job_id: string; player_id: string; display_name?: string; status: string; scores?: Record<string, number>; recognized_text?: string; failure_reason?: string | null }): ReportItem {
    const status = job.status === "success" ? "completed" : job.status;
    if (!["completed", "processing", "waiting", "failed"].includes(status)) throw new Error(`Unknown score status: ${job.status}`);
    return { playerName: job.display_name ?? job.player_id, scoreJobId: job.score_job_id, status: status as ReportItem["status"], score: job.scores?.overall, pronunciation: job.scores?.pronunciation, fluency: job.scores?.fluency, recognizedText: job.recognized_text, failureReason: job.failure_reason ?? undefined };
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
      ownerPlayerId: snapshot.owner_player_id ?? undefined,
      members: snapshot.members.map((member) => ({ playerId: member.player_id, displayName: member.display_name, ready: member.ready })),
    };
    this.versions.set(room.id, snapshot.version);
    return room;
  }
  private async request(path: string, init: RequestInit, authorize = true, refreshToken = true): Promise<unknown> {
    if (authorize && refreshToken && this.shouldRefreshToken()) {
      await this.refreshGuestSession();
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorize && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (init.method && init.method !== "GET") headers["Idempotency-Key"] = this.idGenerator();
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      if (response.status === 401 && authorize && refreshToken && this.token) {
        await this.refreshGuestSession();
        return this.request(path, init, true, false);
      }
      const error: ApiError = new Error(`API request failed (HTTP ${response.status})`);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return undefined;
    return response.json();
  }

  private shouldRefreshToken(): boolean {
    if (!this.token || this.tokenExpiresAt === undefined) return false;
    return this.tokenExpiresAt - Math.floor(Date.now() / 1000) <= TOKEN_REFRESH_LEEWAY_SECONDS;
  }

  private async refreshGuestSession(): Promise<void> {
    if (!this.token) return;
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.request("/v1/guest-sessions/refresh", { method: "POST" }, true, false)
        .then((payload) => {
          const session = payload as { player_id: string; access_token: string; expires_at?: number };
          this.playerId = session.player_id;
          this.token = session.access_token;
          this.tokenExpiresAt = session.expires_at;
        })
        .finally(() => {
          this.refreshInFlight = undefined;
        });
    }
    await this.refreshInFlight;
  }
}
