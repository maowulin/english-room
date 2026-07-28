import { ApiClient } from "@/services/api-client";

describe("ApiClient", () => {
  it("returns the FastAPI health status", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        service: "english-room-api",
        status: "ok",
      }),
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000/",
      fetcher,
    });

    await expect(client.getHealth()).resolves.toEqual({
      service: "english-room-api",
      status: "ok",
    });
    expect(fetcher).toHaveBeenCalledWith("http://localhost:8000/health");
  });

  it("rejects an unsuccessful health response", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher.mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.getHealth()).rejects.toThrow(
      "Backend health check failed (HTTP 503)",
    );
  });

  it("rejects an invalid health payload", async () => {
    const fetcher = jest.fn<Promise<Response>, [RequestInfo | URL]>();
    fetcher.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "unknown" }),
    } as Response);
    const client = new ApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.getHealth()).rejects.toThrow(
      "Backend health check returned an invalid payload",
    );
  });
});
