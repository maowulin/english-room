import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import {
  LiveScreen,
  LobbyScreen,
  ReportScreen,
  WaitingScreen,
  type MediaUiState,
} from "@/features/session/story-screens";
import type { ReportItem } from "@/services/room-client";

/**
 * Dev/QA visual harness for 390×844 media-state screenshots.
 * Not part of the player product path. Enable via /qa-media?screen=&preset=
 */
const presets: Record<string, MediaUiState> = {
  "real-lobby": {
    mode: "real",
    network: "good",
    permission: "unknown",
    grant: "idle",
    rtc: "idle",
    recording: "idle",
    report: "waiting",
  },
  "real-perm-denied": {
    mode: "real",
    network: "good",
    permission: "denied",
    grant: "idle",
    rtc: "idle",
    recording: "idle",
    report: "waiting",
  },
  "real-grant-loading": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "loading",
    rtc: "joining",
    recording: "idle",
    report: "waiting",
  },
  "real-grant-failed": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "failed",
    rtc: "idle",
    recording: "idle",
    report: "waiting",
  },
  "real-joining": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "ready",
    rtc: "joining",
    recording: "idle",
    report: "waiting",
  },
  "real-joined": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "ready",
    rtc: "joined",
    recording: "idle",
    report: "waiting",
  },
  "real-reconnecting": {
    mode: "real",
    network: "weak",
    permission: "granted",
    grant: "ready",
    rtc: "reconnecting",
    recording: "idle",
    report: "waiting",
  },
  "real-weak": {
    mode: "real",
    network: "weak",
    permission: "granted",
    grant: "ready",
    rtc: "joined",
    recording: "idle",
    report: "waiting",
  },
  "real-bad": {
    mode: "real",
    network: "bad",
    permission: "granted",
    grant: "ready",
    rtc: "joined",
    recording: "idle",
    report: "waiting",
  },
  "real-kicked": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "ready",
    rtc: "kicked",
    recording: "idle",
    report: "waiting",
  },
  "real-disconnected": {
    mode: "real",
    network: "bad",
    permission: "granted",
    grant: "ready",
    rtc: "disconnected",
    recording: "idle",
    report: "waiting",
  },
  "real-join-failed": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "ready",
    rtc: "joinFailed",
    recording: "idle",
    report: "waiting",
  },
  "real-recording-failed": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "ready",
    rtc: "joined",
    recording: "failed",
    report: "failed",
  },
  "real-report-processing": {
    mode: "real",
    network: "good",
    permission: "granted",
    grant: "ready",
    rtc: "joined",
    recording: "processing",
    report: "processing",
  },
};

const sampleReports: ReportItem[] = [
  {
    playerName: "Mint",
    scoreJobId: "score-1",
    status: "failed",
  },
  {
    playerName: "Mia",
    scoreJobId: "score-2",
    status: "processing",
  },
];

export default function QaMediaScreen() {
  const params = useLocalSearchParams<{ screen?: string; preset?: string }>();
  const screen = String(params.screen ?? "lobby");
  const preset = String(params.preset ?? "real-lobby");
  const mediaState = presets[preset] ?? presets["real-lobby"];
  const noop = () => undefined;

  if (screen === "waiting") {
    return (
      <WaitingScreen
        busy={false}
        mediaState={mediaState}
        onLeave={noop}
        onReady={noop}
        onStart={noop}
        ready={mediaState.rtc === "joined"}
        roomCode="ABCD12"
      />
    );
  }
  if (screen === "live") {
    return <LiveScreen busy={false} mediaState={mediaState} muted={false} onEnd={noop} speakerOn />;
  }
  if (screen === "report") {
    return (
      <ReportScreen
        items={sampleReports}
        mediaState={mediaState}
        onDone={noop}
        onRetry={noop}
      />
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <LobbyScreen busy={false} mediaState={mediaState} onCreate={noop} onJoin={noop} />
    </View>
  );
}
