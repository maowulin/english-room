import { act, fireEvent, render } from "@testing-library/react-native";

import { RoomApp } from "@/app/index";
import { FakeRoomClient } from "@/services/room-client";

describe("RoomApp", () => {
  const renderFake = () => render(<RoomApp client={new FakeRoomClient()} />);

  it("takes a guest from login to lobby and created waiting room", async () => {
    const view = await renderFake();

    await act(async () => fireEvent.changeText(view.getByTestId("email-input"), "mint@example.com"));
    await act(async () => fireEvent.press(view.getByTestId("login-button")));
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByTestId("create-room-button")));
    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(view.getByText("MINT")).toBeTruthy();
  });

  it("lets a ready guest start and end the voice room", async () => {
    const view = await renderFake();

    await act(async () => fireEvent.press(view.getByTestId("login-button")));
    await act(async () => fireEvent.press(await view.findByTestId("create-room-button")));
    await act(async () => fireEvent.press(view.getByTestId("ready-button")));
    await act(async () => fireEvent.press(view.getByTestId("start-room-button")));
    expect(await view.findByText("正在练习")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByTestId("end-room-button")));
    expect(await view.findByText("本局口语报告")).toBeTruthy();
  });

  it("shows the registration steps and a reconnecting visual state", async () => {
    const registerView = await renderFake();

    await act(async () => fireEvent.press(registerView.getByLabelText("前往注册")));
    expect(await registerView.findByText("1")).toBeTruthy();
    expect(registerView.getByText("发送验证码")).toBeTruthy();

    const liveView = await renderFake();
    await act(async () => fireEvent.press(liveView.getByTestId("login-button")));
    await act(async () => fireEvent.press(await liveView.findByTestId("create-room-button")));
    await act(async () => fireEvent.press(liveView.getByTestId("ready-button")));
    await act(async () => fireEvent.press(liveView.getByTestId("start-room-button")));
    await act(async () => fireEvent.press(liveView.getByTestId("reconnect-button")));

    expect(await liveView.findByText("重新连接中")).toBeTruthy();
  });

  it("keeps the lobby tab bar and report exit control reachable", async () => {
    const view = await renderFake();
    await act(async () => fireEvent.press(view.getByTestId("login-button")));
    expect(await view.findByTestId("lobby-bottom-tabs")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByTestId("create-room-button")));
    await act(async () => fireEvent.press(view.getByTestId("ready-button")));
    await act(async () => fireEvent.press(view.getByTestId("start-room-button")));
    await act(async () => fireEvent.press(view.getByTestId("end-room-button")));
    expect(await view.findByLabelText("回到大厅")).toBeTruthy();
  });
});
