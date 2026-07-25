export type GuestSession = { playerId: string; nickname: string };
export type RoomMember = { playerId: string; ready: boolean };
export type Room = {
  id: string;
  code: string;
  title: string;
  status: "waiting" | "live" | "ended";
  version?: number;
  members: RoomMember[];
};
export type ReportItem = {
  playerName: string;
  scoreJobId: string;
  status: "completed" | "processing" | "waiting" | "failed";
  score?: number;
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
} as const;

export interface RoomClient {
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
}

export class FakeRoomClient implements RoomClient {
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
}

type HttpRoomClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  idGenerator?: () => string;
};

type RoomSnapshot = {
  room_id: string;
  room_code: string;
  title: string;
  status: string;
  version: number;
  members: { player_id: string; ready: boolean }[];
};

export class HttpRoomClient implements RoomClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly idGenerator: () => string;
  private token?: string;
  private versions = new Map<string, number>();

  constructor({ baseUrl, fetcher = fetch, idGenerator = () => `${Date.now()}-${Math.random()}` }: HttpRoomClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetcher = fetcher;
    this.idGenerator = idGenerator;
  }

  async createGuestSession(input: { nickname: string }): Promise<GuestSession> {
    const payload = await this.request("/v1/guest-sessions", { method: "POST", body: JSON.stringify({ display_name: input.nickname }) }, false) as { player_id: string; access_token: string; profile: { display_name: string } };
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
    return { roomId, items: payload.score_jobs.map((job) => ({ playerName: job.player_id, scoreJobId: job.score_job_id, status: job.status, score: job.scores?.total })) };
  }
  async retryScoreJob(scoreJobId: string): Promise<ReportItem> {
    const job = await this.request(`/v1/score-jobs/${scoreJobId}/retry`, { method: "POST" }) as { score_job_id: string; player_id: string; status: ReportItem["status"]; scores?: Record<string, number> };
    return { playerName: job.player_id, scoreJobId: job.score_job_id, status: job.status, score: job.scores?.total };
  }
  private async versioned(roomId: string, method: "POST" | "PUT", suffix: string): Promise<Room> {
    return this.mapRoom(await this.request(`/v1/rooms/${roomId}${suffix}`, { method, body: JSON.stringify({ room_version: this.versions.get(roomId) ?? 1 }) }) as RoomSnapshot);
  }
  private mapRoom(snapshot: RoomSnapshot): Room {
    const room: Room = { id: snapshot.room_id, code: snapshot.room_code, title: snapshot.title, status: snapshot.status === "active" ? "live" : snapshot.status === "ended" ? "ended" : "waiting", version: snapshot.version, members: snapshot.members.map((member) => ({ playerId: member.player_id, ready: member.ready })) };
    this.versions.set(room.id, snapshot.version);
    return room;
  }
  private async request(path: string, init: RequestInit, authorize = true): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorize && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (init.method && init.method !== "GET") headers["Idempotency-Key"] = this.idGenerator();
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`API 请求失败（HTTP ${response.status}）`);
    return response.json();
  }
}
