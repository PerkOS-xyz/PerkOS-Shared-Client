/**
 * `fetch` wrapper that auto-attaches an `Authorization: Bearer <idToken>`
 * header (when `getIdToken` is supplied) and parses JSON responses.
 *
 * Designed to talk to the platform-level PerkOS API (`api.perkos.xyz`) but
 * works against any JSON HTTP backend.
 *
 * Usage:
 *   const api = createApiClient({
 *     baseUrl: "https://api.perkos.xyz",
 *     getIdToken: () => firebaseAuth.currentUser?.getIdToken() ?? null,
 *   });
 *   const me = await api.get<User>("/v1/users/me");
 */

import { ApiError } from "./types";

export type ApiClientOptions = {
  /** e.g. "https://api.perkos.xyz" — trailing slash optional. */
  baseUrl: string;
  /** Returns a Firebase ID token (or null when signed out). Optional. */
  getIdToken?: () => Promise<string | null>;
  /** Headers merged into every request. Per-call init.headers wins. */
  defaultHeaders?: Record<string, string>;
};

export type ApiClient = {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
  /** Lower-level escape hatch — returns the raw `Response`. */
  fetch(path: string, init?: RequestInit): Promise<Response>;
};

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = baseUrl.replace(/\/+$/, "");
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}

async function parseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  const text = await res.text();
  return text.length > 0 ? text : null;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const maybe = body as { error?: unknown; message?: unknown };
    if (typeof maybe.error === "string") return maybe.error;
    if (typeof maybe.message === "string") return maybe.message;
  }
  if (typeof body === "string" && body.length > 0) return body;
  return `Request failed with HTTP ${status}.`;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const { baseUrl, getIdToken, defaultHeaders = {} } = opts;
  if (!baseUrl) {
    throw new Error("createApiClient: `baseUrl` is required.");
  }

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(defaultHeaders);
    if (init.headers) {
      const overlay = new Headers(init.headers);
      overlay.forEach((value, key) => headers.set(key, value));
    }

    if (getIdToken && !headers.has("authorization")) {
      const token = await getIdToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
    }

    if (init.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return fetch(joinUrl(baseUrl, path), { ...init, headers });
  }

  async function callJson<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const res = await call(path, init);
    const body = await parseBody(res);
    if (!res.ok) {
      throw new ApiError(res.status, extractErrorMessage(body, res.status), body);
    }
    return body as T;
  }

  function withBody(
    method: string,
    path: string,
    body?: unknown,
    init: RequestInit = {}
  ): Promise<Response> {
    return call(path, {
      ...init,
      method,
      body: body === undefined ? init.body : JSON.stringify(body),
    });
  }

  return {
    fetch: call,
    get: <T>(path: string, init?: RequestInit) =>
      callJson<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: RequestInit) =>
      withBody("POST", path, body, init).then(async (res) => {
        const parsed = await parseBody(res);
        if (!res.ok) {
          throw new ApiError(
            res.status,
            extractErrorMessage(parsed, res.status),
            parsed
          );
        }
        return parsed as T;
      }),
    put: <T>(path: string, body?: unknown, init?: RequestInit) =>
      withBody("PUT", path, body, init).then(async (res) => {
        const parsed = await parseBody(res);
        if (!res.ok) {
          throw new ApiError(
            res.status,
            extractErrorMessage(parsed, res.status),
            parsed
          );
        }
        return parsed as T;
      }),
    patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
      withBody("PATCH", path, body, init).then(async (res) => {
        const parsed = await parseBody(res);
        if (!res.ok) {
          throw new ApiError(
            res.status,
            extractErrorMessage(parsed, res.status),
            parsed
          );
        }
        return parsed as T;
      }),
    delete: <T>(path: string, init?: RequestInit) =>
      callJson<T>(path, { ...init, method: "DELETE" }),
  };
}

export { ApiError } from "./types";
