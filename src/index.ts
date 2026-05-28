/**
 * `@perkos/shared-client` — barrel export.
 *
 * Non-React surface (Firebase init, API client, wallet sign-in, validators,
 * formatters) is exported here. React hooks live under `@perkos/shared-client/hooks`
 * so consumers that don't have `react` installed (CLI tools, server scripts)
 * can use this package without dragging in a peer dep they don't need.
 */

// Firebase init
export {
  initFirebase,
  getFirebase,
  _resetFirebaseForTests,
} from "./firebase";
export type { FirebaseConfig, FirebaseHandles } from "./firebase";

// API client
export { createApiClient } from "./apiClient";
export type { ApiClient, ApiClientOptions } from "./apiClient";

// Wallet auth
export { signInWithWallet } from "./walletAuth";
export type { SignInOptions } from "./walletAuth";

// Types (fallbacks for symbols also re-exported from @perkos/shared-types)
export {
  ApiError,
} from "./types";
export type {
  WalletSigninNonceResponse,
  WalletSigninResponse,
} from "./types";

// Validators
export {
  emailSchema,
  walletAddressSchema,
  memberSchema,
  ipv4Schema,
  sshPublicKeySchema,
  projectSchema,
  taskSchema,
  organizationSchema,
  accessRequestSchema,
  validateApiKey,
  fieldErrors,
} from "./validators";

// Format helpers
export { formatAddress, formatRelativeShort } from "./format";

// Re-export hooks here for convenience too — consumers that want only the
// non-React surface should import from `./` (Node tree-shaking will drop
// the React imports when they're unused). Hooks live under the `/hooks`
// subpath as well.
export * from "./hooks";
