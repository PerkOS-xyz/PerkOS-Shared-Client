"use client";

import {
  signInWithCustomToken,
  signOut,
  type Auth,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

import { signInWithWallet } from "../walletAuth";
import { useFirebaseUser } from "./useFirebaseUser";

export type SessionStatus =
  /** waiting for Firebase auth state to settle */
  | "loading"
  /** no wallet connected — caller should render a connect button */
  | "signed-out"
  /** mid-handshake (nonce, signature, custom-token exchange) */
  | "signing"
  /** wallet connected, Firebase signed in, addresses match */
  | "signed-in"
  /** server denied because the wallet isn't on the allowlist */
  | "not-allowlisted"
  /** server signed us in but the user lacks the required role */
  | "wrong-role"
  /** unrecoverable error (signature rejected, network down, etc.) */
  | "error";

/** Roles known to the platform — extend as the API grows. */
export type Role = "super_admin" | "user";

export type UseWalletSessionOptions = {
  apiBase: string;
  /** Wallet address (or undefined while wagmi is reconnecting). */
  address: `0x${string}` | undefined;
  /** Signs an arbitrary message. Typically `(m) => signMessageAsync({ message: m })`. */
  signMessage: (message: string) => Promise<`0x${string}`>;
  /** Firebase Auth instance returned by `initFirebase({...}).auth`. */
  auth: Auth;
  /**
   * Require the signed-in user to have a specific role. Set to "super_admin"
   * for the Admin app, leave undefined for App / Desktop.
   *
   * Role is read from the custom-claim on the Firebase ID token; an unmet
   * requirement yields `status: "wrong-role"`.
   */
  requireRole?: Role | null;
  /**
   * Require the wallet to be allowlisted. The hook treats any sign-in error
   * whose message includes "allowlist" as `status: "not-allowlisted"`; set
   * this `false` to disable the heuristic (e.g. CLI tools that allow anyone).
   */
  requireAccess?: boolean;
  /** Called once after a successful sign-in. */
  onSignedIn?: (uid: string) => void;
};

export type UseWalletSessionResult = {
  status: SessionStatus;
  error: Error | null;
  retry: () => void;
  /** Signs out of Firebase. Wallet disconnect is the caller's responsibility. */
  signOutFirebase: () => Promise<void>;
};

/**
 * One hook to glue wagmi (or any signer) + Firebase Auth + the PerkOS API
 * together.
 *
 * Reconciled from App's `useWalletSession.ts` (which has the in-flight
 * promise mutex to avoid duplicate signature prompts) and Admin's
 * `useWalletSession.ts` (which adds the super-admin role check). All
 * Next.js-specific bits — wagmi imports, module-level mutex — have been
 * parameterised so this hook works inside Tauri/CLI consumers too.
 */
let pendingSignIn: Promise<unknown> | null = null;

export function useWalletSession(
  opts: UseWalletSessionOptions
): UseWalletSessionResult {
  const {
    apiBase,
    address,
    signMessage,
    auth,
    requireRole = null,
    requireAccess = true,
    onSignedIn,
  } = opts;

  const { user, loading } = useFirebaseUser(auth);

  const [signing, setSigning] = useState(false);
  const [denial, setDenial] = useState<
    "not-allowlisted" | "wrong-role" | "error" | null
  >(null);
  const [error, setError] = useState<Error | null>(null);

  const normalized = address?.toLowerCase();
  const inSync =
    user && normalized ? user.uid === normalized : false;

  const runSignIn = useCallback(async () => {
    if (!address || !normalized) return;

    // Coalesce concurrent calls so we only show the wallet's signature
    // prompt once even when multiple guarded routes mount in parallel.
    if (pendingSignIn) {
      setSigning(true);
      try {
        await pendingSignIn;
      } catch {
        /* owner handled it */
      } finally {
        setSigning(false);
      }
      return;
    }

    setSigning(true);
    setDenial(null);
    setError(null);

    const promise = (async () => {
      const session = await signInWithWallet({
        address,
        signMessage,
        apiBase,
      });
      const credential = await signInWithCustomToken(auth, session.token);

      if (requireRole) {
        const tokenResult = await credential.user.getIdTokenResult(true);
        const role = tokenResult.claims["role"] as Role | undefined;
        if (role !== requireRole) {
          await signOut(auth);
          throw new Error(`wrong-role: required ${requireRole}, got ${role ?? "none"}`);
        }
      }

      onSignedIn?.(credential.user.uid);
      return credential.user;
    })();

    pendingSignIn = promise;

    try {
      await promise;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const msg = e.message.toLowerCase();
      if (msg.startsWith("wrong-role")) {
        setDenial("wrong-role");
      } else if (requireAccess && msg.includes("allowlist")) {
        setDenial("not-allowlisted");
      } else {
        setDenial("error");
      }
      setError(e);
    } finally {
      if (pendingSignIn === promise) pendingSignIn = null;
      setSigning(false);
    }
  }, [
    address,
    normalized,
    signMessage,
    apiBase,
    auth,
    requireRole,
    requireAccess,
    onSignedIn,
  ]);

  // Auto-run the handshake when wagmi presents an address that doesn't
  // match Firebase's current user.
  useEffect(() => {
    if (loading) return;
    if (!normalized) return;
    if (inSync) return;
    if (signing) return;
    if (denial) return;
    void runSignIn();
  }, [loading, normalized, inSync, signing, denial, runSignIn]);

  // If the wallet disconnects, drop the Firebase session so the next
  // wallet doesn't inherit it.
  useEffect(() => {
    if (!address && user) {
      void signOut(auth);
    }
  }, [address, user, auth]);

  const status: SessionStatus = (() => {
    if (loading) return "loading";
    if (!normalized) return "signed-out";
    if (denial === "not-allowlisted") return "not-allowlisted";
    if (denial === "wrong-role") return "wrong-role";
    if (denial === "error") return "error";
    if (signing) return "signing";
    if (inSync) return "signed-in";
    return "signing";
  })();

  return {
    status,
    error,
    retry: runSignIn,
    signOutFirebase: () => signOut(auth),
  };
}
