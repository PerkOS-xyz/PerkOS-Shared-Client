import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createApiClient, ApiError } from "../src/apiClient";

describe("createApiClient", () => {
  const baseUrl = "https://api.perkos.xyz";
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("requires a baseUrl", () => {
    // @ts-expect-error — intentional: missing required arg.
    expect(() => createApiClient({})).toThrow(/baseUrl/);
  });

  it("joins paths correctly with and without leading slash", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
    const api = createApiClient({ baseUrl });
    await api.get("/v1/ping");
    await api.get("v1/ping");
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.perkos.xyz/v1/ping");
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://api.perkos.xyz/v1/ping");
  });

  it("attaches Authorization: Bearer when getIdToken returns a token", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
    const api = createApiClient({
      baseUrl,
      getIdToken: async () => "test-id-token",
    });
    await api.get("/v1/me");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-id-token");
  });

  it("does NOT attach Authorization when getIdToken returns null", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
    const api = createApiClient({
      baseUrl,
      getIdToken: async () => null,
    });
    await api.get("/v1/me");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.has("authorization")).toBe(false);
  });

  it("parses JSON 2xx responses", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ name: "alice" }));
    const api = createApiClient({ baseUrl });
    const out = await api.get<{ name: string }>("/v1/me");
    expect(out).toEqual({ name: "alice" });
  });

  it("throws ApiError on non-2xx with the server's error message", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: "wallet not allowlisted" }, 403)
    );
    const api = createApiClient({ baseUrl });
    await expect(api.get("/v1/me")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "wallet not allowlisted",
    });
  });

  it("posts JSON bodies and sets content-type when missing", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
    const api = createApiClient({ baseUrl });
    await api.post("/v1/foo", { hello: "world" });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ hello: "world" }));
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("merges defaultHeaders with per-call init.headers (per-call wins)", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
    const api = createApiClient({
      baseUrl,
      defaultHeaders: { "x-app": "miniapp", "x-trace": "default" },
    });
    await api.get("/v1/me", {
      headers: { "x-trace": "override" },
    });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("x-app")).toBe("miniapp");
    expect(headers.get("x-trace")).toBe("override");
  });

  it("ApiError surfaces the parsed body for diagnostic logging", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: "bad", code: 42 }, 400));
    const api = createApiClient({ baseUrl });
    try {
      await api.get("/v1/me");
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).body).toEqual({ error: "bad", code: 42 });
    }
  });
});
