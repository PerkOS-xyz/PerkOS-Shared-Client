/**
 * Inline type fallbacks for symbols normally re-exported from
 * `@perkos/shared-types`. The sister package is not yet published; once it
 * lands these declarations should be deleted and replaced with
 *   import type { ApiError, WalletSigninResponse } from "@perkos/shared-types";
 *
 * Keeping them here makes this package installable on its own. Consumers that
 * already depend on `@perkos/shared-types` will get the same shape from there.
 */

export type WalletSigninNonceResponse = {
  nonce: string;
  message: string;
};

export type WalletSigninResponse = {
  token: string;
  address: `0x${string}`;
  isNewUser?: boolean;
};

/**
 * Thrown by the API client on any non-2xx response.
 * Mirrors `ApiError` from `@perkos/shared-types`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
