import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

import { RoomApp } from "@/app/index";
import { FakeRoomClient } from "@/services/room-client";

describe("RoomApp", () => {
  afterEach(cleanup);

  const renderFake = async () => render(<RoomApp client={new FakeRoomClient()} />);

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
});
