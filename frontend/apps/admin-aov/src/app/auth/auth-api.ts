import { ApiError } from "../../lib/api/errors"

export function createAuthRequest(fetcher: typeof fetch = fetch) {
  return async function request<T>(path: "login" | "refresh" | "logout" | "google", body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetcher("/api/wiki/v1/auth/" + path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { "Content-Type": "application/json", "X-AOV-Auth": "1" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại.")
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}))
      throw new ApiError({ ...problem, status: response.status, code: problem.code ?? "HTTP_ERROR" })
    }
    return response.status === 204 ? (undefined as T) : response.json()
  }
}

export function isGoogleCompletion(event: MessageEvent, popup: Window, state: string, origin: string) {
  return (
    event.origin === origin &&
    event.source === popup &&
    event.data?.type === "aov-google-complete" &&
    event.data.state === state &&
    typeof event.data.status === "string"
  )
}
