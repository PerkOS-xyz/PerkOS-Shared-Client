/**
 * Wallet → Firebase sign-in dance.
 *
 *   1. GET  /auth/nonce?address=…       → { nonce, message }
 *   2. signMessage(message)             → 0x… signature (caller's wallet)
 *   3. POST /auth/wallet-signin         → { token, address }
 *
 * Unlike the App/Admin originals this helper does NOT itself call
 * `signInWithCustomToken` — the consumer holds the Firebase Auth instance
 * (returned by `initFirebase`) and decides when to finalise the session:
 *
 *   const session = await signInWithWallet({
 *     address, signMessage, apiBase: "https://api.perkos.xyz",
 *   });
 *   await signInWithCustomToken(auth, session.token);
 *
 * This split keeps the helper framework-agnostic and lets callers chain
 * extra logic (e.g. setting analytics user ID) between server response and
 * Firebase sign-in.
 */

import { ApiError, type WalletSigninResponse } from "./types";

export type SignInOptions = {
  /** EVM address. Will be lower-cased before being sent to the server. */
  address: `0x${string}`;
  /** Signs the nonce message and returns the 0x-prefixed signature. */
  signMessage: (message: string) => Promise<`0x${string}`>;
  /**
   * API origin. During the transition from per-app routes to the backbone
   * this can be either:
   *   - "https://api.perkos.xyz"       (Phase 2, PerkOS-API)
   *   - "https://app.perkos.xyz"       (transition; routes under /api/auth)
   *   - "" / undefined                 (same-origin Next.js dev)
   */
  apiBase?: string;
  /** Optional chain id forwarded to the server (defaults to Base mainnet 8453). */
  chainId?: number;
  /** Custom fetch implementation — useful for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

function joinPath(apiBase: string | undefined, path: string): string {
  const base = (apiBase ?? "").replace(/\/+$/, "");
  if (!base) return path;
  // When the consumer wires the backbone API the routes live under /v1/auth/...
  // but App's existing routes are under /api/auth/...  We honour whichever the
  // caller provides — they pass either a base of "https://api.perkos.xyz" with
  // path "/v1/auth/nonce", or "" + "/api/auth/nonce". This helper sticks the
  // `path` straight after the base so both work.
  return `${base}${path}`;
}

/**
 * Run the wallet sign-in handshake. Returns the server's response so the
 * caller can finish with `signInWithCustomToken(auth, response.token)`.
 *
 * Throws `ApiError` on any non-2xx, or `Error` if the wallet rejects the
 * signature request.
 */
export async function signInWithWallet(
  opts: SignInOptions
): Promise<WalletSigninResponse> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const address = opts.address.toLowerCase() as `0x${string}`;

  // 1. Nonce -----------------------------------------------------------
  const nonceUrl = joinPath(
    opts.apiBase,
    `/api/auth/nonce?address=${encodeURIComponent(address)}`
  );
  const nonceRes = await fetchImpl(nonceUrl);
  if (!nonceRes.ok) {
    const body = await safeJson(nonceRes);
    throw new ApiError(
      nonceRes.status,
      pickError(body) ?? "Couldn't request a sign-in nonce.",
      body
    );
  }
  const { message } = (await nonceRes.json()) as {
    nonce: string;
    message: string;
  };

  // 2. Wallet signs ----------------------------------------------------
  const signature = await opts.signMessage(message);

  // 3. Exchange for a custom token ------------------------------------
  const exchangeUrl = joinPath(opts.apiBase, "/api/auth/wallet-signin");
  const exchangeRes = await fetchImpl(exchangeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address,
      signature,
      chainId: opts.chainId,
    }),
  });
  if (!exchangeRes.ok) {
    const body = await safeJson(exchangeRes);
    throw new ApiError(
      exchangeRes.status,
      pickError(body) ?? "Sign-in rejected by server.",
      body
    );
  }

  const body = (await exchangeRes.json()) as Partial<WalletSigninResponse> & {
    token?: string;
  };
  if (!body.token) {
    throw new ApiError(500, "Server response missing custom token.", body);
  }
  return {
    token: body.token,
    address: (body.address ?? address) as `0x${string}`,
    isNewUser: body.isNewUser,
  };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function pickError(body: unknown): string | null {
  if (body && typeof body === "object") {
    const maybe = body as { error?: unknown; message?: unknown };
    if (typeof maybe.error === "string") return maybe.error;
    if (typeof maybe.message === "string") return maybe.message;
  }
  return null;
}
