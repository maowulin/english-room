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
  expect(rtc.getState().connection).toBe("reconnecting");
  emit("onConnectionRecovery");
  expect(rtc.getState().connection).toBe("connected");
  emit("onNetworkQuality", { localQuality: { quality: 4 } });
  expect(networks).toEqual(["bad"]);
});
