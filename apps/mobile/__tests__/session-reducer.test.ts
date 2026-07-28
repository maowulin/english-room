import {
  initialSessionState,
  sessionReducer,
} from "@/features/session/session-reducer";

describe("sessionReducer", () => {
  it("moves a newly authenticated guest to the lobby", () => {
    const next = sessionReducer(initialSessionState, {
      type: "authenticated",
      player: { id: "player-1", nickname: "Mint" },
    });

    expect(next.screen).toBe("lobby");
    expect(next.player).toEqual({ id: "player-1", nickname: "Mint" });
  });

  it("enters a waiting room and marks the local player ready", () => {
    const inRoom = sessionReducer(initialSessionState, {
      type: "roomJoined",
      room: { id: "room-1", code: "MINT42", title: "Midnight Session" },
    });
    const next = sessionReducer(inRoom, { type: "readyChanged", ready: true });

    expect(next.screen).toBe("waiting");
    expect(next.room?.code).toBe("MINT42");
    expect(next.ready).toBe(true);
  });

  it("switches to the report after the room ends", () => {
    const live = {
      ...initialSessionState,
      screen: "live" as const,
      room: { id: "room-1", code: "MINT42", title: "Midnight Session" },
    };

    expect(sessionReducer(live, { type: "roomEnded" }).screen).toBe("report");
  });
});
