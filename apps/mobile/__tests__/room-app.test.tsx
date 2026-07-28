import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Platform, StyleSheet, View } from "react-native";

import HomeScreen, { RoomApp } from "@/app/index";
import { createRandomGuestName } from "@/features/session/auth-screen";
import { demoMediaUiState, LiveScreen, ReportLoadingScreen, ReportScreen, WaitingScreen, type MediaUiState } from "@/features/session/story-screens";
import { FakeRoomClient, type ReportItem } from "@/services/room-client";

describe("RoomApp", () => {
  afterEach(cleanup);

  const renderFake = async () => render(<RoomApp client={new FakeRoomClient()} />);
  type RoomView = Awaited<ReturnType<typeof render>>;

  const realMediaState = {
    grant: "ready",
    mode: "real",
    network: "good",
    permission: "granted",
    recording: "ready",
    report: "ready",
    rtc: "joined",
  } satisfies MediaUiState;

  const renderReal = async (
    mediaState: Partial<MediaUiState> = {},
  ) => render(<RoomApp client={new FakeRoomClient()} mediaState={{ ...realMediaState, ...mediaState }} />);
  const renderRealLive = async (mediaState: Partial<MediaUiState> = {}) => render(<LiveScreen mediaState={{ ...realMediaState, ...mediaState }} onEnd={() => undefined} />);
  const completedReports: ReportItem[] = [
    { fluency: 89, playerName: "Mint", pronunciation: 91, score: 90, scoreJobId: "score-1", status: "completed" },
    { fluency: 87, playerName: "Mia", pronunciation: 88, score: 88, scoreJobId: "score-2", status: "completed" },
  ];

  const moveToWaiting = async (view: RoomView) => {
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
  };

  const moveToLive = async (view: RoomView) => {
    await moveToWaiting(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    expect(await view.findByText("In progress")).toBeTruthy();
  };

  const moveToReadyWaiting = async (view: RoomView) => {
    await moveToWaiting(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
  };

  it("generates human-readable English guest names instead of player IDs", () => {
    expect(createRandomGuestName(() => 0)).toBe("Avery");
    expect(createRandomGuestName(() => 0.999)).toBe("Quinn");
    expect(createRandomGuestName(() => 0.5)).toMatch(/^[A-Za-z]+$/);
  });

  it("takes a guest from login to lobby and created waiting room", async () => {
    const view = await renderFake();

    await act(async () => {
      fireEvent.changeText(view.getByTestId("nickname-input"), "Mint");
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("create-room-button"));
    });
    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(view.getByText(/Players 1 \/ 6/)).toBeTruthy();
    expect(view.queryByText("Mia")).toBeNull();
    expect(view.queryByText("Alex")).toBeNull();
    expect(view.queryByText("Suki")).toBeNull();
    expect(view.queryByText(/Demo|Fake/i)).toBeNull();
    expect(view.queryByText("ROOM DEMO")).toBeNull();
    expect(view.queryByText("MINT")).toBeNull();
  });

  it("renders the designed auth controls while keeping Demo guest submission", async () => {
    const view = await renderFake();

    expect(view.getByText("Welcome back")).toBeTruthy();
    expect(view.getByLabelText("Email")).toBeTruthy();
    expect(view.getByLabelText("Password")).toBeTruthy();
    expect(view.getByLabelText("Sign in with Apple")).toBeTruthy();
    expect(view.getByLabelText("Sign in with WeChat")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByLabelText("Show password"));
    });
    expect(view.getByLabelText("Hide password")).toBeTruthy();
  });

  it("keeps the 390px login rhythm compact enough for social actions and the footer", async () => {
    const view = await renderFake();

    expect(StyleSheet.flatten(view.getByTestId("auth-content").props.contentContainerStyle)).toMatchObject({
      paddingBottom: 10,
      paddingHorizontal: 20,
      paddingTop: 32,
    });
    expect(StyleSheet.flatten(view.getByTestId("auth-title").props.style)).toMatchObject({
      lineHeight: 42,
      marginTop: 20,
    });
    expect(StyleSheet.flatten(view.getByTestId("auth-cover").props.style)).toMatchObject({
      marginTop: 13,
    });
    expect(StyleSheet.flatten(view.getByTestId("email-input-row").props.style)).toMatchObject({
      height: 50,
    });
    expect(StyleSheet.flatten(view.getByTestId("account-login-button").props.style)).toMatchObject({
      height: 46,
      marginTop: 7,
    });
    expect(StyleSheet.flatten(view.getByTestId("demo-guest-button").props.style)).toMatchObject({
      height: 48,
      marginTop: 8,
    });
    expect(view.getByTestId("demo-guest-button").props.hitSlop).toBe(10);
    expect(StyleSheet.flatten(view.getByTestId("auth-social-row").props.style)).toMatchObject({
      marginTop: 1,
    });
    expect(StyleSheet.flatten(view.getByTestId("auth-footer").props.style)).toMatchObject({
      marginTop: 16,
    });
  });

  it("renders the brand without exposing the source artwork rectangle", async () => {
    const view = await renderFake();

    expect(StyleSheet.flatten(view.getByTestId("auth-brand").props.style)).toMatchObject({
      height: 46,
      width: 180,
    });
    expect(StyleSheet.flatten(view.getByTestId("auth-brand").props.style)?.backgroundColor).toBeUndefined();
    expect(view.getByTestId("auth-brand-wordmark")).toHaveTextContent("English Room");
  });

  it("enters the lobby through the Demo guest shortcut without credentials", async () => {
    const view = await renderFake();

    expect(view.getByLabelText("Demo guest entry")).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByLabelText("Demo guest entry"));
    });

    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();
  });

  it("keeps an injected fake room client isolated from the network", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("unexpected network");
    });
    try {
      const view = await render(<RoomApp client={new FakeRoomClient()} />);
      await act(async () => {
        fireEvent.press(view.getByTestId("demo-guest-button"));
      });
      await act(async () => {
        fireEvent.press(await view.findByTestId("create-room-button"));
      });

      expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
      fetchSpy.mockRestore();
    }
  });

  it("does not turn account login into a guest session", async () => {
    const client = new FakeRoomClient();
    const createGuestSession = jest.spyOn(client, "createGuestSession");
    const view = await render(<RoomApp client={client} />);

    await act(async () => {
      fireEvent.press(view.getByTestId("account-login-button"));
    });

    expect(view.getByText("Account sign-in is not available yet.")).toBeTruthy();
    expect(createGuestSession).not.toHaveBeenCalled();
    expect(view.getByText("Welcome back")).toBeTruthy();
  });

  it("joins an existing room by code instead of creating another", async () => {
    const client = new FakeRoomClient();
    const host = await client.createGuestSession({ nickname: "Host" });
    const created = await client.createRoom({ title: "Harbor Mystery" });
    await client.joinRoom(created.id, { playerId: host.playerId });
    const membersBefore = (await client.getRoomByCode(created.code)).members.length;

    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(view.getByTestId("room-code-input"), created.code);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("submit-room-code-button"));
    });

    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(view.getByText(new RegExp(created.code))).toBeTruthy();
    const membersAfter = (await client.getRoomByCode(created.code)).members.length;
    expect(membersAfter).toBe(membersBefore + 1);
  });

  it("calls joinRoom once when joining by room code", async () => {
    const client = new FakeRoomClient();
    const host = await client.createGuestSession({ nickname: "Host" });
    const created = await client.createRoom({ title: "Harbor Mystery" });
    await client.joinRoom(created.id, { playerId: host.playerId });

    const joinRoomSpy = jest.spyOn(client, "joinRoom");

    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId("room-code-input"), created.code);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("submit-room-code-button"));
    });

    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(joinRoomSpy).toHaveBeenCalledTimes(1);
    joinRoomSpy.mockRestore();
  });

  it("lets a ready guest start and end the voice room", async () => {
    const view = await renderFake();

    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    expect(await view.findByText("In progress")).toBeTruthy();
    expect(view.queryByLabelText("Demo control panel")).toBeNull();

    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });
    expect(await view.findByText("Speaking report")).toBeTruthy();
    expect(view.queryByText("Ava")).toBeNull();
    expect(view.queryByText("Noah")).toBeNull();
    expect(view.queryByText("Luna")).toBeNull();
  });

  it("keeps registration focused on account creation", async () => {
    const view = await renderFake();

    await act(async () => {
      fireEvent.press(view.getByLabelText("Go to sign up"));
    });
    expect((await view.findAllByText("Create account")).length).toBeGreaterThan(0);
    expect(view.queryByText(/Demo|Fake/i)).toBeNull();
    expect(view.queryByText("Send verification code")).toBeNull();
  });

  it("renders registration progress as native English content", async () => {
    const view = await renderFake();

    await act(async () => {
      fireEvent.press(view.getByLabelText("Go to sign up"));
    });

    expect(await view.findByTestId("register-steps")).toBeTruthy();
    expect(view.getByText("Account")).toBeTruthy();
    expect(view.getByText("Profile")).toBeTruthy();
    expect(view.getByText("Done")).toBeTruthy();
  });

  it("does not expose a demo-only reconnect control on the live screen", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    expect(view.queryByText("Mia")).toBeNull();
    expect(view.queryByText("Alex")).toBeNull();
    expect(view.queryByText("Suki")).toBeNull();
    expect(view.getByText("This device · Good")).toBeTruthy();
    expect(view.queryByTestId("reconnect-button")).toBeNull();
    expect(view.queryByLabelText("Trigger reconnect")).toBeNull();
  });

  it("keeps the lobby tab bar and report exit control reachable", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    expect(await view.findByTestId("lobby-bottom-tabs")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });
    expect(await view.findByLabelText("Back to lobby")).toBeTruthy();
  });

  it("disables join when room code is empty", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();
    expect(view.getByLabelText("Empty room code hint")).toBeTruthy();
    expect(view.getByTestId("join-room-button")).toBeDisabled();
    expect(view.getByTestId("submit-room-code-button")).toBeDisabled();
  });

  it("disables the guest button and shows a loading label while auth is in flight", async () => {
    const client = new FakeRoomClient();
    let releaseSession: ((value: { playerId: string; nickname: string }) => void) | undefined;
    client.createGuestSession = () =>
      new Promise((resolve) => {
        releaseSession = resolve;
      });
    const view = await render(<RoomApp client={client} />);

    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    expect(view.getByText("Entering…")).toBeTruthy();
    expect(view.getByTestId("demo-guest-button")).toBeDisabled();

    await act(async () => {
      releaseSession?.({ playerId: "guest-1", nickname: "Mint" });
    });
    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();
  });

  it("stays in the lobby and shows an error when create fails, without fake fallback", async () => {
    const client = new FakeRoomClient();
    client.createRoom = async () => {
      throw new Error("API request failed (HTTP 500)");
    };
    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();
    expect(view.getByLabelText("API error")).toBeTruthy();
    expect(view.getByText("We couldn't complete that action. Please try again.")).toBeTruthy();
    expect(view.queryByText(/HTTP 500/)).toBeNull();
    expect(view.queryByText("Waiting for everyone to take a seat")).toBeNull();
    expect(view.queryByLabelText("Development fallback")).toBeNull();
  });

  it("explains that a guest session must be renewed when joining returns HTTP 401", async () => {
    const client = new FakeRoomClient();
    client.getRoomByCode = async () => {
      const error = Object.assign(new Error("API request failed (HTTP 401)"), { status: 401 });
      throw error;
    };
    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId("room-code-input"), "8C0A7E");
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("submit-room-code-button"));
    });
    expect(await view.findByText("Your guest session expired. Please enter as a Demo guest again.")).toBeTruthy();
    expect(view.queryByText("Waiting for everyone to take a seat")).toBeNull();
  });

  it("keeps the waiting screen when start fails instead of optimistic live jump", async () => {
    const client = new FakeRoomClient();
    client.startRoom = async () => {
      throw new Error("API request failed (HTTP 409)");
    };
    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(view.getByLabelText("API error")).toBeTruthy();
    expect(view.getByText("This room changed while you were here. Please try again.")).toBeTruthy();
    expect(view.queryByText(/HTTP 409/)).toBeNull();
    expect(view.queryByText("In progress")).toBeNull();
  });

  it("separates real media labels and shows denied microphone permission before start", async () => {
    const view = await renderReal({ grant: "idle", permission: "denied", rtc: "idle" });

    await moveToWaiting(view);

    expect(view.getByText("Microphone permission was denied. Enable it in Settings and try again.")).toBeTruthy();
    expect(view.queryByText(/Demo|Fake/i)).toBeNull();
  });

  it("uses Ready as the only waiting-page media action", async () => {
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

    expect(view.getByLabelText("Ready")).toBeTruthy();
    expect(view.queryByText("Test microphone")).toBeNull();
  });

  it("does not expose media implementation labels in the lobby", async () => {
    const view = await renderReal();

    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });

    expect(await view.findByText("What would you like to practice tonight?")).toBeTruthy();
    expect(view.queryByText(/Demo|Fake|Real voice mode|TRTC|SOE/i)).toBeNull();
    expect(view.queryByText("ROOM DEMO")).toBeNull();
    expect(view.getByText("ROOM LIVE")).toBeTruthy();
  });

  it("uses the product room label for guest lobby", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    expect(await view.findByText("ROOM LIVE")).toBeTruthy();
    expect(view.queryByText("ROOM DEMO")).toBeNull();
    expect(view.getByText("1 player")).toBeTruthy();
    expect(view.getByText("5 open seats")).toBeTruthy();
  });

  it.each([
    { grant: "idle", permission: "denied", rtc: "idle" },
    { grant: "loading", rtc: "joining" },
    { rtc: "joining" },
    { rtc: "reconnecting" },
  ] satisfies Array<Partial<MediaUiState>>)("keeps real start disabled until media is ready %#", async (mediaState) => {
    const view = await renderReal(mediaState);

    await moveToReadyWaiting(view);

    expect(view.getByTestId("start-room-button")).toBeDisabled();
  });

  it.each([
    [{ grant: "loading", rtc: "joining" }, "Getting voice token", "Joining the voice room"],
    [{ rtc: "reconnecting" }, "Reconnecting", "Others may not hear you for a moment"],
    [{ network: "weak", rtc: "joined" }, "Voice in progress", "Weak network. Move closer to Wi-Fi"],
    [{ rtc: "kicked" }, "You left the voice room", "Return to the room to join again"],
    [{ rtc: "disconnected" }, "Voice connection lost", "Check your network and try again"],
    [{ rtc: "joinFailed" }, "Could not join the voice room", "Try again in a moment"],
  ] satisfies Array<[Partial<MediaUiState>, string, string]>)("renders real live media state %# without leaking demo copy", async (mediaState, primary, secondary) => {
    const view = await renderRealLive(mediaState);

    expect(view.queryByText("Real voice mode · TRTC")).toBeNull();
    expect(view.queryByText("Demo / Fake RTC · non-production voice")).toBeNull();
    expect(view.getByText(primary)).toBeTruthy();
    expect(view.getByText(secondary)).toBeTruthy();
  });

  it("does not show a connection-loss warning while the room is ending", async () => {
    const view = await render(<LiveScreen mediaState={{ ...realMediaState, rtc: "disconnected" }} busy onEnd={() => undefined} />);

    expect(view.queryByText("Voice connection lost")).toBeNull();
    expect(view.getByText("Uploading recording")).toBeTruthy();
  });

  it("does not show real voice-in-progress before grant and join succeed", async () => {
    const view = await renderRealLive({ grant: "loading", rtc: "joining" });

    expect(view.queryByText("Voice in progress")).toBeNull();
    expect(view.getByText("Getting voice token")).toBeTruthy();
    expect(view.getByText("Joining the voice room")).toBeTruthy();
  });

  it("real live does not invent fake remote speaking/network seats", async () => {
    const view = await renderRealLive();

    expect(view.queryByText("Mia")).toBeNull();
    expect(view.queryByText("Alex")).toBeNull();
    expect(view.queryByText("Suki")).toBeNull();
    expect(view.queryByText("Remote")).toBeNull();
    expect(view.queryByText("Waiting to join")).toBeNull();
    expect(view.getByText("This device · Good")).toBeTruthy();
    expect(view.queryByText("Mia Good")).toBeNull();
  });

  it("keeps the Live controls executable and removes More", async () => {
    const view = await renderRealLive();

    expect(view.getByLabelText("Mute")).toBeTruthy();
    expect(view.getByLabelText("Speaker on")).toBeTruthy();
    expect(view.getByLabelText("End room")).toBeTruthy();
    expect(view.queryByLabelText("More")).toBeNull();
  });

  it("disables room ending for a non-owner while keeping voice controls visible", async () => {
    const view = await render(
      <LiveScreen
        canEnd={false}
        mediaState={realMediaState}
        onEnd={() => undefined}
      />,
    );

    expect(view.getByLabelText("End room").props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByLabelText("Mute")).toBeTruthy();
    expect(view.getByLabelText("Speaker on")).toBeTruthy();
  });

  it("shows local voice activity only after a real volume callback is reflected in state", async () => {
    const silent = await render(
      <LiveScreen
        mediaState={{ ...realMediaState, localVoiceActive: false }}
        onEnd={() => undefined}
      />,
    );
    expect(silent.getByText("Listening")).toBeTruthy();
    expect(silent.queryByText("Your voice is being received")).toBeNull();

    await act(async () => {
      silent.rerender(
        <LiveScreen
          mediaState={{ ...realMediaState, localVoiceActive: true }}
          onEnd={() => undefined}
        />,
      );
    });
    expect(silent.getByText("Your voice is being received")).toBeTruthy();
  });

  it("real live renders subscribed remotes without demo cast", async () => {
    const view = await render(
      <LiveScreen
        mediaState={realMediaState}
        members={[
          { playerId: "local", nickname: "Avery", isLocal: true, ready: true },
          { playerId: "u_remote_1", nickname: "Rowan", isLocal: false, ready: true },
        ]}
        remotes={[{ userId: "u_remote_1", speaking: true, audioAvailable: true }]}
        onEnd={() => undefined}
      />,
    );

    expect(view.getByText("Rowan")).toBeTruthy();
    expect(view.getAllByText("Guest").length).toBeGreaterThan(0);
    expect(view.queryByText("u_remote_1")).toBeNull();
    expect(view.getByText("Speaking")).toBeTruthy();
    expect(view.queryByText("Mia")).toBeNull();
  });

  it.each([
    { grant: "loading", rtc: "joining" },
    { grant: "failed" },
    { rtc: "reconnecting" },
    { rtc: "joinFailed" },
  ] satisfies Array<Partial<MediaUiState>>)("keeps real audio controls disabled until media is ready %#", async (mediaState) => {
    const view = await renderRealLive(mediaState);

    expect(view.getByLabelText("Mute")).toBeDisabled();
    expect(view.getByLabelText("Speaker on")).toBeDisabled();
  });

  it("shows a report loading page while report polling is still pending", async () => {
    const client = new FakeRoomClient();
    jest.spyOn(client, "getRoomReport").mockReturnValue(new Promise(() => undefined));
    const view = await render(<RoomApp client={client} mediaState={{ ...realMediaState, recording: "processing", report: "processing" }} />);

    await moveToLive(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });

    expect(await view.findByTestId("report-loading-screen")).toBeTruthy();
    expect(view.getByText("Generating your speaking report")).toBeTruthy();
    expect(view.queryByTestId("report-score-card")).toBeNull();
  });

  it("renders the report loading state without showing placeholder scores", async () => {
    const view = await render(<ReportLoadingScreen onDone={() => undefined} />);

    expect(view.getByTestId("report-loading-screen")).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId("report-loading-screen").props.style)).toMatchObject({ flex: 1 });
    expect(view.getByText("Generating your speaking report")).toBeTruthy();
    expect(view.getByText("Your score will appear here when analysis is complete")).toBeTruthy();
    expect(view.queryByText("—")).toBeNull();
  });

  it("shows room processing and waits for all real report scores before success summary", async () => {
    const view = await renderReal({ recording: "processing", report: "processing" });

    await moveToLive(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });

    expect(await view.findByTestId("report-loading-screen")).toBeTruthy();
    expect(view.getByText("Generating your speaking report")).toBeTruthy();
    expect(view.queryByText("Great performance")).toBeNull();
  });

  it("does not show real success summary when recording failed even if score jobs completed", async () => {
    const view = await render(<ReportScreen items={completedReports} mediaState={{ ...realMediaState, recording: "failed", report: "ready" }} onDone={() => undefined} onRetry={() => undefined} />);

    expect(view.getByText("Recording upload failed")).toBeTruthy();
    expect(view.getByText("Waiting for all scores")).toBeTruthy();
    expect(view.queryByText("Great performance")).toBeNull();
  });

  it("lets the report header back button leave the report", async () => {
    const onDone = jest.fn();
    const view = await render(<ReportScreen items={[]} mediaState={realMediaState} onDone={onDone} onRetry={() => undefined} />);

    fireEvent.press(view.getByTestId("report-header-back"));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("offers a refresh action when real report generation times out", async () => {
    const refresh = jest.fn();
    const view = await render(
      <ReportScreen
        error="Report generation timed out. Please try again."
        items={[]}
        mediaState={{ ...realMediaState, recording: "ready", report: "failed" }}
        onDone={() => undefined}
        onRefresh={refresh}
        onRetry={() => undefined}
      />,
    );

    expect(view.getByLabelText("Report error")).toHaveTextContent("Report generation timed out. Please try again.");
    await act(async () => {
      fireEvent.press(view.getByLabelText("Refresh report"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the backend failure reason on a failed real score row", async () => {
    const view = await render(
      <ReportScreen
        items={[{ failureReason: "SOE service is not enabled", playerName: "player_1", scoreJobId: "score-1", status: "failed" }]}
        mediaState={{ ...realMediaState, report: "ready" }}
        onDone={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(view.getByText("SOE service is not enabled")).toBeTruthy();
  });

  it("shows non-empty recognized text from a completed real report", async () => {
    const view = await render(
      <ReportScreen
        items={[{ playerName: "player_1", recognizedText: "The ship was at the pier.", scoreJobId: "score-1", status: "completed" }]}
        mediaState={realMediaState}
        onDone={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(view.getByText("Recognized text: The ship was at the pier.")).toBeTruthy();
  });

  it("formats report scores as whole-number percentages", async () => {
    const view = await render(
      <ReportScreen
        items={[{
          fluency: 0.9350120425224304,
          playerName: "player_1",
          pronunciation: 88.3362045288086,
          score: 88.3362045288086,
          scoreJobId: "score-1",
          status: "completed",
        }]}
        mediaState={realMediaState}
        onDone={() => undefined}
        onRetry={() => undefined}
      />,
    );

    expect(view.getByTestId("report-score-number")).toHaveTextContent("88");
    expect(view.getByTestId("report-metric-Pronunciation")).toHaveTextContent("88");
    expect(view.getByTestId("report-metric-Fluency")).toHaveTextContent("94");
    expect(view.getByTestId("report-result-score-score-1")).toHaveTextContent("88");
  });

  it("real waiting lists RoomClient members instead of demo cast and player counts", async () => {
    const view = await renderReal();

    await act(async () => {
      fireEvent.changeText(view.getByTestId("nickname-input"), "RealGuest");
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });

    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(view.getByText("RealGuest")).toBeTruthy();
    expect(view.getByText("You")).toBeTruthy();
    expect(view.queryByText("guest-1")).toBeNull();
    expect(view.queryByText("Liam")).toBeNull();
    expect(view.queryByText("Mia")).toBeNull();
    expect(view.queryByText("Player 4 / 6")).toBeNull();
    expect(view.queryByText("MINT")).toBeNull();
  });

  it("real lobby hides demo player roster on the port card", async () => {
    const view = await renderReal();

    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });

    expect(await view.findByText("ROOM LIVE")).toBeTruthy();
    expect(view.queryByText("4 / 6 players")).toBeNull();
    expect(view.queryByText("+2")).toBeNull();
  });

  it("real report score card layout shrinks within a 390px viewport", async () => {
    const view = await render(
      <View style={{ width: 390 }}>
        <ReportScreen
          items={completedReports}
          mediaState={realMediaState}
          onDone={() => undefined}
          onRetry={() => undefined}
        />
      </View>,
    );

    const scoreCard = view.getByTestId("report-score-card");
    const flat = StyleSheet.flatten(scoreCard.props.style);
    expect(flat?.flexShrink).toBe(1);
    expect(flat?.minWidth).toBe(0);
    expect(flat?.overflow).toBe("hidden");
  });

  it.each([
    { rtc: "disconnected" as const, label: "Reconnect" },
    { rtc: "joinFailed" as const, label: "Rejoin room" },
    { rtc: "kicked" as const, label: "Rejoin room" },
  ])("real live exposes a reconnect action when rtc is $rtc", async ({ rtc, label }) => {
    const onReconnect = jest.fn();
    const view = await render(
      <LiveScreen
        mediaState={{ ...realMediaState, rtc }}
        onEnd={() => undefined}
        onReconnectMedia={onReconnect}
      />,
    );

    const button = view.getByLabelText(label);
    expect(button).toBeEnabled();
    fireEvent.press(button);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("waiting screen exposes retry voice connection when real TRTC join failed", async () => {
    const onReconnect = jest.fn();
    const view = await render(
      <WaitingScreen
        busy={false}
        mediaState={{ ...realMediaState, grant: "ready", rtc: "joinFailed" }}
        members={[]}
        ready
        onLeave={() => undefined}
        onReady={() => undefined}
        onReconnectMedia={onReconnect}
        onStart={() => undefined}
      />,
    );

    expect(view.getByText("TRTC: Join failed")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Retry voice connection"));
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("start-room-button")).toBeDisabled();
  });

  it("real live hides stale remote seats after parent clears remotes on rtc failure", async () => {
    const view = await render(
      <LiveScreen
        mediaState={realMediaState}
        remotes={[{ userId: "stale-remote", speaking: true, audioAvailable: true }]}
        onEnd={() => undefined}
      />,
    );
    expect(view.getAllByText("Guest").length).toBeGreaterThan(0);

    view.rerender(
      <LiveScreen
        mediaState={{ ...realMediaState, rtc: "disconnected" }}
        remotes={[]}
        onEnd={() => undefined}
        onReconnectMedia={() => undefined}
      />,
    );

    await act(async () => undefined);

    expect(view.queryByText("stale-remote")).toBeNull();
    expect(view.getByLabelText("Reconnect")).toBeTruthy();
  });
});
