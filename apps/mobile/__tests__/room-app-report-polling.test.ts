import { pollRoomReport } from "@/features/session/room-app";
import type { RoomClient, RoomReport } from "@/services/room-client";

describe("pollRoomReport", () => {
  it("re-reads a processing report until the backend reaches a terminal state", async () => {
    const processing: RoomReport = { roomId: "room-1", roomStatus: "processing", items: [] };
    const completed: RoomReport = {
      roomId: "room-1",
      roomStatus: "ended",
      items: [{ playerName: "Mint", scoreJobId: "score-1", status: "completed", score: 86 }],
    };
    const client = {
      getRoomReport: jest.fn().mockResolvedValueOnce(processing).mockResolvedValueOnce(completed),
    } as Pick<RoomClient, "getRoomReport">;
    const sleep = jest.fn(async () => undefined);

    await expect(pollRoomReport(client as RoomClient, "room-1", sleep)).resolves.toEqual(completed);
    expect(client.getRoomReport).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("returns the latest processing report after the bounded polling window", async () => {
    const processing: RoomReport = { roomId: "room-1", roomStatus: "processing", items: [] };
    const client = {
      getRoomReport: jest.fn().mockResolvedValue(processing),
    } as Pick<RoomClient, "getRoomReport">;

    await expect(pollRoomReport(client as RoomClient, "room-1", async () => undefined)).resolves.toEqual(processing);
    expect(client.getRoomReport).toHaveBeenCalledTimes(60);
  });
});
