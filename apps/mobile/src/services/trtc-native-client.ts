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
};

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
  private readonly listener: TrtcListener;
  private subscriptions: RtcSubscriptions = {};
  private enterResolve: (() => void) | undefined;
  private enterReject: ((error: Error) => void) | undefined;
  private exitResolve: (() => void) | undefined;
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
    this.listener = (type, params) => this.handleListener(type, params);
    this.cloud.registerListener(this.listener);
  }

  async join(input: RtcGrantCredentials | { roomId: string; userId: string }): Promise<void> {
    if (!isGrant(input)) {
      throw new Error("真实语音入房需要 Backend RTC grant（含 str_room_id / user_sig）");
    }
    this.patch({ connection: "joining", joined: false });
    const entered = new Promise<void>((resolve, reject) => {
      this.enterResolve = resolve;
      this.enterReject = reject;
    });
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
    await entered;
    await this.cloud.startLocalAudio(this.audioQualitySpeech);
    await this.cloud.setAudioRoute(this.audioRouteSpeaker);
    await this.cloud.enableAudioVolumeEvaluation(this.volumeIntervalMs);
    this.patch({ joined: true, connection: "connected", speakerOn: true, muted: false });
  }

  async leave(): Promise<void> {
    const waiting = new Promise<void>((resolve) => {
      this.exitResolve = resolve;
    });
    await this.cloud.exitRoom();
    await waiting;
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
    this.cloud.unRegisterListener(this.listener);
  }

  private handleListener(type: string, params: Record<string, unknown>) {
    switch (type) {
      case "onEnterRoom": {
        const result = Number(params.result ?? 0);
        if (result > 0) {
          this.enterResolve?.();
          this.enterResolve = undefined;
          this.enterReject = undefined;
        } else {
          this.patch({ connection: "joinFailed", joined: false });
          this.enterReject?.(new Error(`TRTC enterRoom failed: ${result}`));
          this.enterResolve = undefined;
          this.enterReject = undefined;
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
      case "onConnectionLost":
        this.patch({ connection: "reconnecting" });
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
            this.subscriptions.onUserVoiceVolume?.(row.userId, Number(row.volume ?? 0));
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
