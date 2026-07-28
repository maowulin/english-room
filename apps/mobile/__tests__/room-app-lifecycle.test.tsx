import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

const mockLeave = jest.fn(async () => undefined);
const mockDispose = jest.fn();
const mockUnsubscribe = jest.fn();
const mockJoin = jest.fn(async () => undefined);
const mockSetMuted = jest.fn(async () => undefined);
const mockSubscribe = jest.fn(() => mockUnsubscribe);

jest.mock("@/services/rtc-factory", () => ({
  createRtcClient: jest.fn(() => ({
    join: mockJoin,
    leave: mockLeave,
    dispose: mockDispose,
    subscribe: mockSubscribe,
    getState: () => ({ joined: true, muted: false, speakerOn: true, connection: "connected" }),
    setMuted: mockSetMuted,
    setSpeaker: jest.fn(async () => undefined),
    setConnectionState: jest.fn(async () => undefined),
  })),
}));

import { RoomApp } from "@/features/session/room-app";
import { FakeRoomClient } from "@/services/room-client";

type RoomView = Awaited<ReturnType<typeof render>>;

async function enterLive(view: RoomView) {
  await act(async () => {
    fireEvent.press(view.getByTestId("demo-guest-button"));
  });
  await act(async () => {
    fireEvent.press(await view.findByTestId("create-room-button"));
  });
  expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
  expect(await view.findByText("Microphone is listening")).toBeTruthy();
  await act(async () => {
    fireEvent.press(view.getByTestId("ready-button"));
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.press(view.getByTestId("start-room-button"));
  });
  expect(await view.findByText("In progress")).toBeTruthy();
}

describe("RoomApp real media lifecycle", () => {
  const previousMode = process.env.EXPO_PUBLIC_MEDIA_MODE;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_MEDIA_MODE = "real";
    mockLeave.mockClear();
    mockDispose.mockClear();
    mockUnsubscribe.mockClear();
    mockJoin.mockClear();
    mockSetMuted.mockClear();
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
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    expect(mockJoin).toHaveBeenCalled();
    expect(mockSetMuted).toHaveBeenCalledWith(true);

    await act(async () => {
      fireEvent.press(view.getByLabelText("Leave room"));
    });
    expect(mockLeave).toHaveBeenCalled();

    await act(async () => {
      view.unmount();
    });
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockDispose).toHaveBeenCalled();
  });
  it("retry voice connection leaves RTC and re-issues join after prepare failure", async () => {
    mockJoin.mockRejectedValueOnce(new Error("TRTC enterRoom ack timeout"));
    mockJoin.mockResolvedValueOnce(undefined);

    const view = await render(<RoomApp client={new FakeRoomClient()} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("demo-guest-button"));
    });
    await act(async () => {
      fireEvent.press(await view.findByTestId("create-room-button"));
    });
    expect(await view.findByText("Waiting for everyone to take a seat")).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockJoin).toHaveBeenCalledTimes(1);

    const retry = await view.findByLabelText("Retry voice connection");
    await act(async () => {
      fireEvent.press(retry);
      await Promise.resolve();
    });

    expect(mockLeave).toHaveBeenCalled();
    expect(mockJoin).toHaveBeenCalledTimes(2);
  });

  it("ends room without awaiting RTC leave and shows report loading when jobs are incomplete", async () => {
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
      fireEvent.press(view.getByTestId("finish-turn-button"));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("end-room-button"));
    });

    // Control plane must reach report even while leave is still pending.
    expect(await view.findByTestId("report-loading-screen")).toBeTruthy();
    expect(view.getByText("Generating your speaking report")).toBeTruthy();
    expect(view.queryByText("—")).toBeNull();
    expect(view.queryByText("Great performance")).toBeNull();
    expect(resolveLeave).toBeDefined();
    await act(async () => {
      resolveLeave?.();
    });
  });

});
