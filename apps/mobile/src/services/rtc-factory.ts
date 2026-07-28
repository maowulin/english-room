import { NativeModules, Platform } from "react-native";

import { FakeRtcClient, resolveMediaMode, type MediaRuntimeMode, type RtcClient } from "@/services/rtc-client";
import { TrtcNativeClient, type TrtcCloudLike } from "@/services/trtc-native-client";

type TrtcModuleShape = {
  sharedInstance?: () => TrtcCloudLike;
  default?: { sharedInstance?: () => TrtcCloudLike };
  TRTCCloudDef?: {
    TRTC_APP_SCENE_AUDIOCALL: number;
    TRTC_AUDIO_QUALITY_SPEECH: number;
    TRTC_AUDIO_ROUTE_SPEAKER: number;
    TRTC_AUDIO_ROUTE_EARPIECE: number;
  };
  TRTCParams?: new (params: {
    sdkAppId: number;
    userId: string;
    userSig: string;
    roomId: number;
    strRoomId: string;
  }) => {
    sdkAppId: number;
    userId: string;
    userSig: string;
    roomId: number;
    strRoomId: string;
  };
};

function loadTrtcModule(): TrtcModuleShape | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("trtc-react-native") as TrtcModuleShape;
  } catch {
    return null;
  }
}

export function isTrtcNativeAvailable(): boolean {
  if (Platform.OS === "web") return false;
  const native = NativeModules as Record<string, unknown>;
  // Fail closed when the native bridge module is absent (Expo Go / missing prebuild).
  if (!native.TRTCReactNativeSdk && !native.TrtcReactNativeSdk) return false;
  return loadTrtcModule() !== null;
}

export function createRtcClient(mode: MediaRuntimeMode = resolveMediaMode(process.env, Platform.OS)): RtcClient {
  if (mode === "demo" || mode === "web") {
    return new FakeRtcClient();
  }
  const mod = loadTrtcModule();
  if (!mod || !isTrtcNativeAvailable()) {
    throw new Error(
      "Real voice mode requires the native TRTC module (trtc-react-native development build); unavailable in this environment, failing closed",
    );
  }
  const shared =
    typeof mod.sharedInstance === "function"
      ? mod.sharedInstance
      : mod.default && typeof mod.default.sharedInstance === "function"
        ? mod.default.sharedInstance.bind(mod.default)
        : undefined;
  const defs = mod.TRTCCloudDef;
  if (!shared || !defs) {
    throw new Error("Real voice mode TRTC SDK exports are incomplete; failing closed");
  }
  const cloud = shared();
  const Params = mod.TRTCParams;
  const wrapped: TrtcCloudLike = {
    registerListener: (listener) => cloud.registerListener(listener),
    unRegisterListener: (listener) => cloud.unRegisterListener(listener),
    enterRoom: async (params, scene) => {
      const payload = Params ? new Params(params) : params;
      await cloud.enterRoom(payload, scene);
    },
    exitRoom: () => cloud.exitRoom(),
    startLocalAudio: (quality) => cloud.startLocalAudio(quality),
    muteLocalAudio: (mute) => cloud.muteLocalAudio(mute),
    setAudioRoute: (route) => cloud.setAudioRoute(route),
    enableAudioVolumeEvaluation: (intervalMs) => cloud.enableAudioVolumeEvaluation(intervalMs),
  };
  return new TrtcNativeClient({
    cloud: wrapped,
    sceneAudioCall: defs.TRTC_APP_SCENE_AUDIOCALL,
    audioQualitySpeech: defs.TRTC_AUDIO_QUALITY_SPEECH,
    audioRouteSpeaker: defs.TRTC_AUDIO_ROUTE_SPEAKER,
    audioRouteEarpiece: defs.TRTC_AUDIO_ROUTE_EARPIECE,
  });
}
