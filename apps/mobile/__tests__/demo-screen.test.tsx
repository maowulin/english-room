import { render, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { DemoScreen } from "@/app/index";

function createFakeAnalyticsClient() {
  const calls: string[] = [];
  return {
    calls,
    startSession: jest.fn().mockImplementation(async () => {
      calls.push("startSession");
    }),
    track: jest.fn(),
    flush: jest.fn().mockImplementation(async (reason: string) => {
      calls.push(`flush:${reason}`);
    }),
    dispose: jest.fn().mockImplementation(() => {
      calls.push("dispose");
    }),
  };
}

describe("DemoScreen", () => {
  it("shows the foundation services and online API status", async () => {
    const loadHealth = jest.fn().mockResolvedValue({
      service: "english-room-api",
      status: "ok",
    });
    const analyticsClient = createFakeAnalyticsClient();

    const view = await render(
      <DemoScreen loadHealth={loadHealth} analyticsClient={analyticsClient} />,
    );

    view.getByText("English Room Demo");
    view.getByText("Expo Development Build");
    view.getByText("TRTC 实时语音");
    view.getByText("下一阶段接入");
    await view.findByText("服务在线");
    expect(loadHealth).toHaveBeenCalledTimes(1);
  });

  it("keeps the Demo usable when the API is offline", async () => {
    const loadHealth = jest.fn().mockRejectedValue(new Error("offline"));
    const analyticsClient = createFakeAnalyticsClient();

    const view = await render(
      <DemoScreen loadHealth={loadHealth} analyticsClient={analyticsClient} />,
    );

    await view.findByText("服务离线");
    view.getByText("客户端仍可运行，请启动 FastAPI 后重试。");
  });

  it("tracks a cold start and a new session when returning from background", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    const addEventListener = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove };
      });
    const analyticsClient = createFakeAnalyticsClient();
    const loadHealth = jest.fn().mockResolvedValue({
      service: "english-room-api",
      status: "ok",
    });

    const view = await render(
      <DemoScreen
        loadHealth={loadHealth}
        analyticsClient={analyticsClient}
        disposeAnalyticsOnUnmount
      />,
    );

    await waitFor(() => {
      expect(analyticsClient.track).toHaveBeenCalledWith("app_opened", {
        entry_source: "cold_start",
      });
    });
    expect(appStateListener).toBeDefined();

    appStateListener?.("background");
    expect(analyticsClient.flush).toHaveBeenCalledWith("background");
    appStateListener?.("active");

    await waitFor(() => {
      expect(analyticsClient.startSession).toHaveBeenCalledTimes(2);
      expect(analyticsClient.track).toHaveBeenLastCalledWith("app_opened", {
        entry_source: "warm_resume",
      });
    });

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(analyticsClient.flush).toHaveBeenCalledWith("shutdown");
    expect(analyticsClient.dispose).toHaveBeenCalledTimes(1);
    expect(analyticsClient.calls.indexOf("flush:shutdown")).toBeLessThan(
      analyticsClient.calls.indexOf("dispose"),
    );
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    addEventListener.mockRestore();
  });

  it("flushes on background and shutdown without disposing the shared client", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove };
    });
    const analyticsClient = createFakeAnalyticsClient();
    const view = await render(<DemoScreen analyticsClient={analyticsClient} />);

    appStateListener?.("inactive");
    await view.unmount();

    expect(analyticsClient.flush).toHaveBeenCalledWith("background");
    expect(analyticsClient.flush).toHaveBeenCalledWith("shutdown");
    expect(analyticsClient.dispose).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });
});
