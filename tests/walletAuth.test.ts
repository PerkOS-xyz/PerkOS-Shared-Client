import { describe, it, expect, vi } from "vitest";

import { signInWithWallet } from "../src/walletAuth";
import { ApiError } from "../src/types";

const ADDRESS = "0xAbCdef0123456789abCDEF0123456789aBcDef01" as const;
const SIG = "0xdeadbeef" as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("signInWithWallet", () => {
  it("runs nonce → sign → exchange and returns the server response", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ nonce: "n1", message: "Sign in to PerkOS\nnonce: n1" })
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: "custom-token-xyz", address: ADDRESS.toLowerCase() })
      );

    const signMessage = vi.fn().mockResolvedValue(SIG);

    const out = await signInWithWallet({
      address: ADDRESS,
      signMessage,
      apiBase: "https://api.perkos.xyz",
      fetchImpl,
    });

    expect(signMessage).toHaveBeenCalledWith("Sign in to PerkOS\nnonce: n1");
    expect(out.token).toBe("custom-token-xyz");
    expect(out.address).toBe(ADDRESS.toLowerCase());

    // Nonce call uses lowercased address.
    expect(fetchImpl.mock.calls[0]?.[0]).toContain(
      `address=${encodeURIComponent(ADDRESS.toLowerCase())}`
    );

    // Exchange call body includes signature + lowercased address.
    const exchangeInit = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(exchangeInit.body as string)).toEqual({
      address: ADDRESS.toLowerCase(),
      signature: SIG,
      chainId: undefined,
    });
  });

  it("propagates server error message via ApiError on nonce failure", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ error: "rate limited" }, 429)
      );

    await expect(
      signInWithWallet({
        address: ADDRESS,
        signMessage: async () => SIG,
        apiBase: "",
        fetchImpl,
      })
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 429,
      message: "rate limited",
    });
  });

  it("propagates allowlist error from exchange step", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ nonce: "n", message: "sign-this" })
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: "wallet not on allowlist" }, 403)
      );

    try {
      await signInWithWallet({
        address: ADDRESS,
        signMessage: async () => SIG,
        apiBase: "",
        fetchImpl,
      });
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).message).toMatch(/allowlist/);
    }
  });

  it("throws if the server omits the custom token", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ nonce: "n", message: "m" }))
      .mockResolvedValueOnce(jsonResponse({ address: ADDRESS.toLowerCase() }));

    await expect(
      signInWithWallet({
        address: ADDRESS,
        signMessage: async () => SIG,
        apiBase: "",
        fetchImpl,
      })
    ).rejects.toMatchObject({ message: /missing custom token/i });
  });
});
