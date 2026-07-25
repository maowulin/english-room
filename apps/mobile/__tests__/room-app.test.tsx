import { act, fireEvent, render } from "@testing-library/react-native";

import { RoomApp } from "@/app/index";

describe("RoomApp", () => {
  it("takes a guest from login to lobby and created waiting room", async () => {
    const view = await render(<RoomApp />);

    await act(async () => fireEvent.changeText(view.getByTestId("email-input"), "mint@example.com"));
    await act(async () => fireEvent.press(view.getByTestId("login-button")));
    expect(await view.findByText("今晚想练哪一句？")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByTestId("create-room-button")));
    expect(await view.findByText("等待同伴入座")).toBeTruthy();
    expect(view.getByText("MINT")).toBeTruthy();
  });

  it("lets a ready guest start and end the voice room", async () => {
    const view = await render(<RoomApp />);

    await act(async () => fireEvent.press(view.getByTestId("login-button")));
    await act(async () => fireEvent.press(await view.findByTestId("create-room-button")));
    await act(async () => fireEvent.press(view.getByTestId("ready-button")));
    await act(async () => fireEvent.press(view.getByTestId("start-room-button")));
    expect(await view.findByText("正在练习")).toBeTruthy();

    await act(async () => fireEvent.press(view.getByTestId("end-room-button")));
    expect(await view.findByText("本局口语报告")).toBeTruthy();
  });
});
