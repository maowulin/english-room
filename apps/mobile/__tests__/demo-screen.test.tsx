import { render } from "@testing-library/react-native";

import { DemoScreen } from "@/app/index";

describe("DemoScreen", () => {
  it("shows the foundation services and online API status", async () => {
    const loadHealth = jest.fn().mockResolvedValue({
      service: "english-room-api",
      status: "ok",
    });

    const view = await render(<DemoScreen loadHealth={loadHealth} />);

    view.getByText("English Room Demo");
    view.getByText("Expo Development Build");
    view.getByText("TRTC 实时语音");
    view.getByText("下一阶段接入");
    await view.findByText("服务在线");
    expect(loadHealth).toHaveBeenCalledTimes(1);
  });

  it("keeps the Demo usable when the API is offline", async () => {
    const loadHealth = jest.fn().mockRejectedValue(new Error("offline"));

    const view = await render(<DemoScreen loadHealth={loadHealth} />);

    await view.findByText("服务离线");
    view.getByText("客户端仍可运行，请启动 FastAPI 后重试。");
  });
});
