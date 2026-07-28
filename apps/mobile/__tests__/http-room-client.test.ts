import { HttpRoomClient, mapBackendRoomStatus } from "@/services/room-client";

describe("HttpRoomClient", () => {
  it("binds globalThis.fetch when no fetcher is injected", async () => {
    const original = globalThis.fetch;
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ player_id: "p", access_token: "t", profile: { display_name: "Mint" } }) });
    globalThis.fetch = fetcher as typeof fetch;
    try {
      await new HttpRoomClient({ baseUrl: "http://api" }).createGuestSession({ nickname: "Mint" });
      expect(fetcher).toHaveBeenCalledWith("http://api/v1/guest-sessions", expect.any(Object));
    } finally { globalThis.fetch = original; }
  });

  it("maps Phase 1 backend room statuses with an explicit compatibility table", () => {
    expect(mapBackendRoomStatus("lobby")).toBe("waiting");
    expect(mapBackendRoomStatus("waiting")).toBe("waiting");
    expect(mapBackendRoomStatus("live")).toBe("live");
    expect(mapBackendRoomStatus("active")).toBe("live");
    expect(mapBackendRoomStatus("processing")).toBe("ended");
    expect(mapBackendRoomStatus("ended")).toBe("ended");
    expect(mapBackendRoomStatus("recording_failed")).toBe("recording_failed");
    expect(() => mapBackendRoomStatus("scoring")).toThrow("Unknown room status: scoring");
  });

  it("maps sessions, snapshots, reports and retry requests to the FastAPI contract", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "token", profile: { display_name: "Mint" } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 3, owner_player_id: "p1", members: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 3, owner_player_id: "p1", members: [{ player_id: "p1", ready: false }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 4, owner_player_id: "p1", members: [{ player_id: "p1", ready: false }, { player_id: "p2", ready: false }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room: { room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "processing", version: 5, owner_player_id: "p1", members: [] }, score_jobs: [{ score_job_id: "s1", player_id: "p1", status: "success", scores: { overall: 86, pronunciation: 88, fluency: 82 }, recognized_text: "Hello", failure_reason: null }, { score_job_id: "s2", player_id: "p2", status: "failed", scores: {}, failure_reason: "SOE service is not enabled; enable the new speech assessment service in the Tencent Cloud console" }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ score_job_id: "s1", player_id: "p1", status: "processing", scores: {} }) } as Response);
    const client = new HttpRoomClient({ baseUrl: "http://api/", fetcher, idGenerator: () => "key-1" });

    await expect(client.createGuestSession({ nickname: "Mint" })).resolves.toEqual({ playerId: "p1", nickname: "Mint" });
    expect(client.getAccessToken()).toBe("token");
    const room = await client.createRoom({ title: "Harbor Mystery" });
    expect(room).toMatchObject({ id: "r1", code: "4827", version: 3, status: "waiting" });
    expect(room.ownerPlayerId).toBe("p1");
    await expect(client.getRoomByCode("4827")).resolves.toMatchObject({ id: "r1", code: "4827", status: "waiting" });
    await expect(client.joinRoom("r1", { playerId: "p2" })).resolves.toMatchObject({
      members: [{ playerId: "p1", ready: false }, { playerId: "p2", ready: false }],
    });
    await expect(client.getRoomReport("r1")).resolves.toMatchObject({ roomId: "r1", items: [{ scoreJobId: "s1", status: "completed", score: 86 }, { scoreJobId: "s2", status: "failed", failureReason: "SOE service is not enabled; enable the new speech assessment service in the Tencent Cloud console" }] });
    await expect(client.retryScoreJob("s1")).resolves.toMatchObject({ status: "processing" });

    expect(fetcher).toHaveBeenNthCalledWith(2, "http://api/v1/rooms", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token", "Idempotency-Key": "key-1" }) }));
    expect(fetcher).toHaveBeenNthCalledWith(3, "http://api/v1/rooms/by-code/4827", expect.any(Object));
    expect(fetcher).toHaveBeenNthCalledWith(4, "http://api/v1/rooms/r1/members", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token", "Idempotency-Key": "key-1" }) }));
    expect(fetcher).toHaveBeenNthCalledWith(6, "http://api/v1/score-jobs/s1/retry", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token", "Idempotency-Key": "key-1" }) }));
  });

  it("refreshes the guest token and retries a room join after HTTP 401", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "old-token", profile: { display_name: "Mint" }, expires_at: Math.floor(Date.now() / 1000) + 3600 }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: "invalid player session" }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "new-token", profile: { display_name: "Mint" }, expires_at: Math.floor(Date.now() / 1000) + 3600 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 1, members: [{ player_id: "p1", ready: false }] }) } as Response);
    const client = new HttpRoomClient({ baseUrl: "http://api", fetcher, idGenerator: () => "join-key" });

    await client.createGuestSession({ nickname: "Mint" });
    await expect(client.joinRoom("r1", { playerId: "p1" })).resolves.toMatchObject({ id: "r1", members: [{ playerId: "p1" }] });
    expect(fetcher).toHaveBeenNthCalledWith(3, "http://api/v1/guest-sessions/refresh", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer old-token" }) }));
    expect(fetcher).toHaveBeenNthCalledWith(4, "http://api/v1/rooms/r1/members", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer new-token" }) }));
  });

  it("refreshes an expiring guest token before the next authorized request", async () => {
    const expiresSoon = Math.floor(Date.now() / 1000) + 60;
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "old-token", profile: { display_name: "Mint" }, session_type: "guest", created_at: 100, expires_at: expiresSoon }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "new-token", profile: { display_name: "Mint" }, session_type: "guest", created_at: 100, expires_at: expiresSoon + 86400 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 1, members: [] }) } as Response);
    const client = new HttpRoomClient({ baseUrl: "http://api", fetcher });

    await client.createGuestSession({ nickname: "Mint" });
    await client.createRoom({ title: "Harbor Mystery" });

    expect(fetcher).toHaveBeenNthCalledWith(2, "http://api/v1/guest-sessions/refresh", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer old-token" }),
    }));
    expect(fetcher).toHaveBeenNthCalledWith(3, "http://api/v1/rooms", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer new-token" }),
    }));
    expect(client.getAccessToken()).toBe("new-token");
  });

  it("refreshes room version before writes and retries once after HTTP 409", async () => {
    let readyCalls = 0;
    const fetcher = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/v1/guest-sessions")) {
        return { ok: true, json: async () => ({ player_id: "p1", access_token: "token", profile: { display_name: "Mint" } }) } as Response;
      }
      if (path.endsWith("/v1/rooms") && init?.method === "POST") {
        return { ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 1, members: [] }) } as Response;
      }
      if (path.endsWith("/v1/rooms/r1") && (!init?.method || init.method === "GET")) {
        return { ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 2, members: [] }) } as Response;
      }
      if (path.endsWith("/members/me/ready")) {
        readyCalls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as { room_version?: number };
        if (readyCalls === 1) {
          expect(body.room_version).toBe(2);
          return { ok: false, status: 409, json: async () => ({ detail: "stale" }) } as Response;
        }
        expect(body.room_version).toBe(2);
        return { ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "lobby", version: 3, members: [{ player_id: "p1", ready: true }] }) } as Response;
      }
      throw new Error(`unexpected ${path}`);
    });

    const client = new HttpRoomClient({ baseUrl: "http://api", fetcher: fetcher as typeof fetch, idGenerator: () => `key-${readyCalls}` });
    await client.createGuestSession({ nickname: "Mint" });
    await client.createRoom({ title: "Harbor Mystery" });
    await expect(client.setReady("r1", true)).resolves.toMatchObject({ version: 3, status: "waiting" });
    expect(readyCalls).toBe(2);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/v1/rooms/r1")).length).toBeGreaterThanOrEqual(2);
  });

  it("rejects unknown backend room status instead of falling back to waiting", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "token", profile: { display_name: "Mint" } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "Harbor Mystery", status: "weird", version: 1, members: [] }) } as Response);
    const client = new HttpRoomClient({ baseUrl: "http://api", fetcher, idGenerator: () => "key" });
    await client.createGuestSession({ nickname: "Mint" });
    await expect(client.createRoom({ title: "Harbor Mystery" })).rejects.toThrow("Unknown room status: weird");
  });
});
