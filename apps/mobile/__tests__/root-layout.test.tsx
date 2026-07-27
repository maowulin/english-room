jest.mock("expo-router", () => ({
  Stack: () => null,
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("@/analytics", () => ({
  getDefaultAnalyticsClient: jest.fn(),
  useAnalyticsLifecycle: jest.fn(),
}));

describe("RootLayout", () => {
  it("owns the shared analytics lifecycle for the lifetime of the app root", () => {
    const analyticsClient = { name: "shared-client" };
    const analyticsMock = jest.requireMock("@/analytics") as {
      getDefaultAnalyticsClient: jest.Mock;
      useAnalyticsLifecycle: jest.Mock;
    };
    // Jest resolves the app module with the analytics mock in this test.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RootLayout = require("@/app/_layout").default;
    analyticsMock.getDefaultAnalyticsClient.mockReturnValue(analyticsClient);

    RootLayout();

    expect(analyticsMock.getDefaultAnalyticsClient).toHaveBeenCalledTimes(1);
    expect(analyticsMock.useAnalyticsLifecycle).toHaveBeenCalledWith(
      analyticsClient,
      { disposeOnUnmount: false },
    );
  });
});
