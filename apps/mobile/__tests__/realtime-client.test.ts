import {
  RoomRealtimeClient,
  ROOM_EVENTS_WEBSOCKET_BEARER_SUBPROTOCOL,
  buildRoomEventsWebSocketAuthProtocols,
  buildRoomEventsWebSocketUrl,
  httpApiBaseUrlToWebSocketBaseUrl,
  type RoomRealtimeUpdate,
  type WebSocketConnectOptions,
  type WebSocketFactory,
} from "@/services/realtime-client";

type MockSocket = {
  url: string;
  protocols?: string | string[] | null;
  options?: WebSocketConnectOptions;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  close: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};

function backendRoom(overrides: Record<string, unknown> = {}) {
  return {
    room_id: "room-1",
    room_code: "4827",
    title: "Harbor Mystery",
    status: "lobby",
    version: 1,
    members: [{ player_id: "p1", ready: false }],
    ...overrides,
  };
}

function envelope(
  type: "room.snapshot" | "room.updated",
  roomVersion: number,
  room: ReturnType<typeof backendRoom>,
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    type,
    room_id: "room-1",
    room_version: roomVersion,
    ...extra,
    payload: { room },
  });
}

function createMockWebSocketFactory() {
  const sockets: MockSocket[] = [];
  const factory = jest.fn<WebSocket, [string, (string | string[] | null)?, WebSocketConnectOptions?]>(
    (url, protocols, options) => {
      const socket: MockSocket = {
        url,
        protocols,
        options,
        readyState: 1,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      sockets.push(socket);
      queueMicrotask(() => socket.onopen?.());
      return socket as unknown as WebSocket;
    },
  ) as unknown as WebSocketFactory;
  return { factory, sockets, latest: () => sockets[sockets.length - 1] };
}

describe("httpApiBaseUrlToWebSocketBaseUrl", () => {
  it("maps http to ws and https to wss", () => {
    expect(httpApiBaseUrlToWebSocketBaseUrl("http://127.0.0.1:8000")).toBe("ws://127.0.0.1:8000");
    expect(httpApiBaseUrlToWebSocketBaseUrl("http://localhost:8000/")).toBe("ws://localhost:8000");
    expect(httpApiBaseUrlToWebSocketBaseUrl("https://api.example.com")).toBe("wss://api.example.com");
    expect(httpApiBaseUrlToWebSocketBaseUrl("https://api.example.com/v1/")).toBe("wss://api.example.com/v1");
  });
});

describe("buildRoomEventsWebSocketUrl", () => {
  it("builds the room events path from the HTTP API base URL", () => {
    expect(buildRoomEventsWebSocketUrl("http://api.test", "room/42")).toBe(
      "ws://api.test/v1/rooms/room%2F42/events",
    );
  });
});

describe("buildRoomEventsWebSocketAuthProtocols", () => {
  it("includes the stable bearer subprotocol marker and access token for browser WebSocket auth", () => {
    expect(buildRoomEventsWebSocketAuthProtocols("token-abc")).toEqual([
      ROOM_EVENTS_WEBSOCKET_BEARER_SUBPROTOCOL,
      "token-abc",
    ]);
  });
});

describe("RoomRealtimeClient", () => {
  it("connects with bearer subprotocols for Expo Web and Authorization headers for native", () => {
    const { factory, latest } = createMockWebSocketFactory();
    const client = new RoomRealtimeClient({
      apiBaseUrl: "https://api.test/",
      webSocketFactory: factory,
    });

    client.connect({ roomId: "room-1", accessToken: "token-abc" });

    expect(factory).toHaveBeenCalledTimes(1);
    const socket = latest();
    expect(socket?.url).toBe("wss://api.test/v1/rooms/room-1/events");
    expect(socket?.protocols).toEqual(buildRoomEventsWebSocketAuthProtocols("token-abc"));
    expect(socket?.options).toEqual({
      headers: { Authorization: "Bearer token-abc" },
    });
    client.close();
  });

  it("parses snapshot first and monotonic room.updated events for subscribers", () => {
    const { factory, latest } = createMockWebSocketFactory();
    const client = new RoomRealtimeClient({
      apiBaseUrl: "http://127.0.0.1:8000",
      webSocketFactory: factory,
    });
    const updates: RoomRealtimeUpdate[] = [];
    const unsubscribe = client.subscribe((update) => updates.push(update));

    client.connect({ roomId: "room-1", accessToken: "t" });
    const socket = latest();
    socket?.onmessage?.({
      data: envelope("room.snapshot", 3, backendRoom({ version: 3 })),
    });
    socket?.onmessage?.({
      data: envelope("room.updated", 4, backendRoom({ version: 4, members: [{ player_id: "p1", ready: true }] }), {
        cause: "member.ready_changed",
      }),
    });

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      type: "room.snapshot",
      roomId: "room-1",
      roomVersion: 3,
      room: { id: "room-1", code: "4827", version: 3, members: [{ playerId: "p1", ready: false }] },
    });
    expect(updates[1]).toMatchObject({
      type: "room.updated",
      roomVersion: 4,
      cause: "member.ready_changed",
      room: { members: [{ playerId: "p1", ready: true }] },
    });

    unsubscribe();
    client.close();
  });

  it("ignores stale versions and reports invalid envelopes without regressing subscribers", () => {
    const { factory, latest } = createMockWebSocketFactory();
    const client = new RoomRealtimeClient({
      apiBaseUrl: "http://api",
      webSocketFactory: factory,
    });
    const updates: RoomRealtimeUpdate[] = [];
    const protocolErrors: string[] = [];
    client.subscribe((update) => updates.push(update));
    client.subscribeProtocolErrors((message) => protocolErrors.push(message));

    client.connect({ roomId: "room-1", accessToken: "t" });
    const socket = latest();
    socket?.onmessage?.({ data: envelope("room.snapshot", 5, backendRoom({ version: 5 })) });
    socket?.onmessage?.({ data: envelope("room.updated", 4, backendRoom({ version: 4, title: "stale" })) });
    socket?.onmessage?.({ data: JSON.stringify({ type: "room.updated", room_id: "room-1" }) });
    socket?.onmessage?.({
      data: envelope("room.updated", 6, backendRoom({ version: 6, title: "fresh" })),
    });

    expect(updates).toHaveLength(2);
    expect(updates[1]?.room.title).toBe("fresh");
    expect(protocolErrors.length).toBeGreaterThanOrEqual(1);
    expect(updates.some((item) => item.room.title === "stale")).toBe(false);

    client.close();
  });

  it("close, error handling, and unsubscribe are idempotent and remove listeners", () => {
    const { factory, latest } = createMockWebSocketFactory();
    const client = new RoomRealtimeClient({
      apiBaseUrl: "http://api",
      webSocketFactory: factory,
    });
    const listener = jest.fn();
    const errorListener = jest.fn();
    const off = client.subscribe(listener);
    const offErrors = client.subscribeProtocolErrors(errorListener);

    client.connect({ roomId: "room-1", accessToken: "t" });
    const socket = latest();
    off();
    offErrors();
    off();
    offErrors();

    client.close();
    client.close();
    socket?.onerror?.(new Error("boom"));
    socket?.onclose?.();
    socket?.onmessage?.({ data: envelope("room.snapshot", 1, backendRoom()) });

    expect(listener).not.toHaveBeenCalled();
    expect(errorListener).not.toHaveBeenCalled();
    expect(socket?.close).toHaveBeenCalledTimes(1);
  });
});
