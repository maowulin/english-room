import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

import { RoomApp } from "@/features/session/room-app";
import type { MediaUiState } from "@/features/session/story-screens";
import { FakeRoomClient, type RoomClient } from "@/services/room-client";
import type { RoomRealtimeClientFactory, RoomRealtimeUpdate } from "@/services/realtime-client";

class RealtimeCapableRoomClient extends FakeRoomClient {
  getAccessToken(): string | undefined {
    return "room-events-token";
  }
}

function createControllableRealtimeFactory() {
  let onUpdate: ((update: RoomRealtimeUpdate) => void) | undefined;
  let onProtocolError: ((message: string) => void) | undefined;
  const connect = jest.fn();
  const close = jest.fn();
  const factory: RoomRealtimeClientFactory = () => ({
    connect,
    subscribe: (listener) => {
      onUpdate = listener;
      return () => {
        onUpdate = undefined;
      };
    },
    subscribeProtocolErrors: (listener) => {
      onProtocolError = listener;
      return () => {
        onProtocolError = undefined;
      };
    },
    close,
  });
  return {
    factory,
    connect,
    close,
    emitUpdate: (update: RoomRealtimeUpdate) => onUpdate?.(update),
    emitProtocolError: (message: string) => onProtocolError?.(message),
  };
}

const realWaitingMedia: MediaUiState = {
  mode: "real",
  network: "good",
  permission: "granted",
  grant: "ready",
  rtc: "idle",
  recording: "idle",
  report: "waiting",
};

describe("RoomApp room realtime", () => {
  afterEach(cleanup);

  const enterWaiting = async (
    client: RoomClient,
    factory: RoomRealtimeClientFactory,
    mediaState: MediaUiState = realWaitingMedia,
  ) => {
    const view = await render(
      <RoomApp client={client} mediaState={mediaState} realtimeClientFactory={factory} />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await view.findByText("Waiting for everyone to take a seat");
    return view;
  };

  it("does not connect room realtime when using plain FakeRoomClient", async () => {
    const { factory, connect } = createControllableRealtimeFactory();
    await enterWaiting(new FakeRoomClient(), factory);
    expect(connect).not.toHaveBeenCalled();
  });

  it("connects after join and applies snapshot members to waiting UI", async () => {
    const { factory, connect, emitUpdate } = createControllableRealtimeFactory();
    const view = await enterWaiting(new RealtimeCapableRoomClient(), factory);

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "room-events-token", roomId: expect.any(String) }),
    );
    expect(connect.mock.calls[0]?.[0]?.accessToken).not.toMatch(/Bearer/);

    await act(async () => {
      emitUpdate({
        type: "room.snapshot",
        roomId: connect.mock.calls[0]![0]!.roomId,
        roomVersion: 2,
        room: {
          id: connect.mock.calls[0]![0]!.roomId,
          code: "4827",
          title: "Harbor Mystery",
          status: "waiting",
          version: 2,
          turnIndex: 0,
          completedTurnCount: 0,
          allTurnsCompleted: false,
          members: [
            { playerId: "guest-1", displayName: "Avery", ready: false },
            { playerId: "guest-2", displayName: "Rowan", ready: true },
          ],
        },
      });
    });

    expect(view.getByText("You")).toBeTruthy();
    expect(view.getByText("Guest")).toBeTruthy();
    expect(view.getByText("Rowan")).toBeTruthy();
    expect(view.queryByText("guest-2")).toBeNull();
    expect(view.getAllByText("Ready").length).toBeGreaterThan(0);
  });

  it("closes realtime on leave", async () => {
    const { factory, close } = createControllableRealtimeFactory();
    const view = await enterWaiting(new RealtimeCapableRoomClient(), factory);

    await act(async () => {
      fireEvent.press(view.getByLabelText("Leave room"));
    });
    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();
    expect(close).toHaveBeenCalled();
  });

  it("closes realtime on unmount while still in room", async () => {
    const { factory, close } = createControllableRealtimeFactory();
    const view = await enterWaiting(new RealtimeCapableRoomClient(), factory);

    const callsBeforeUnmount = close.mock.calls.length;
    await act(async () => {
      view.unmount();
    });
    expect(close.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
  });

  it("ignores websocket protocol errors without breaking waiting screen or faking rtc joined", async () => {
    const { factory, emitProtocolError } = createControllableRealtimeFactory();
    const view = await enterWaiting(
      new RealtimeCapableRoomClient(),
      factory,
      { ...realWaitingMedia, rtc: "idle" },
    );

    await act(async () => {
      emitProtocolError("WebSocket connection error");
    });

    expect(view.getByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(view.queryByLabelText("API error")).toBeNull();
    expect(view.queryByLabelText("Real voice mode")).toBeNull();
    expect(view.getByText("TRTC: Waiting for connection")).toBeTruthy();
  });

  it("does not mark a real room ready before TRTC has joined", async () => {
    const previousMode = process.env.EXPO_PUBLIC_MEDIA_MODE;
    process.env.EXPO_PUBLIC_MEDIA_MODE = "real";
    const { factory } = createControllableRealtimeFactory();
    const client = new RealtimeCapableRoomClient();
    const setReady = jest.spyOn(client, "setReady");
    try {
      const view = await enterWaiting(client, factory, { ...realWaitingMedia, rtc: "idle" });

      await act(async () => {
        fireEvent.press(view.getByTestId("ready-button"));
      });

      expect(setReady).not.toHaveBeenCalled();
      expect(view.getByText("Waiting for microphone access and room connection.")).toBeTruthy();
    } finally {
      process.env.EXPO_PUBLIC_MEDIA_MODE = previousMode;
    }
  });
});
