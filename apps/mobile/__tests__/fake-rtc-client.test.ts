import { FakeRtcClient } from "@/services/rtc-client";

it("tracks mute and reconnection visual state without a native RTC SDK", async () => {
  const rtc = new FakeRtcClient();

  await rtc.join({ roomId: "room-1", userId: "guest-1" });
  await rtc.setMuted(true);
  await rtc.setConnectionState("reconnecting");

  expect(rtc.getState()).toEqual({
    joined: true,
    muted: true,
    speakerOn: true,
    connection: "reconnecting",
  });
});
