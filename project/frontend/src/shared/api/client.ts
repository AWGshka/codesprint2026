import { env } from "~/shared/config/env";

/** Thrown for any non-2xx response. Carries the HTTP status for branching. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Shape rendered by the backend's global error handler: `{ error: { code, message, details? } }`. */
interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return Boolean(
    value && typeof value === "object" && "error" in value && value.error && typeof value.error === "object" && "message" in (value.error as object),
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      // include credentials so the auth session cookie rides cross-origin.
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (cause) {
    // Network / CORS failures never reach the status check below.
    throw new ApiError("Network request failed", 0, cause);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = isErrorEnvelope(body) ? body.error.message : res.statusText || "Request failed";
    throw new ApiError(message, res.status, body);
  }

  // 204 No Content and empty bodies should not be parsed as JSON.
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  // Success envelope is always `{ data: <payload> }` — unwrap it so every caller works with the payload directly.
  if (json && typeof json === "object" && "data" in json) return (json as { data: T }).data;
  return json as T;
}

/** Reads the error envelope's `code` off a caught ApiError, if present (e.g. `"PAYMENT_DECLINED"`). */
export const apiErrorCode = (err: unknown): string | undefined => (err instanceof ApiError && isErrorEnvelope(err.body) ? err.body.error.code : undefined);

/** Minimal typed HTTP client. Add verbs as the API surface grows. */
export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),

  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),

  del: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "DELETE" }),
};
