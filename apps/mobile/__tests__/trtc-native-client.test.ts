import { TrtcNativeClient, type TrtcCloudLike, type TrtcListener } from "@/services/trtc-native-client";
import type { RtcGrantCredentials } from "@/services/rtc-client";

function grant(overrides: Partial<RtcGrantCredentials> = {}): RtcGrantCredentials {
  return {
    roomId: "room_1",
    strRoomId: "room_1",
    playerId: "player_1",
    trtcUserId: "u_abc",
    sdkAppId: 1400777777,
    userSig: "demo-fake-usersig",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    ttlSeconds: 600,
    ...overrides,
  };
}

function createCloud() {
  let listener: TrtcListener | undefined;
  const calls: string[] = [];
  const cloud: TrtcCloudLike = {
    registerListener(next) {
      listener = next;
      calls.push("registerListener");
    },
    unRegisterListener() {
      listener = undefined;
      calls.push("unRegisterListener");
    },
    async enterRoom(params, scene) {
      calls.push(`enterRoom:${params.roomId}:${params.strRoomId}:${params.userId}:${scene}`);
    },
    async exitRoom() {
      calls.push("exitRoom");
    },
    async startLocalAudio(quality) {
      calls.push(`startLocalAudio:${quality}`);
    },
    async muteLocalAudio(mute) {
      calls.push(`muteLocalAudio:${mute}`);
    },
    async setAudioRoute(route) {
      calls.push(`setAudioRoute:${route}`);
    },
    async enableAudioVolumeEvaluation(intervalMs) {
      calls.push(`enableAudioVolumeEvaluation:${intervalMs}`);
    },
  };
  return {
    cloud,
    calls,
    getListener: () => listener,
    emit(type: string, params: Record<string, unknown> = {}) {
      listener?.(type, params);
    },
  };
}

it("joins only after onEnterRoom.result > 0 using roomId=0 and Backend strRoomId", async () => {
  const { cloud, calls, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });

  const joining = rtc.join(grant());
  expect(rtc.getState().joined).toBe(false);
  expect(calls.some((item) => item.startsWith("enterRoom:0:room_1:u_abc:"))).toBe(true);

  emit("onEnterRoom", { result: 120 });
  await joining;

  expect(rtc.getState()).toMatchObject({ joined: true, connection: "connected" });
  expect(calls).toContain("startLocalAudio:1");
});

it("maps onExitRoom reason=1 to kicked and waits for onExitRoom before leave resolves", async () => {
  const { cloud, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });

  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 10 });
  await joining;

  const leaving = rtc.leave();
  expect(rtc.getState().joined).toBe(true);
  emit("onExitRoom", { reason: 1 });
  await leaving;

  expect(rtc.getState()).toMatchObject({ joined: false, connection: "kicked" });
});

it("mutes via muteLocalAudio and routes speaker without optimistic success", async () => {
  const { cloud, calls, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await joining;

  await rtc.setMuted(true);
  await rtc.setSpeaker(false);

  expect(calls).toContain("muteLocalAudio:true");
  expect(calls).toContain("setAudioRoute:1");
  expect(rtc.getState()).toMatchObject({ muted: true, speakerOn: false });
});

it("maps reconnect and network events orthogonally", async () => {
  const { cloud, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  const networks: string[] = [];
  rtc.subscribe({ onNetwork: (quality) => networks.push(quality) });

  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await joining;

  emit("onTryToReconnect");
  expect(rtc.getState()).toMatchObject({ connection: "reconnecting", joined: true });
  emit("onConnectionRecovery");
  expect(rtc.getState().connection).toBe("connected");
  emit("onConnectionLost");
  expect(rtc.getState()).toMatchObject({ connection: "disconnected", joined: true });
  emit("onNetworkQuality", { localQuality: { quality: 4 } });
  expect(networks).toEqual(["bad"]);
});

it("routes local TRTC volume to the local voice callback and remotes separately", async () => {
  const { cloud, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  const localVolumes: number[] = [];
  const remoteVolumes: Array<[string, number]> = [];
  rtc.subscribe({
    onLocalVoiceVolume: (volume) => localVolumes.push(volume),
    onUserVoiceVolume: (userId, volume) => remoteVolumes.push([userId, volume]),
  });

  const joining = rtc.join(grant({ trtcUserId: "u_local" }));
  emit("onEnterRoom", { result: 1 });
  await joining;

  emit("onUserVoiceVolume", { userVolumes: [{ userId: "u_local", volume: 42 }, { userId: "u_remote", volume: 27 }] });

  expect(localVolumes).toEqual([42]);
  expect(remoteVolumes).toEqual([["u_remote", 27]]);
});

it("rejects reentrant join and cleans ACK reject into joinFailed", async () => {
  const { cloud, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });

  const first = rtc.join(grant());
  await expect(rtc.join(grant())).rejects.toThrow(/join is already in progress|Already in a room/);
  emit("onEnterRoom", { result: 1 });
  await first;

  await expect(rtc.join(grant())).rejects.toThrow(/Already in a room/);

  const { cloud: cloud2, emit: emit2 } = createCloud();
  cloud2.enterRoom = async () => {
    throw new Error("enterRoom ACK rejected");
  };
  const rtc2 = new TrtcNativeClient({
    cloud: cloud2,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  await expect(rtc2.join(grant())).rejects.toThrow(/enterRoom ACK rejected/);
  expect(rtc2.getState()).toMatchObject({ connection: "joinFailed", joined: false });
  void emit2;
});

it("rejects join when startLocalAudio fails after onEnterRoom and allows re-join after rollback", async () => {
  const { cloud, emit, calls } = createCloud();
  cloud.startLocalAudio = async (quality) => {
    calls.push(`startLocalAudio:${quality}`);
    throw new Error("startLocalAudio failed");
  };
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });

  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await expect(joining).rejects.toThrow(/startLocalAudio failed/);
  expect(rtc.getState().connection).not.toBe("joining");
  expect(rtc.getState().joined).toBe(false);

  cloud.startLocalAudio = async (quality) => {
    calls.push(`startLocalAudio:${quality}`);
  };
  const second = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await second;
  expect(rtc.getState()).toMatchObject({ joined: true, connection: "connected" });
});

it("rejects pending join when dispose is called while waiting for onEnterRoom", async () => {
  const { cloud } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });

  const joining = rtc.join(grant());
  rtc.dispose();
  await expect(joining).rejects.toThrow(/disposed|cancel/i);
});

