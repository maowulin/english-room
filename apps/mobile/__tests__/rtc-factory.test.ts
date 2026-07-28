import { createRtcClient, isTrtcNativeAvailable } from "@/services/rtc-factory";
import { FakeRtcClient, resolveAppMediaMode, resolveMediaMode } from "@/services/rtc-client";

it("defaults to demo/web Fake and fails closed for real mode without native TRTC", () => {
  const clean = { ...process.env };
  delete clean.EXPO_PUBLIC_MEDIA_MODE;
  expect(resolveMediaMode(clean, "web")).toBe("web");
  expect(resolveMediaMode(clean, "android")).toBe("demo");
  expect(resolveMediaMode({ ...clean, EXPO_PUBLIC_MEDIA_MODE: "real" }, "android")).toBe("real");

  expect(createRtcClient("demo")).toBeInstanceOf(FakeRtcClient);
  expect(createRtcClient("web")).toBeInstanceOf(FakeRtcClient);

  if (!isTrtcNativeAvailable()) {
    expect(() => createRtcClient("real")).toThrow(/failing closed/);
  }
});

it("defaults native release builds to real media even when runtime env is unavailable", () => {
  const clean = { ...process.env };
  delete clean.EXPO_PUBLIC_MEDIA_MODE;
  expect(resolveAppMediaMode(clean, "android", false)).toBe("real");
  expect(resolveAppMediaMode({ ...clean, EXPO_PUBLIC_MEDIA_MODE: "demo" }, "android", false)).toBe("real");
  expect(resolveAppMediaMode({ ...clean, EXPO_PUBLIC_MEDIA_MODE: "demo" }, "android", true)).toBe("demo");
  expect(resolveAppMediaMode(clean, "web", false)).toBe("web");
});
