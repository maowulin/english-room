import {
  buildRoomEventsWebSocketUrl,
  httpApiBaseUrlToWebSocketBaseUrl,
  resolveApiBaseUrl,
} from "@/services/api-base-url";
import { mapBackendRoomStatus } from "@/services/room-client";

export { buildRoomEventsWebSocketUrl, httpApiBaseUrlToWebSocketBaseUrl };

/** Sec-WebSocket-Protocol marker paired with the access token for browser WebSocket auth. */
export const ROOM_EVENTS_WEBSOCKET_BEARER_SUBPROTOCOL = "english-room.bearer";

export function buildRoomEventsWebSocketAuthProtocols(accessToken: string): string[] {
  return [ROOM_EVENTS_WEBSOCKET_BEARER_SUBPROTOCOL, accessToken];
}

export type WebSocketConnectOptions = {
  headers?: Record<string, string>;
};

export type WebSocketFactory = (
  url: string,
  protocols?: string | string[] | null,
  options?: WebSocketConnectOptions,
) => WebSocket;

export type RealtimeRoomMember = { playerId: string; displayName?: string; ready: boolean };

/** Wire-format room view derived from server payloads only (not app-authoritative state). */
export type RealtimeRoomView = {
  id: string;
  code: string;
  title: string;
  status: "waiting" | "live" | "ended" | "recording_failed";
  version: number;
  ownerPlayerId?: string;
  members: RealtimeRoomMember[];
};

export type RoomRealtimeUpdate = {
  type: "room.snapshot" | "room.updated";
  roomId: string;
  roomVersion: number;
  cause?: string;
  room: RealtimeRoomView;
};

type BackendRoomPayload = {
  room_id: string;
  room_code: string;
  title: string;
  status: string;
  version: number;
  owner_player_id?: string | null;
  members: { player_id: string; display_name?: string; ready: boolean }[];
};

type RoomEnvelope = {
  type?: string;
  room_id?: string;
  room_version?: number;
  cause?: string;
  payload?: { room?: BackendRoomPayload };
};

export type RoomRealtimeClientOptions = {
  apiBaseUrl?: string;
  webSocketFactory?: WebSocketFactory;
};

export type RoomRealtimeClientLike = {
  connect(input: { roomId: string; accessToken: string }): void;
  subscribe(listener: Listener<RoomRealtimeUpdate>): () => void;
  subscribeProtocolErrors(listener: Listener<string>): () => void;
  close(): void;
};

export type RoomRealtimeClientFactory = () => RoomRealtimeClientLike;

type Listener<T> = (value: T) => void;

function defaultWebSocketFactory(
  url: string,
  protocols?: string | string[] | null,
  options?: WebSocketConnectOptions,
): WebSocket {
  const WebSocketCtor = globalThis.WebSocket as
    | (new (
        url: string,
        protocols?: string | string[] | null,
        options?: WebSocketConnectOptions,
      ) => WebSocket)
    | undefined;
  if (!WebSocketCtor) {
    throw new Error("WebSocket is unavailable in this runtime; cannot connect to the room event stream");
  }
  return new WebSocketCtor(url, protocols ?? null, options);
}

function mapRoomPayload(snapshot: BackendRoomPayload): RealtimeRoomView {
  return {
    id: snapshot.room_id,
    code: snapshot.room_code,
    title: snapshot.title,
    status: mapBackendRoomStatus(snapshot.status),
    version: snapshot.version,
    ownerPlayerId: snapshot.owner_player_id ?? undefined,
    members: snapshot.members.map((member) => ({
      playerId: member.player_id,
      displayName: member.display_name,
      ready: member.ready,
    })),
  };
}

function parseEnvelope(raw: string): RoomEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RoomEnvelope;
  } catch {
    return null;
  }
}

