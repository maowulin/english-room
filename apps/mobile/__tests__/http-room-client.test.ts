import { HttpRoomClient } from "@/services/room-client";

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

  it("maps sessions, snapshots, reports and retry requests to the FastAPI contract", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher
      .mockResolvedValueOnce({ ok: true, json: async () => ({ player_id: "p1", access_token: "token", profile: { display_name: "Mint" } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room_id: "r1", room_code: "4827", title: "雾港疑云", status: "lobby", version: 3, members: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ room: { room_id: "r1", room_code: "4827", title: "雾港疑云", status: "ended", version: 5, members: [] }, score_jobs: [{ score_job_id: "s1", player_id: "p1", status: "failed", scores: { total: 86 } }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ score_job_id: "s1", player_id: "p1", status: "processing", scores: {} }) } as Response);
    const client = new HttpRoomClient({ baseUrl: "http://api/", fetcher, idGenerator: () => "key-1" });

    await expect(client.createGuestSession({ nickname: "Mint" })).resolves.toEqual({ playerId: "p1", nickname: "Mint" });
    const room = await client.createRoom({ title: "雾港疑云" });
    expect(room).toMatchObject({ id: "r1", code: "4827", version: 3, status: "waiting" });
    await expect(client.getRoomReport("r1")).resolves.toMatchObject({ roomId: "r1", items: [{ scoreJobId: "s1", status: "failed", score: 86 }] });
    await expect(client.retryScoreJob("s1")).resolves.toMatchObject({ status: "processing" });

    expect(fetcher).toHaveBeenNthCalledWith(2, "http://api/v1/rooms", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token", "Idempotency-Key": "key-1" }) }));
    expect(fetcher).toHaveBeenNthCalledWith(4, "http://api/v1/score-jobs/s1/retry", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token", "Idempotency-Key": "key-1" }) }));
  });
});
