import { FakeRoomClient, roomApiPaths } from "@/services/room-client";

describe("FakeRoomClient", () => {
  it("keeps the replaceable client aligned to the REST room contract", () => {
    expect(roomApiPaths).toEqual({
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
    });
  });

  it("creates a room and lets a guest join by its code", async () => {
    const client = new FakeRoomClient();
    const session = await client.createGuestSession({ nickname: "Mint" });
    const room = await client.createRoom({ title: "午夜会话" });

    await client.joinRoom(room.id, { playerId: session.playerId });

    await expect(client.getRoomByCode(room.code)).resolves.toMatchObject({
      id: room.id,
      code: room.code,
      members: [{ playerId: session.playerId, ready: false }],
    });
  });

  it("exposes an end-state report and retries failed score jobs", async () => {
    const client = new FakeRoomClient();
    const room = await client.createRoom({ title: "报告测试" });

    await client.endRoom(room.id);
    const report = await client.getRoomReport(room.id);
    const failed = report.items.find((item) => item.status === "failed");

    expect(failed).toBeDefined();
    await expect(client.retryScoreJob(failed!.scoreJobId)).resolves.toMatchObject({
      status: "processing",
    });
  });
});
