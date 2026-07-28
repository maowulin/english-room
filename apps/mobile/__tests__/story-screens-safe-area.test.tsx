import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthScreen } from "@/features/session/auth-screen";
import {
  LiveScreen,
  LobbyScreen,
  ReportScreen,
  WaitingScreen,
  demoMediaUiState,
} from "@/features/session/story-screens";

describe("story screen safe area layout", () => {
  afterEach(() => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("offsets waiting footer and scroll padding by bottom safe area inset", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 48, left: 0 });
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={demoMediaUiState}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );

    const footer = view.getByTestId("waiting-footer");
    const footerStyle = StyleSheet.flatten(footer.props.style);
    expect(footerStyle?.bottom).toBe(48);

    const scroll = view.getByTestId("waiting-scroll");
    const scrollStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(scrollStyle?.paddingBottom).toBe(158);
  });

  it("keeps the lobby content scrollable above the bottom tabs", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 34, left: 0 });
    const view = await render(
      <LobbyScreen
        mediaState={demoMediaUiState}
        onCreate={() => undefined}
        onJoin={() => undefined}
      />,
    );

    const scroll = view.getByTestId("lobby-scroll");
    const scrollStyle = StyleSheet.flatten(scroll.props.style);
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(scrollStyle?.flex).toBe(1);
    expect(contentStyle?.paddingBottom).toBeGreaterThan(80);
    expect(view.getByTestId("lobby-bottom-tabs")).toBeTruthy();
  });

  it("keeps the report return action above the iOS home indicator", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 34, left: 0 });
    const view = await render(
      <ReportScreen
        items={[]}
        mediaState={demoMediaUiState}
        onDone={() => undefined}
        onRetry={() => undefined}
      />,
    );

    const scroll = view.getByTestId("report-scroll");
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(contentStyle?.paddingBottom).toBeGreaterThan(34);
  });

  it("lets the live content scroll while controls stay reachable on short screens", async () => {
    const view = await render(<LiveScreen mediaState={demoMediaUiState} onEnd={() => undefined} />);

    const scroll = view.getByTestId("live-scroll");
    expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flex: 1 });
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ paddingBottom: expect.any(Number) });
    expect(view.getByTestId("live-controls")).toBeTruthy();
  });

  it("keeps the auth form scrollable above the bottom safe area", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 34, left: 0 });
    const view = await render(<AuthScreen mode="register" onLogin={() => undefined} onToggle={() => undefined} />);

    const scroll = view.getByTestId("auth-content");
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(contentStyle).toMatchObject({ flexGrow: 1, paddingBottom: 44 });
  });

  it("adds bottom safe area inset to live screen controls container", async () => {
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 34, left: 0 });
    const view = await render(<LiveScreen mediaState={demoMediaUiState} onEnd={() => undefined} />);

    const root = view.getByTestId("live-screen-root");
    const rootStyle = StyleSheet.flatten(root.props.style);
    expect(rootStyle?.paddingBottom).toBe(44);
  });

  it("keeps the lobby story card and actions at the design scale", async () => {
    const view = await render(
      <LobbyScreen
        mediaState={demoMediaUiState}
        onCreate={() => undefined}
        onJoin={() => undefined}
      />,
    );

    const cardStyle = StyleSheet.flatten(view.getByTestId("lobby-story-card").props.style);
    const primaryStyle = StyleSheet.flatten(view.getByTestId("join-room-button").props.style);
    const createStyle = StyleSheet.flatten(view.getByTestId("create-room-button").props.style);

    expect(cardStyle?.height).toBe(316);
    expect(primaryStyle?.height).toBe(56);
    expect(createStyle?.height).toBe(52);
  });

  it("keeps waiting-room artwork and seats at the design scale", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={demoMediaUiState}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );

    const bannerStyle = StyleSheet.flatten(view.getByTestId("waiting-story-banner").props.style);
    const seatStyle = StyleSheet.flatten(view.getByTestId("waiting-seat-0").props.style);

    expect(bannerStyle?.height).toBe(105);
    expect(seatStyle?.height).toBe(110);
  });

  it("renders a six-person room with only the local player and allows solo start", async () => {
    const onStart = jest.fn();
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={demoMediaUiState}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={onStart}
      />,
    );

    expect(view.getByText(/Players 1 \/ 6/)).toBeTruthy();
    expect(view.getByText("You")).toBeTruthy();
    expect(view.queryByText("Mia")).toBeNull();
    expect(view.queryByText("Alex")).toBeNull();
    expect(view.queryByText("Suki")).toBeNull();
    expect(view.getByTestId("waiting-seat-5")).toBeTruthy();
    expect(view.getByTestId("start-room-button")).toBeDisabled();

    await act(async () => {
      view.rerender(
        <WaitingScreen
          busy={false}
          mediaState={demoMediaUiState}
          ready
          onLeave={() => undefined}
          onReady={() => undefined}
          onStart={onStart}
        />,
      );
    });

    expect(view.getByTestId("start-room-button")).toBeEnabled();
  });

  it("keeps the waiting title on one line and scales it before it reaches the rule", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={demoMediaUiState}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );

    const title = view.getByTestId("waiting-title");
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBeGreaterThanOrEqual(0.78);
    expect(StyleSheet.flatten(title.props.style)?.fontSize).toBeLessThanOrEqual(30);
  });

  it("keeps seat avatars clear and seat states single-line", async () => {
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={demoMediaUiState}
        ready
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(view.queryByTestId("waiting-seat-mic-0")).toBeNull();
    const state = view.getByTestId("waiting-seat-state-2");
    expect(state.props.numberOfLines).toBe(1);
    expect(state.props.ellipsizeMode).toBe("tail");
    expect(StyleSheet.flatten(view.getByTestId("waiting-seat-state-0").props.style)?.backgroundColor).toBeUndefined();
  });

  it("keeps the waiting banner copy inside its card and gives live signal labels a readable color", async () => {
    const waiting = await render(
      <WaitingScreen
        busy={false}
        mediaState={demoMediaUiState}
        ready={false}
        onLeave={() => undefined}
        onReady={() => undefined}
        onStart={() => undefined}
      />,
    );
    const bannerText = waiting.getByTestId("waiting-banner-text");
    expect(bannerText.props.numberOfLines).toBe(2);
    expect(StyleSheet.flatten(bannerText.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0 });

    const live = await render(<LiveScreen mediaState={demoMediaUiState} onEnd={() => undefined} />);
    expect(StyleSheet.flatten(live.getByTestId("live-signal-0").props.style)?.color).toBe("#D8E5DB");
  });

  it("keeps live-room portraits and controls prominent", async () => {
    const view = await render(<LiveScreen mediaState={demoMediaUiState} onEnd={() => undefined} />);

    const avatarStyle = StyleSheet.flatten(view.getByTestId("live-player-avatar-0").props.style);
    const controlsStyle = StyleSheet.flatten(view.getByTestId("live-controls").props.style);

    expect(avatarStyle?.height).toBe(112);
    expect(avatarStyle?.width).toBe(112);
    expect(controlsStyle?.minHeight).toBe(112);
  });

  it("keeps the report score hero aligned with the reference card", async () => {
    const view = await render(
      <ReportScreen
        items={[{
          playerName: "Liam",
          scoreJobId: "score-1",
          status: "completed",
          score: 86,
          pronunciation: 88,
          fluency: 82,
        }]}
        mediaState={demoMediaUiState}
        onDone={() => undefined}
        onRetry={() => undefined}
      />,
    );

    const cardStyle = StyleSheet.flatten(view.getByTestId("report-score-card").props.style);
    const tipContentStyle = StyleSheet.flatten(view.getByTestId("report-tip-content").props.style);
    expect(cardStyle?.minHeight).toBe(156);
    expect(tipContentStyle).toMatchObject({ flex: 1, minWidth: 0 });
    expect(view.getByTestId("report-story-thumbnail").props.resizeMode).toBe("cover");
    expect(view.getByTestId("report-metric-Completeness").props.children).toBe("—");
    expect(view.getByTestId("report-metric-Vocabulary").props.children).toBe("—");
  });
});
