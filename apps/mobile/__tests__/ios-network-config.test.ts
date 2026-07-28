import appConfig from "../app.json";

describe("iOS online API transport configuration", () => {
  it("allows the configured online HTTP API host for local development builds", () => {
    const apiHost = new URL(process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://111.230.56.187:8000").hostname;
    const exceptions = appConfig.expo?.ios?.infoPlist?.NSAppTransportSecurity?.NSExceptionDomains as Record<string, { NSExceptionAllowsInsecureHTTPLoads?: boolean }> | undefined;
    const exception = exceptions?.[apiHost];

    expect(exception?.NSExceptionAllowsInsecureHTTPLoads).toBe(true);
  });
});
