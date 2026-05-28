"use client";

import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { useEffect, useState } from "react";

export type FirebaseUserState = {
  user: User | null;
  loading: boolean;
};

/**
 * Subscribe to Firebase auth state.
 *
 * `loading` is `true` until the first `onAuthStateChanged` callback fires
 * — useful for guarded routes that shouldn't redirect before we know if
 * there's a persisted session.
 *
 * Pass the `Auth` instance returned by `initFirebase({...}).auth` (the
 * package no longer hardcodes a singleton lookup so hooks work from
 * libraries with their own Firebase apps).
 */
export function useFirebaseUser(auth: Auth): FirebaseUserState {
  const [state, setState] = useState<FirebaseUserState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
    return unsubscribe;
  }, [auth]);

  return state;
}
