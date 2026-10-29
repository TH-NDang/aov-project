import { ApiError } from "./errors"

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
    const timeout = AbortSignal.timeout(15000)
    const response = await fetcher(`${apiBase}${path}`, {
      ...init,
      headers,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    })
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
    const body = await response.text()
    return body.trim() ? (JSON.parse(body) as T) : (undefined as T)
  }
}
