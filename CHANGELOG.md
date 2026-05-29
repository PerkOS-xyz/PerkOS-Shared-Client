# Changelog

Semver: minor bumps for additive APIs (new export, new optional argument),
patch for fixes that don't change call signatures, major for any breaking
change to existing exports.

## 0.1.1 — 2026-05-29

### Changed

- **Peer dependency `firebase` widened to `^10 || ^11 || ^12`** so consumers
  on the current `firebase@^12` release line (PerkOS App, PerkOS-Admin) no
  longer need `--legacy-peer-deps` on `npm install` / `npm ci`. The shared
  client only uses the stable `firebase/{app,auth,firestore}` surface
  (`initializeApp`, `getApp`, `getApps`, `getAuth`, `getFirestore`,
  `onAuthStateChanged`, `signInWithCustomToken`, `signOut`) which is
  unchanged across the three majors — runtime behavior is identical to
  0.1.0.

### Notes

- No public API changes.
- Consumers pinning `^0.1.0` will pick up this release automatically on
  the next install. To drop `--legacy-peer-deps` from their Dockerfiles,
  rebuild against `^0.1.1` or wider.

## 0.1.0 — 2026-05-28

Initial release. Shared client lib for PerkOS apps: wallet auth, API client,
Firebase init, React hooks. Consumed by App, Admin, Desktop, and future
products to keep auth + transport logic from drifting across clients.

### Added

- **Firebase init** (`initFirebase`, `getFirebase`, `_resetFirebaseForTests`):
  lazy singleton with `FirebaseConfig` injected by the consumer. Package does
  NOT read `process.env` — consumers pass their own `NEXT_PUBLIC_FIREBASE_*`
  values at startup.
- **API client** (`createApiClient`, `ApiError`): typed `get`/`post`/`put`/
  `delete` with auto bearer-token attachment via an optional `getIdToken`
  callback. Throws `ApiError` on non-2xx. Fetch impl is injectable for tests.
- **Wallet sign-in** (`signInWithWallet`): connector-agnostic. Caller supplies
  `address`, `signMessage(message): Promise<0x…>`, and `apiBase` — works
  identically for Farcaster, Base smart wallet, Dynamic.xyz embedded wallet,
  MetaMask, or anything that can sign EIP-191. Caller calls
  `signInWithCustomToken(response.token)` themselves to keep the firebase
  auth instance out of this lib.
- **React hooks** (`hooks/`):
  - `useFirebaseUser` — subscribes to `onAuthStateChanged`, returns
    `{ user, loading, error }`.
  - `useWalletSession` — orchestrates sign-in flow with `requireRole` and
    `requireAccess` knobs. Takes `auth` (Firebase) and `signMessage`
    (wagmi/Dynamic/etc) as args — no wagmi import inside the hook so the
    same hook serves App (Farcaster + Base), Admin (injected wallet), and
    Desktop (Dynamic.xyz).
- **Validators** (`emailSchema`, `walletAddressSchema`, `memberSchema`,
  `ipv4Schema`, `sshPublicKeySchema`, `projectSchema`, `taskSchema`,
  `organizationSchema`, `accessRequestSchema`, `validateApiKey`,
  `fieldErrors`). Ported from `PerkOS/app/lib/validators.ts`.
- **Format helpers** (`formatAddress`, `formatRelativeShort`). Ported from
  `PerkOS/app/lib/format.ts`.
- 22 unit tests (vitest).

### Reconciled from App + Admin

- `firebase.ts`, `format.ts`, `validators.ts` — ported from PerkOS App as-is
  (Admin had no divergent variants).
- `apiClient.ts`, `walletAuth.ts` — App and Admin had byte-identical files.
  Generalised: env reads dropped, fetch impl injectable for tests, `apiBase`
  parameterised.
- `useWalletSession.ts` — merged App's in-flight-promise mutex with Admin's
  role check. New `requireRole`/`requireAccess` knobs. Takes `auth` +
  `signMessage` as args (no wagmi dep inside the hook).

### Dependencies

- `@perkos/shared-types` declared as **optional peer** with inline fallback
  declarations in `src/types.ts`. The package installs and tests pass even
  without the sibling — once it lands on npm, swap the inline file for
  `import type { … } from "@perkos/shared-types"` (no major bump needed since
  the shape stays the same).
- Peer deps: `firebase` (^10 || ^11), `react` (^18 || ^19, optional), `viem`
  (^2).

### Not included

- Connector implementations (Farcaster, Base, Dynamic.xyz). Each consumer
  brings its own and passes `signMessage` to `signInWithWallet`/
  `useWalletSession`.
- viem on-chain helpers (receipts, contracts) — stays in App for now.
- Next-specific hooks (`useFormDraft`, `onboardingState`, `useChatClient`) —
  stays in App.
