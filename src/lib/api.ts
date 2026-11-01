/**
 * Bharosa API client. All data (live forecast cycle, scorecard, accounts) comes from the backend;
 * errors are raised as ApiError with a human-readable message (status 0 = server unreachable).
 */

// Production builds default to the same origin (the API is served under /api on Vercel); dev uses the local uvicorn.
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "")).replace(/\/$/, "");

export class ApiError extends Error {
  /** HTTP status; 0 means the server could not be reached. */
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const OFFLINE_MESSAGE =
  "The forecast service is temporarily unavailable. Please try again shortly.";

interface FastApiValidationError {
  loc?: (string | number)[];
  msg?: string;
}

function describe(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as FastApiValidationError;
    const field = first.loc?.[first.loc.length - 1];
    const msg = (first.msg ?? "Invalid value").replace(/^Value error, /, "");
    return field && typeof field === "string" && !msg.toLowerCase().includes(field) ? `${field}: ${msg}` : msg;
  }
  return status >= 500 ? "The server hit an error. Please try again." : `Request failed (${status})`;
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  { body, token, timeoutMs = 8000 }: { body?: unknown; token?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    text = await res.text(); // inside the try: the timeout also covers a slow download
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // An unparseable success body is a server bug; surface it instead of rendering nothing.
    if (res.ok) throw new ApiError(res.status, "The server sent data this app could not read (invalid JSON).");
  }
  if (!res.ok) throw new ApiError(res.status, describe((data as { detail?: unknown } | null)?.detail, res.status));
  return data as T;
}
