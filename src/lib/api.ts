/**
 * AtmosFusion API client. All data (live forecast cycle, scorecard, accounts) comes from the backend;
 * errors are raised as ApiError with a human-readable message (status 0 = server unreachable).
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  /** HTTP status; 0 means the server could not be reached. */
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const OFFLINE_MESSAGE =
  "Can't reach the AtmosFusion server. Start it with: uvicorn main:app --port 8000 (in backend/).";

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
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, describe((data as { detail?: unknown } | null)?.detail, res.status));
  return data as T;
}
