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
      completeTurn: "/v1/rooms/{id}/turn/complete",
      end: "/v1/rooms/{id}/end",
      report: "/v1/rooms/{id}/report",
      retry: "/v1/score-jobs/{id}/retry",
      rtcGrants: "/v1/rooms/{id}/rtc-grants",
    });
  });

  it("advances the authoritative speaking turn before allowing the room to end", async () => {
    const client = new FakeRoomClient();
    const first = await client.createGuestSession({ nickname: "Mint" });
    const room = await client.createRoom({ title: "Turn Test" });
    await client.joinRoom(room.id, { playerId: first.playerId });
    await client.setReady(room.id, true);
    const started = await client.startRoom(room.id);

    expect(started.currentSpeakerPlayerId).toBe(first.playerId);
    expect(started.completedTurnCount).toBe(0);
    const completed = await client.completeTurn(room.id);
    expect(completed.currentSpeakerPlayerId).toBeUndefined();
    expect(completed.allTurnsCompleted).toBe(true);
    await expect(client.endRoom(room.id)).resolves.toMatchObject({ status: "ended" });
  });

  it("creates a room and lets a guest join by its code", async () => {
    const client = new FakeRoomClient();
    const session = await client.createGuestSession({ nickname: "Mint" });
    const room = await client.createRoom({ title: "Midnight Session" });

    await client.joinRoom(room.id, { playerId: session.playerId });

    await expect(client.getRoomByCode(room.code)).resolves.toMatchObject({
      id: room.id,
      code: room.code,
      members: [{ playerId: session.playerId, ready: false }],
    });
  });

  it("exposes an end-state report and retries failed score jobs", async () => {
    const client = new FakeRoomClient();
    const room = await client.createRoom({ title: "Report Test" });

    await client.endRoom(room.id);
    const report = await client.getRoomReport(room.id);
    const failed = report.items.find((item) => item.status === "failed");

    expect(failed).toBeDefined();
    await expect(client.retryScoreJob(failed!.scoreJobId)).resolves.toMatchObject({
      status: "processing",
    });
  });
});
