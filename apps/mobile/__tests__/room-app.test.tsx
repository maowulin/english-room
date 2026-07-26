import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

import { RoomApp } from "@/app/index";
import { LiveScreen, ReportScreen, type MediaUiState } from "@/features/session/story-screens";
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
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("等待同伴入座")).toBeTruthy();
  };

  const moveToLive = async (view: RoomView) => {
    await moveToWaiting(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("start-room-button"));
    });
    expect(await view.findByText("正在练习")).toBeTruthy();
  };

  const moveToReadyWaiting = async (view: RoomView) => {
    await moveToWaiting(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("ready-button"));
    });
  };

  it("takes a guest from login to lobby and created waiting room", async () => {
    const view = await renderFake();

    expect(view.getByLabelText("Demo 访客模式")).toBeTruthy();
    await act(async () => {
      fireEvent.changeText(view.getByTestId("nickname-input"), "Mint");
      fireEvent.press(view.getByTestId("login-button"));
    });
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("create-room-button"));
    });
    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(view.getByText("MINT")).toBeTruthy();
  });

  it("joins an existing room by code instead of creating another", async () => {
    const client = new FakeRoomClient();
    const host = await client.createGuestSession({ nickname: "Host" });
    const created = await client.createRoom({ title: "雾港疑云" });
    await client.joinRoom(created.id, { playerId: host.playerId });
    const membersBefore = (await client.getRoomByCode(created.code)).members.length;

    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(view.getByTestId("room-code-input"), created.code);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("submit-room-code-button"));
    });

    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(view.getByText(new RegExp(created.code))).toBeTruthy();
    const membersAfter = (await client.getRoomByCode(created.code)).members.length;
    expect(membersAfter).toBe(membersBefore + 1);
  });

  it("lets a ready guest start and end the voice room", async () => {
    const view = await renderFake();

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
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
    expect(await view.findByText("正在练习")).toBeTruthy();
    expect(view.getByLabelText("Demo 控制面")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });
    expect(await view.findByText("本局口语报告")).toBeTruthy();
  });

  it("explains Demo guest mode instead of fake email registration", async () => {
    const view = await renderFake();

    await act(async () => {
      fireEvent.press(view.getByLabelText("前往注册"));
    });
    expect(await view.findByText("Demo 访客说明")).toBeTruthy();
    expect(view.getByText(/没有邮箱注册/)).toBeTruthy();
    expect(view.queryByText("发送验证码")).toBeNull();
  });

  it("shows a reconnecting visual state on the live screen", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
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
    await act(async () => {
      fireEvent.press(view.getByTestId("reconnect-button"));
    });
    expect(await view.findByText("重新连接中")).toBeTruthy();
  });

  it("keeps the lobby tab bar and report exit control reachable", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
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
    expect(await view.findByLabelText("回到大厅")).toBeTruthy();
  });

  it("disables join when room code is empty", async () => {
    const view = await renderFake();
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();
    expect(view.getByLabelText("房间码空提示")).toBeTruthy();
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
      fireEvent.press(view.getByTestId("login-button"));
    });
    expect(view.getByText("进入中…")).toBeTruthy();
    expect(view.getByTestId("login-button")).toBeDisabled();

    await act(async () => {
      releaseSession?.({ playerId: "guest-1", nickname: "Mint" });
    });
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();
  });

  it("stays in the lobby and shows an error when create fails, without fake fallback", async () => {
    const client = new FakeRoomClient();
    client.createRoom = async () => {
      throw new Error("API 请求失败（HTTP 500）");
    };
    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();
    expect(view.getByLabelText("API 错误")).toBeTruthy();
    expect(view.queryByText("等待同伴入座")).toBeNull();
    expect(view.queryByLabelText("开发 fallback")).toBeNull();
  });

  it("keeps the waiting screen when start fails instead of optimistic live jump", async () => {
    const client = new FakeRoomClient();
    client.startRoom = async () => {
      throw new Error("API 请求失败（HTTP 409）");
    };
    const view = await render(<RoomApp client={client} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
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
    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(view.getByLabelText("API 错误")).toBeTruthy();
    expect(view.queryByText("正在练习")).toBeNull();
  });

  it("separates real media labels and shows denied microphone permission before start", async () => {
    const view = await renderReal({ grant: "idle", permission: "denied", rtc: "idle" });

    await moveToWaiting(view);

    expect(view.getByText("真实语音模式 · 等待媒体就绪")).toBeTruthy();
    expect(view.getByText("麦克风权限被拒绝，请在系统设置中开启后重试")).toBeTruthy();
    expect(view.queryByText("Demo / Fake 控制面 · 语音为 Fake")).toBeNull();
  });

  it("separates real media labels in the lobby", async () => {
    const view = await renderReal();

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });

    expect(await view.findByText("真实语音模式 · TRTC/SOE")).toBeTruthy();
    expect(view.queryByText("Demo / Fake 控制面 · 非真实 TRTC/SOE")).toBeNull();
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
    [{ grant: "loading", rtc: "joining" }, "正在获取语音凭证", "正在连接语音房间"],
    [{ rtc: "reconnecting" }, "正在重新连接", "其他人可能暂时听不到你"],
    [{ network: "weak", rtc: "joined" }, "语音进行中", "网络较弱，建议靠近 Wi-Fi"],
    [{ rtc: "kicked" }, "你已离开语音房间", "请返回房间重新加入"],
    [{ rtc: "disconnected" }, "语音已断开", "请检查网络后重试"],
    [{ rtc: "joinFailed" }, "语音入房失败", "请稍后重试"],
  ] satisfies Array<[Partial<MediaUiState>, string, string]>)("renders real live media state %# without leaking demo copy", async (mediaState, primary, secondary) => {
    const view = await renderRealLive(mediaState);

    expect(view.getByText("真实语音模式 · TRTC")).toBeTruthy();
    expect(view.queryByText("Demo / Fake RTC · 非真实语音")).toBeNull();
    expect(view.getByText(primary)).toBeTruthy();
    expect(view.getByText(secondary)).toBeTruthy();
  });

  it("does not show real voice-in-progress before grant and join succeed", async () => {
    const view = await renderRealLive({ grant: "loading", rtc: "joining" });

    expect(view.queryByText("语音进行中")).toBeNull();
    expect(view.getByText("正在获取语音凭证")).toBeTruthy();
    expect(view.getByText("正在连接语音房间")).toBeTruthy();
  });

  it.each([
    { grant: "loading", rtc: "joining" },
    { grant: "failed" },
    { rtc: "reconnecting" },
    { rtc: "joinFailed" },
  ] satisfies Array<Partial<MediaUiState>>)("keeps real audio controls disabled until media is ready %#", async (mediaState) => {
    const view = await renderRealLive(mediaState);

    expect(view.getByLabelText("静音")).toBeDisabled();
    expect(view.getByLabelText("扬声器开")).toBeDisabled();
  });

  it("shows room processing and waits for all real report scores before success summary", async () => {
    const view = await renderReal({ recording: "processing", report: "processing" });

    await moveToLive(view);
    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });

    expect(await view.findByText("本局口语报告")).toBeTruthy();
    expect(view.getByText("录音上传中")).toBeTruthy();
    expect(view.getByText("报告生成中")).toBeTruthy();
    expect(view.getByText("等待全员评分完成")).toBeTruthy();
    expect(view.queryByText("表现优秀")).toBeNull();
    expect(view.getByText("评分完成")).toBeTruthy();
    expect(view.getByText("评分处理中")).toBeTruthy();
    expect(view.getByText("等待音频生成")).toBeTruthy();
    expect(view.getByText("评分失败")).toBeTruthy();
  });

  it("does not show real success summary when recording failed even if score jobs completed", async () => {
    const view = await render(<ReportScreen items={completedReports} mediaState={{ ...realMediaState, recording: "failed", report: "ready" }} onDone={() => undefined} onRetry={() => undefined} />);

    expect(view.getByText("录音上传失败")).toBeTruthy();
    expect(view.getByText("等待全员评分完成")).toBeTruthy();
    expect(view.queryByText("表现优秀")).toBeNull();
  });
});
