# @perkos/shared-client

Shared client library for PerkOS apps. Bundles the wallet sign-in flow, an
auth-aware API client, Firebase init helpers, format utilities, Zod
validators, and React hooks that glue everything together so App, Admin,
Desktop, and future PerkOS surfaces don't each reimplement them.

The package is framework-agnostic at the core (works from CLI / Tauri /
plain Node) and ships React hooks under a separate `@perkos/shared-client/hooks`
entry so consumers without React can avoid the peer dep.

## Install

```bash
npm install @perkos/shared-client firebase viem
# plus react if you want the hooks
npm install react
```

### Peer dependencies

| Peer | Required? | Why |
|---|---|---|
| `firebase` (^10 \|\| ^11) | yes | Auth + Firestore handles returned by `initFirebase`. |
| `viem` (^2) | optional | Only needed if the consumer types its `address` as `viem`'s `Address` (the package itself uses ``` `0x${string}` ``` literals). |
| `react` (^18 \|\| ^19) | optional | Only needed when importing from `@perkos/shared-client/hooks`. |
| `@perkos/shared-types` (^0.1) | optional | Once published, supplies `ApiError`, `WalletSigninResponse`, etc. Until then this package ships inline fallback declarations under `./dist/types.*`. |

## Usage

### 1. Initialise Firebase (once at app startup)

```ts
import { initFirebase } from "@perkos/shared-client";

const { app, auth, db } = initFirebase({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
});
```

`initFirebase` is idempotent — call it from your root layout / provider and
re-call `getFirebase()` anywhere else.

### 2. Sign in with a wallet (no React required)

```ts
import { signInWithWallet, initFirebase } from "@perkos/shared-client";
import { signInWithCustomToken } from "firebase/auth";

const { auth } = initFirebase(firebaseConfig);

const session = await signInWithWallet({
  address: "0xAbC…",
  signMessage: (msg) => wallet.signMessage(msg),
  apiBase: "https://api.perkos.xyz",
});
await signInWithCustomToken(auth, session.token);
```

The helper performs the three-step handshake (nonce → wallet signature →
custom-token exchange) and returns the server response. Calling
`signInWithCustomToken` is left to the consumer so it can run extra logic
(analytics, role checks, etc.) before finalising the Firebase session.

### 3. Use the React hook in Next.js or any React app

```tsx
"use client";

import { useWalletSession } from "@perkos/shared-client/hooks";
import { useAccount, useSignMessage } from "wagmi";

const { address } = useAccount();
const { signMessageAsync } = useSignMessage();

const session = useWalletSession({
  apiBase: "https://api.perkos.xyz",
  address,
  signMessage: (m) => signMessageAsync({ message: m }),
  auth,                       // from initFirebase
  requireRole: null,          // or "super_admin" for the Admin app
  requireAccess: true,        // ignore on CLI tools that allow anyone
});

switch (session.status) {
  case "loading":         return <Spinner />;
  case "signed-out":      return <ConnectButton />;
  case "signing":         return <Spinner label="Signing in…" />;
  case "not-allowlisted": return <AccessGate />;
  case "wrong-role":      return <Unauthorized />;
  case "error":           return <Retry onClick={session.retry} />;
  case "signed-in":       return <App />;
}
```

### 4. Call the API with the user's Firebase ID token attached automatically

```ts
import { createApiClient, initFirebase } from "@perkos/shared-client";

const { auth } = initFirebase(firebaseConfig);
const api = createApiClient({
  baseUrl: "https://api.perkos.xyz",
  getIdToken: () => auth.currentUser?.getIdToken() ?? Promise.resolve(null),
});

const me = await api.get<{ uid: string; role: string }>("/v1/users/me");
```

Any non-2xx response throws `ApiError` with the parsed body attached.

## Configuration

The package does **not** read `process.env` itself. Consumers pass config
explicitly so the same lib works under Next.js, Vite, Electron, Tauri, or a
plain Node CLI. For Next.js the typical env vars to expose to the browser
are:

```
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
NEXT_PUBLIC_FIREBASE_PROJECT_ID=…
NEXT_PUBLIC_FIREBASE_APP_ID=…
NEXT_PUBLIC_PERKOS_API_BASE=https://api.perkos.xyz
```

Wire them into `initFirebase({...})` and `createApiClient({ baseUrl })` at
startup.

## Versioning

This package uses [SemVer](https://semver.org/). The `0.x` line allows
breaking changes between minor releases until the platform-level API
(`api.perkos.xyz`) stabilises. Until 1.0, pin the exact version in
consumers.

## Related packages

- `@perkos/shared-types` — TypeScript types and Zod schemas shared with
  the PerkOS-API server (peer dep; once published it provides the real
  `ApiError` / `WalletSigninResponse` symbols re-exported here).
- `@perkos/perkos-a2a` — A2A protocol bridge plugin (independent of this
  package).

## License

MIT (c) 2026 PerkOS.
