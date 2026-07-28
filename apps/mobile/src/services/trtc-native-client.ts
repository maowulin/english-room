import type {
  RtcClient,
  RtcConnectionState,
  RtcGrantCredentials,
  RtcNetworkQuality,
  RtcState,
  RtcSubscriptions,
} from "@/services/rtc-client";

export type TrtcListener = (type: string, params: Record<string, unknown>) => void;

export type TrtcParamsLike = {
  sdkAppId: number;
  userId: string;
  userSig: string;
  roomId: number;
  strRoomId: string;
};

export type TrtcCloudLike = {
  registerListener(listener: TrtcListener): void;
  unRegisterListener(listener: TrtcListener): void;
  enterRoom(params: TrtcParamsLike, scene: number): Promise<void>;
  exitRoom(): Promise<void>;
  startLocalAudio(quality: number): Promise<void>;
  muteLocalAudio(mute: boolean): Promise<void>;
  setAudioRoute(route: number): Promise<void>;
  enableAudioVolumeEvaluation(intervalMs: number): Promise<void>;
};

export type TrtcNativeClientOptions = {
  cloud: TrtcCloudLike;
  sceneAudioCall: number;
  audioQualitySpeech: number;
  audioRouteSpeaker: number;
  audioRouteEarpiece: number;
  volumeIntervalMs?: number;
  /** Max wait for onEnterRoom after native enterRoom resolves (ms). */
  joinAckTimeoutMs?: number;
  /** Max wait for onExitRoom before leave resolves fail-open (ms). */
  leaveAckTimeoutMs?: number;
};

/** Default TRTC join ack window — long enough for cold native SDK, bounded for UX recovery. */
export const DEFAULT_JOIN_ACK_TIMEOUT_MS = 30_000;

function isGrant(input: RtcGrantCredentials | { roomId: string; userId: string }): input is RtcGrantCredentials {
  return "strRoomId" in input && "sdkAppId" in input && "userSig" in input && "trtcUserId" in input;
}

function mapNetworkQuality(raw: unknown): RtcNetworkQuality {
  const value = typeof raw === "number" ? raw : Number((raw as { quality?: number } | undefined)?.quality);
  if (!Number.isFinite(value) || value <= 2) return "good";
  if (value === 3) return "weak";
  return "bad";
}

/**
 * Real-media TRTC adapter. Joined/muted/speaker state only advance after SDK
 * calls / listener callbacks succeed — never optimistic UI pretends.
 */
export class TrtcNativeClient implements RtcClient {
  private readonly cloud: TrtcCloudLike;
  private readonly sceneAudioCall: number;
  private readonly audioQualitySpeech: number;
  private readonly audioRouteSpeaker: number;
  private readonly audioRouteEarpiece: number;
  private readonly volumeIntervalMs: number;
  private readonly joinAckTimeoutMs: number;
  private readonly leaveAckTimeoutMs: number;
  private readonly listener: TrtcListener;
  private subscriptions: RtcSubscriptions = {};
  private enterResolve: (() => void) | undefined;
  private enterReject: ((error: Error) => void) | undefined;
  private joinAckTimer: ReturnType<typeof setTimeout> | undefined;
  private exitResolve: (() => void) | undefined;
  private leavePromise: Promise<void> | undefined;
  private localUserId: string | undefined;
  private disposed = false;
  private state: RtcState = {
    joined: false,
    muted: false,
    speakerOn: true,
    connection: "idle",
  };

  constructor(options: TrtcNativeClientOptions) {
    this.cloud = options.cloud;
    this.sceneAudioCall = options.sceneAudioCall;
    this.audioQualitySpeech = options.audioQualitySpeech;
    this.audioRouteSpeaker = options.audioRouteSpeaker;
    this.audioRouteEarpiece = options.audioRouteEarpiece;
    this.volumeIntervalMs = options.volumeIntervalMs ?? 300;
    this.joinAckTimeoutMs = options.joinAckTimeoutMs ?? DEFAULT_JOIN_ACK_TIMEOUT_MS;
    this.leaveAckTimeoutMs = options.leaveAckTimeoutMs ?? 3000;
    this.listener = (type, params) => this.handleListener(type, params);
    this.cloud.registerListener(this.listener);
  }

