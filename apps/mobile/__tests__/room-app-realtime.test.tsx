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
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await view.findByText("等待同伴入座");
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
          title: "雾港疑云",
          status: "waiting",
          version: 2,
          members: [
            { playerId: "guest-1", ready: false },
            { playerId: "guest-2", ready: true },
          ],
        },
      });
    });

    expect(view.getAllByText("guest-2").length).toBeGreaterThan(0);
    expect(view.getAllByText("已准备").length).toBeGreaterThan(0);
  });

  it("closes realtime on leave", async () => {
    const { factory, close } = createControllableRealtimeFactory();
    const view = await enterWaiting(new RealtimeCapableRoomClient(), factory);

    await act(async () => {
      fireEvent.press(view.getByLabelText("离开房间"));
    });
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();
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
      emitProtocolError("WebSocket 连接错误");
    });

    expect(view.getByText("等待同伴入座")).toBeTruthy();
    expect(view.queryByLabelText("API 错误")).toBeNull();
    expect(view.getByLabelText("真实语音模式")).toBeTruthy();
  });
});
