export type GuestSession = { playerId: string; nickname: string };
export type RoomMember = { playerId: string; ready: boolean };
export type Room = {
  id: string;
  code: string;
  title: string;
  status: "waiting" | "live" | "ended";
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