function isSupportedEnvelope(envelope: RoomEnvelope): envelope is RoomEnvelope & {
  type: "room.snapshot" | "room.updated";
  room_id: string;
  room_version: number;
  payload: { room: BackendRoomPayload };
} {
  if (envelope.type !== "room.snapshot" && envelope.type !== "room.updated") return false;
  if (typeof envelope.room_id !== "string" || typeof envelope.room_version !== "number") return false;
  const room = envelope.payload?.room;
  if (!room || typeof room !== "object") return false;
  if (
    typeof room.room_id !== "string" ||
    typeof room.room_code !== "string" ||
    typeof room.title !== "string" ||
    typeof room.status !== "string" ||
    typeof room.version !== "number" ||
    !Array.isArray(room.members)
  ) {
    return false;
  }
  return true;
}

export class RoomRealtimeClient {
  private readonly apiBaseUrl: string;
  private readonly webSocketFactory: WebSocketFactory;
  private socket?: WebSocket;
  private closed = false;
  private lastAppliedVersion = 0;
  private connectedRoomId?: string;
  private readonly updateListeners = new Set<Listener<RoomRealtimeUpdate>>();
  private readonly protocolErrorListeners = new Set<Listener<string>>();

  constructor(options: RoomRealtimeClientOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? resolveApiBaseUrl();
    this.webSocketFactory = options.webSocketFactory ?? defaultWebSocketFactory;
  }

  connect(input: { roomId: string; accessToken: string }): void {
    if (this.closed) return;
    this.connectedRoomId = input.roomId;
    this.lastAppliedVersion = 0;
    this.detachSocket();

    const url = buildRoomEventsWebSocketUrl(this.apiBaseUrl, input.roomId);
    const socket = this.webSocketFactory(url, buildRoomEventsWebSocketAuthProtocols(input.accessToken), {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    this.socket = socket;

    socket.onmessage = (event) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      this.handleMessage(data);
    };
    socket.onerror = () => {
    this.emitProtocolError("WebSocket connection error");
    };
  }

  subscribe(listener: Listener<RoomRealtimeUpdate>): () => void {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  subscribeProtocolErrors(listener: Listener<string>): () => void {
    this.protocolErrorListeners.add(listener);
    return () => {
      this.protocolErrorListeners.delete(listener);
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.detachSocket();
    this.updateListeners.clear();
    this.protocolErrorListeners.clear();
  }

  private detachSocket(): void {
    const socket = this.socket;
    if (!socket) return;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.onopen = null;
    socket.close();
    this.socket = undefined;
  }

  private handleMessage(raw: string): void {
    const envelope = parseEnvelope(raw);
    if (!envelope || !isSupportedEnvelope(envelope)) {
      this.emitProtocolError("Invalid room event envelope");
      return;
    }
    if (this.connectedRoomId && envelope.room_id !== this.connectedRoomId) {
      this.emitProtocolError("room_id does not match the current connection");
      return;
    }
    if (envelope.room_version <= this.lastAppliedVersion) {
      return;
    }

    let room: RealtimeRoomView;
    try {
      room = mapRoomPayload(envelope.payload.room);
    } catch (error) {
      this.emitProtocolError(error instanceof Error ? error.message : "Failed to parse room payload");
      return;
    }

    this.lastAppliedVersion = envelope.room_version;
    if (envelope.type === "room.snapshot") {
      const update: RoomRealtimeUpdate = {
        type: "room.snapshot",
        roomId: envelope.room_id,
        roomVersion: envelope.room_version,
        room,
      };
      for (const listener of this.updateListeners) {
        listener(update);
      }
      return;
    }

    const update: RoomRealtimeUpdate = {
      type: "room.updated",
      roomId: envelope.room_id,
      roomVersion: envelope.room_version,
      room,
      ...(envelope.cause ? { cause: envelope.cause } : {}),
    };
    for (const listener of this.updateListeners) {
      listener(update);
    }
  }

  private emitProtocolError(message: string): void {
    for (const listener of this.protocolErrorListeners) {
      listener(message);
    }
  }
}
