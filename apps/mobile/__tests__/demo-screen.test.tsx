import { render } from "@testing-library/react-native";

import { DemoScreen } from "@/app/index";

describe("DemoScreen", () => {
  it("shows the foundation services and online API status", async () => {
    const loadHealth = jest.fn().mockResolvedValue({
      service: "english-room-api",
      status: "ok",
    });

    const view = await render(<DemoScreen loadHealth={loadHealth} />);

    view.getByText("English Room Foundation");
    view.getByText("Expo Development Build");
    view.getByText("TRTC voice");
    view.getByText("Next phase");
    await view.findByText("Service online");
    expect(loadHealth).toHaveBeenCalledTimes(1);
  });

  it("keeps the Demo usable when the API is offline", async () => {
    const loadHealth = jest.fn().mockRejectedValue(new Error("offline"));

    const view = await render(<DemoScreen loadHealth={loadHealth} />);

    await view.findByText("Service offline");
    view.getByText("The client can still run. Start FastAPI and try again.");
  });
});
