import { resolveApiBaseUrl } from "@/services/api-base-url";

it("uses the Web localhost default or explicit Expo API base URL", () => {
  expect(resolveApiBaseUrl(undefined)).toBe("http://127.0.0.1:8000");
  expect(resolveApiBaseUrl("http://localhost:8000/")).toBe("http://localhost:8000");
});