it("shares in-flight leave and blocks join until leave settles", async () => {
  const { cloud, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await joining;

  const leaveA = rtc.leave();
  const leaveB = rtc.leave();
  await expect(rtc.join(grant())).rejects.toThrow(/Leaving the room is in progress/);
  emit("onExitRoom", { reason: 0 });
  await Promise.all([leaveA, leaveB]);
  expect(rtc.getState()).toMatchObject({ joined: false, connection: "disconnected" });
});

it("ignores late listener callbacks after dispose and rejects join", async () => {
  const { cloud, emit, getListener } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await joining;

  const lateListener = getListener();
  rtc.dispose();
  expect(rtc.getState()).toMatchObject({ joined: false, connection: "disconnected" });

  lateListener?.("onEnterRoom", { result: 99 });
  lateListener?.("onConnectionRecovery", {});
  lateListener?.("onTryToReconnect", {});
  lateListener?.("onExitRoom", { reason: 0 });
  expect(rtc.getState()).toMatchObject({ joined: false, connection: "disconnected" });

  await expect(rtc.join(grant())).rejects.toThrow(/disposed|dispose/i);
});

it("rejects join when onEnterRoom ack times out, cleans state, and allows retry", async () => {
  jest.useFakeTimers();
  const { cloud, calls, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
    joinAckTimeoutMs: 50,
  });

  const joining = rtc.join(grant());
  await Promise.resolve();
  jest.advanceTimersByTime(50);

  await expect(joining).rejects.toThrow(/enterRoom ack timeout/i);
  expect(rtc.getState()).toMatchObject({ connection: "joinFailed", joined: false });
  expect(calls).toContain("exitRoom");

  const second = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await second;
  expect(rtc.getState()).toMatchObject({ joined: true, connection: "connected" });
  jest.useRealTimers();
});

it("fails join on connection lost while waiting for onEnterRoom", async () => {
  const { cloud, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
    joinAckTimeoutMs: 30_000,
  });

  const joining = rtc.join(grant());
  emit("onConnectionLost", {});
  await expect(joining).rejects.toThrow(/connection lost while joining/i);
  expect(rtc.getState()).toMatchObject({ connection: "joinFailed", joined: false });
});

it("best-effort exitRoom on dispose when connected without waiting for onExitRoom", async () => {
  const { cloud, calls, emit } = createCloud();
  const rtc = new TrtcNativeClient({
    cloud,
    sceneAudioCall: 2,
    audioQualitySpeech: 1,
    audioRouteSpeaker: 0,
    audioRouteEarpiece: 1,
  });
  const joining = rtc.join(grant());
  emit("onEnterRoom", { result: 1 });
  await joining;
  expect(rtc.getState()).toMatchObject({ joined: true, connection: "connected" });

  rtc.dispose();

  expect(calls).toContain("exitRoom");
  expect(calls).toContain("unRegisterListener");
  expect(rtc.getState()).toMatchObject({ joined: false, connection: "disconnected" });
});
