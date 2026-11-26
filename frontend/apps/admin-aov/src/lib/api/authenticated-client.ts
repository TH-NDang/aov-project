import { ApiError } from "./errors"

/** Milliseconds a request may take until its answer is read. */
const TIMEOUT_MS = 15_000

/**
 * A request without an answer carries no code a screen could choose its words by, and the browser's own words are
 * English, so it is told here in the words of Admin. One that its caller gave up keeps the caller's reason.
 */
function unanswered(error: unknown, timeout: AbortSignal, given: AbortSignal | null | undefined): unknown {
  if (given?.aborted) return error
  if (timeout.aborted)
    return new Error(`Máy chủ chưa trả lời sau ${TIMEOUT_MS / 1000} giây. Hãy thử lại.`, { cause: error })
  // A fetch that reached nobody rejects with a TypeError.
  if (error instanceof TypeError)
    return new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", { cause: error })
  return error
}

/** Fixed same-origin API prefixes prevent credentials from leaking to another origin. */
export function createAuthenticatedClient(
  getToken: () => Promise<string>,
  onUnauthorized: () => void,
  fetcher: typeof fetch = fetch,
  apiBase: "/api/wiki/v1" | "/api/community/v1" = "/api/wiki/v1",
) {
  if (!["/api/wiki/v1", "/api/community/v1"].includes(apiBase)) throw new Error("Invalid API base")
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!/^\/[a-zA-Z0-9/_-]*(?:\?[^#]*)?$/.test(path)) throw new Error("Invalid API path")
    const token = await getToken()
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${token}`)
    headers.set("Accept", "application/json")
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json")
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    const answered = <R>(answer: Promise<R>) =>
      answer.catch((error: unknown): never => {
        throw unanswered(error, timeout, init.signal)
      })
    const response = await answered(
      fetcher(`${apiBase}${path}`, {
        ...init,
        headers,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      }),
    )
    if (!response.ok) {
      if (response.status === 401) onUnauthorized()
      const problem = await response.json().catch(() => ({}))
      throw new ApiError({
        ...problem,
        status: response.status,
        code:
          problem.code ??
          (response.status === 401 ? "UNAUTHENTICATED" : response.status === 403 ? "FORBIDDEN" : "HTTP_ERROR"),
      })
    }
    if (response.status === 204 || response.status === 205) return undefined as T
    const body = await answered(response.text())
    return body.trim() ? (JSON.parse(body) as T) : (undefined as T)
  }
}
