import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

const mockLeave = jest.fn(async () => undefined);
const mockDispose = jest.fn();
const mockUnsubscribe = jest.fn();
const mockJoin = jest.fn(async () => undefined);
const mockSubscribe = jest.fn(() => mockUnsubscribe);

jest.mock("@/services/rtc-factory", () => ({
  createRtcClient: jest.fn(() => ({
    join: mockJoin,
    leave: mockLeave,
    dispose: mockDispose,
    subscribe: mockSubscribe,
    getState: () => ({ joined: true, muted: false, speakerOn: true, connection: "connected" }),
    setMuted: jest.fn(async () => undefined),
    setSpeaker: jest.fn(async () => undefined),
    setConnectionState: jest.fn(async () => undefined),
  })),
}));

import { RoomApp } from "@/features/session/room-app";
import { FakeRoomClient } from "@/services/room-client";

type RoomView = Awaited<ReturnType<typeof render>>;

async function enterLive(view: RoomView) {
  await act(async () => {
    fireEvent.press(view.getByTestId("login-button"));
  });
  await act(async () => {
    fireEvent.press(await view.findByTestId("create-room-button"));
  });
  expect(await view.findByText("等待同伴入座")).toBeTruthy();
  await act(async () => {
    fireEvent.press(view.getByTestId("ready-button"));
  });
  await act(async () => {
    fireEvent.press(view.getByTestId("start-room-button"));
  });
  expect(await view.findByText("正在练习")).toBeTruthy();
}

describe("RoomApp real media lifecycle", () => {
  const previousMode = process.env.EXPO_PUBLIC_MEDIA_MODE;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_MEDIA_MODE = "real";
    mockLeave.mockClear();
    mockDispose.mockClear();
    mockUnsubscribe.mockClear();
    mockJoin.mockClear();
    mockSubscribe.mockClear();
    mockLeave.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    cleanup();
    process.env.EXPO_PUBLIC_MEDIA_MODE = previousMode;
  });

  it("leaves RTC when leaving waiting and unsubscribes on unmount", async () => {
    const view = await render(<RoomApp client={new FakeRoomClient()} />);

    await act(async () => {
      fireEvent.press(view.getByTestId("login-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(mockJoin).toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(view.getByLabelText("离开房间"));
    });
    expect(mockLeave).toHaveBeenCalled();

    await act(async () => {
      view.unmount();
    });
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockDispose).toHaveBeenCalled();
  });
  it("ends room without awaiting RTC leave and keeps report processing when jobs incomplete", async () => {
    let resolveLeave: (() => void) | undefined;
    mockLeave.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveLeave = () => resolve(undefined);
        }),
    );

    const view = await render(<RoomApp client={new FakeRoomClient()} />);
    await enterLive(view);

    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });

    // Control plane must reach report even while leave is still pending.
    expect(await view.findByText("本局口语报告")).toBeTruthy();
    expect(view.getByText("录音上传中")).toBeTruthy();
    expect(view.getByText("报告生成中")).toBeTruthy();
    expect(view.getByText("等待全员评分完成")).toBeTruthy();
    expect(view.queryByText("表现优秀")).toBeNull();
    expect(resolveLeave).toBeDefined();
    await act(async () => {
      resolveLeave?.();
    });
  });
});
