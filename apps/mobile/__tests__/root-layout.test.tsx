import { act, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import { RootLayout } from "@/app/_layout";

jest.mock("expo-router", () => ({
  Stack: () => null,
  useRootNavigationState: jest.fn(),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
}));

const { useRootNavigationState } = jest.requireMock("expo-router") as {
  useRootNavigationState: jest.Mock;
};

describe("RootLayout launch lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the native splash in control before the root navigation is ready", async () => {
    useRootNavigationState.mockReturnValue({ key: undefined });

    const view = await render(<RootLayout />);

    expect(view.queryByText("Preparing your room")).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it("hides native splash after navigation is ready and then removes the app layer", async () => {
    useRootNavigationState.mockReturnValue({ key: "root-navigation" });

    const view = await render(<RootLayout />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    view.getByText("Preparing your room");

    await act(async () => {
      jest.advanceTimersByTime(1_200);
    });
    await act(async () => {
      jest.advanceTimersByTime(180);
    });
    expect(view.queryByText("Preparing your room")).toBeNull();
  });
});
