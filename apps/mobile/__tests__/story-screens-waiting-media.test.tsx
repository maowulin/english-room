import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { WaitingScreen, type MediaUiState } from "@/features/session/story-screens";

const realWaitingMedia: MediaUiState = {
  grant: "ready",
  mode: "real",
  network: "good",
  permission: "granted",
  recording: "idle",
  report: "waiting",
  rtc: "joined",
};

describe("WaitingScreen real media notice", () => {
  it.each([
    {
      rtc: "disconnected" as const,
      message: "Voice connection lost. Check your network and try again.",
      step: "TRTC: Disconnected",
    },
    {
      rtc: "kicked" as const,
      message: "You have left the voice room.",
      step: "TRTC: Removed from room",
    },
  ])("shows rtc=$rtc copy and retry voice connection", async ({ rtc, message, step }) => {
    const onReconnect = jest.fn();
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={{ ...realWaitingMedia, rtc }}
        members={[]}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onReconnectMedia={onReconnect}
        onStart={() => undefined}
      />,
    );

    expect(view.getByText(message)).toBeTruthy();
    expect(view.getByText(step)).toBeTruthy();
    fireEvent.press(view.getByLabelText("Retry voice connection"));
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps permission and grant messages ahead of disconnected rtc copy", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={{ ...realWaitingMedia, permission: "denied", rtc: "disconnected" }}
        members={[]}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onReconnectMedia={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(view.getByText("Microphone permission was denied. Enable it in Settings and try again.")).toBeTruthy();
    expect(view.queryByText("Voice connection lost. Check your network and try again.")).toBeNull();
  });

  it("keeps joinFailed message ahead of disconnected rtc copy", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={{ ...realWaitingMedia, rtc: "joinFailed" }}
        members={[]}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onReconnectMedia={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(view.getByText("Could not join the voice room. Use the button below to try again.")).toBeTruthy();
    expect(view.queryByText("Voice connection lost. Check your network and try again.")).toBeNull();
  });

  it("shows a quiet microphone listening state before any local voice callback", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={realWaitingMedia}
        members={[]}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(view.getByTestId("waiting-voice-feedback")).toBeTruthy();
    expect(view.getByText("Microphone is listening")).toBeTruthy();
    expect(view.getByText("Speak a sentence to test your input")).toBeTruthy();
    expect(view.queryByText("Voice detected")).toBeNull();
    expect(view.getAllByTestId(/waiting-voice-meter-bar-/).filter((bar) => StyleSheet.flatten(bar.props.style)?.backgroundColor === "#4AA879")).toHaveLength(0);
  });

  it("shows real local voice activity and level in the waiting feedback", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={{ ...realWaitingMedia, localVoiceActive: true, localVoiceLevel: 68 }}
        members={[]}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(view.getByText("Voice detected")).toBeTruthy();
    expect(view.getByText("TRTC is receiving your voice")).toBeTruthy();
    expect(view.getAllByTestId(/waiting-voice-meter-bar-/).filter((bar) => StyleSheet.flatten(bar.props.style)?.backgroundColor === "#4AA879")).toHaveLength(3);
  });
});
