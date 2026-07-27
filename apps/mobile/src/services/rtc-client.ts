export type RtcConnectionState =
  | "idle"
  | "joining"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "kicked"
  | "joinFailed";

export type RtcNetworkQuality = "good" | "weak" | "bad";

export type RtcGrantCredentials = {
  roomId: string;
  strRoomId: string;
  playerId: string;
  trtcUserId: string;
  sdkAppId: number;
  userSig: string;
  expiresAt: number;
  ttlSeconds: number;
};

export type RtcState = {
  joined: boolean;
  muted: boolean;
  speakerOn: boolean;
  connection: RtcConnectionState;
};

export type RtcSubscriptions = {
  onState?: (state: RtcState) => void;
  onNetwork?: (quality: RtcNetworkQuality) => void;
  onRemoteUserEnter?: (userId: string) => void;
  onRemoteUserLeave?: (userId: string) => void;
  onUserAudioAvailable?: (userId: string, available: boolean) => void;
  onUserVoiceVolume?: (userId: string, volume: number) => void;
};

export interface RtcClient {
  join(input: RtcGrantCredentials | { roomId: string; userId: string }): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setSpeaker(speakerOn: boolean): Promise<void>;
  /** @deprecated Demo-only visual hook; real clients ignore this. */
  setConnectionState(state: Extract<RtcConnectionState, "connected" | "reconnecting" | "disconnected">): Promise<void>;
  subscribe(subscriptions: RtcSubscriptions): () => void;
  getState(): RtcState;
  dispose(): void;
}

// Demo/Fake: Phase 1 control-plane only; no real TRTC/SOE media path.
export class FakeRtcClient implements RtcClient {
  private state: RtcState = {
    joined: false,
    muted: false,
    speakerOn: true,
    connection: "disconnected",
  };
  private subscriptions: RtcSubscriptions = {};

  async join(input: RtcGrantCredentials | { roomId: string; userId: string }): Promise<void> {
    void input;
    this.patch({ joined: true, connection: "connected" });
  }

  async leave(): Promise<void> {
    this.patch({ joined: false, connection: "disconnected" });
  }

  async setMuted(muted: boolean): Promise<void> {
    this.patch({ muted });
  }

  async setSpeaker(speakerOn: boolean): Promise<void> {
    this.patch({ speakerOn });
  }

  async setConnectionState(
    connection: Extract<RtcConnectionState, "connected" | "reconnecting" | "disconnected">,
  ): Promise<void> {
    this.patch({ connection });
  }

  subscribe(subscriptions: RtcSubscriptions): () => void {
    this.subscriptions = { ...this.subscriptions, ...subscriptions };
    return () => {
      this.subscriptions = {};
    };
  }

  getState(): RtcState {
    return this.state;
  }

  dispose(): void {
    this.subscriptions = {};
  }

  private patch(partial: Partial<RtcState>) {
    this.state = { ...this.state, ...partial };
    this.subscriptions.onState?.(this.state);
  }
}

export type MediaRuntimeMode = "demo" | "real" | "web";

export function resolveMediaMode(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = "native",
): MediaRuntimeMode {
  const configured = env.EXPO_PUBLIC_MEDIA_MODE;
  if (configured === "real" || configured === "demo" || configured === "web") {
    return configured;
  }
  if (platform === "web") return "web";
  return "demo";
}