  async join(input: RtcGrantCredentials | { roomId: string; userId: string }): Promise<void> {
    if (this.disposed) {
      throw new Error("TRTC client disposed");
    }
    if (!isGrant(input)) {
      throw new Error("Joining a real voice room requires a backend RTC grant (including str_room_id / user_sig)");
    }
    if (this.leavePromise) {
      throw new Error("Leaving the room is in progress; rejoining is unavailable until onExitRoom completes");
    }
    if (this.state.joined) {
      throw new Error("Already in a room; leave before joining another one");
    }
    if (this.state.connection === "joining" || this.enterResolve || this.enterReject) {
      throw new Error("A room join is already in progress; duplicate joins are not allowed");
    }

    this.localUserId = input.trtcUserId;
    this.patch({ connection: "joining", joined: false });
    const entered = new Promise<void>((resolve, reject) => {
      this.enterResolve = resolve;
      this.enterReject = reject;
    });
    try {
      await this.cloud.enterRoom(
        {
          sdkAppId: input.sdkAppId,
          userId: input.trtcUserId,
          userSig: input.userSig,
          roomId: 0,
          strRoomId: input.strRoomId,
        },
        this.sceneAudioCall,
      );
    } catch (error) {
      this.clearJoinAckTimer();
      this.clearEnterWaiters();
      this.patch({ connection: "joinFailed", joined: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
    this.joinAckTimer = setTimeout(() => {
      this.joinAckTimer = undefined;
      if (!this.enterReject) {
        return;
      }
      this.failPendingJoin(new Error(`TRTC enterRoom ack timeout (${this.joinAckTimeoutMs}ms)`));
    }, this.joinAckTimeoutMs);
    try {
      await entered;
    } catch (error) {
      this.clearJoinAckTimer();
      throw error;
    }
    this.clearJoinAckTimer();
    try {
      await this.cloud.startLocalAudio(this.audioQualitySpeech);
      await this.cloud.setAudioRoute(this.audioRouteSpeaker);
      await this.cloud.enableAudioVolumeEvaluation(this.volumeIntervalMs);
      this.patch({ joined: true, connection: "connected", speakerOn: true, muted: false });
    } catch (error) {
      this.patch({ connection: "joinFailed", joined: false });
      try {
        await this.cloud.exitRoom();
      } catch {
        // Best-effort TRTC cleanup after partial join setup failure.
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async leave(): Promise<void> {
    if (this.leavePromise) {
      return this.leavePromise;
    }
    if (!this.state.joined && this.state.connection !== "joining") {
      if (this.state.connection !== "kicked") {
        this.patch({ joined: false, connection: "disconnected" });
      }
      return;
    }

    this.leavePromise = (async () => {
      const waiting = new Promise<void>((resolve) => {
        this.exitResolve = resolve;
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, this.leaveAckTimeoutMs);
      });
      try {
        await this.cloud.exitRoom();
        await Promise.race([waiting, timedOut]);
      } finally {
        if (timer) clearTimeout(timer);
        if (this.state.joined || this.state.connection === "joining") {
          this.patch({ joined: false, connection: "disconnected" });
        }
        this.localUserId = undefined;
        this.exitResolve = undefined;
        this.leavePromise = undefined;
      }
    })();

    return this.leavePromise;
  }

  async setMuted(muted: boolean): Promise<void> {
    // Cloud recording continuity requires muteLocalAudio, never stopLocalAudio.
    await this.cloud.muteLocalAudio(muted);
    this.patch({ muted });
  }

  async setSpeaker(speakerOn: boolean): Promise<void> {
    await this.cloud.setAudioRoute(speakerOn ? this.audioRouteSpeaker : this.audioRouteEarpiece);
    this.patch({ speakerOn });
  }

  async setConnectionState(): Promise<void> {
    // Real clients ignore demo visual hooks.
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
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearJoinAckTimer();
    this.clearEnterWaiters(new Error("TRTC client disposed"));
    this.exitResolve = undefined;
    this.leavePromise = undefined;
    if (this.state.joined) {
      void this.cloud.exitRoom().catch(() => {
        // Best-effort TRTC cleanup on dispose; do not wait for onExitRoom.
      });
    }
    this.patch({ joined: false, connection: "disconnected" });
    this.localUserId = undefined;
    this.subscriptions = {};
    this.cloud.unRegisterListener(this.listener);
  }

  private clearJoinAckTimer() {
    if (this.joinAckTimer) {
      clearTimeout(this.joinAckTimer);
      this.joinAckTimer = undefined;
    }
  }

  private failPendingJoin(reason: Error) {
    this.clearJoinAckTimer();
    this.patch({ connection: "joinFailed", joined: false });
    this.enterReject?.(reason);
    this.clearEnterWaiters();
    void this.cloud.exitRoom().catch(() => {
      // Best-effort native cleanup after failed or timed-out join.
    });
  }

  private clearEnterWaiters(rejectReason?: Error) {
    if (rejectReason) {
      this.enterReject?.(rejectReason);
    }
    this.enterResolve = undefined;
    this.enterReject = undefined;
  }

  private handleListener(type: string, params: Record<string, unknown>) {
    if (this.disposed) {
      return;
    }
    switch (type) {
      case "onEnterRoom": {
        const result = Number(params.result ?? 0);
        if (result > 0) {
          this.clearJoinAckTimer();
          this.enterResolve?.();
          this.clearEnterWaiters();
        } else {
          this.failPendingJoin(new Error(`TRTC enterRoom failed: ${result}`));
        }
        return;
      }
      case "onExitRoom": {
        const reason = Number(params.reason ?? 0);
        const connection: RtcConnectionState = reason === 1 || reason === 2 ? "kicked" : "disconnected";
        this.patch({ joined: false, connection });
        this.exitResolve?.();
        this.exitResolve = undefined;
        return;
      }
      case "onTryToReconnect":
        this.patch({ connection: "reconnecting" });
        return;
      case "onConnectionLost":
        if (this.state.connection === "joining") {
          this.failPendingJoin(new Error("TRTC connection lost while joining"));
        } else {
          // Lost is disconnect truth; only onTryToReconnect means actively reconnecting.
          this.patch({ connection: "disconnected" });
        }
        return;
      case "onConnectionRecovery":
        this.patch({ connection: "connected" });
        return;
      case "onNetworkQuality":
        this.subscriptions.onNetwork?.(mapNetworkQuality(params.localQuality));
        return;
      case "onRemoteUserEnterRoom":
        if (typeof params.userId === "string") this.subscriptions.onRemoteUserEnter?.(params.userId);
        return;
      case "onRemoteUserLeaveRoom":
        if (typeof params.userId === "string") this.subscriptions.onRemoteUserLeave?.(params.userId);
        return;
      case "onUserAudioAvailable":
        if (typeof params.userId === "string") {
          this.subscriptions.onUserAudioAvailable?.(params.userId, Boolean(params.available ?? params.visible));
        }
        return;
      case "onUserVoiceVolume": {
        const userVolumes = Array.isArray(params.userVolumes) ? params.userVolumes : [];
        for (const item of userVolumes) {
          const row = item as { userId?: string; volume?: number };
          if (typeof row.userId === "string") {
            const volume = Number(row.volume ?? 0);
            if (row.userId === this.localUserId) {
              this.subscriptions.onLocalVoiceVolume?.(volume);
            } else {
              this.subscriptions.onUserVoiceVolume?.(row.userId, volume);
            }
          }
        }
        return;
      }
      default:
        return;
    }
  }

  private patch(partial: Partial<RtcState>) {
    this.state = { ...this.state, ...partial };
    this.subscriptions.onState?.(this.state);
  }
}
