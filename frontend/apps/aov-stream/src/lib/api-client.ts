import type { PageSlice } from "@aov/community-contracts"

/**
 * Stream's client of its two services: community-service for tournaments and pages, wiki-service for the shared user
 * profile. Every request of the app goes through here, so none carries a cookie, each gives up after 20 seconds and a
 * failure keeps its HTTP status and problem code for the screen to choose its words. Endpoints are declared in each
 * feature's `*-api.ts`.
 */
export const COMMUNITY_API_ROOT = "/api/community/v1"
export const WIKI_API_ROOT = "/api/wiki/v1"

const TIMEOUT_MS = 20_000

/** A failed request: the HTTP status and the problem code, empty when the service sent none. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export interface ApiRequest {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  /** Sent as JSON. */
  body?: unknown
  signal?: AbortSignal
}

export interface ApiClient {
  /** The service's root, such as `/api/community/v1`. */
  root: string
  /** The reader's token for this path, or nothing for a public read. */
  token: (path: string) => Promise<string | null | undefined> | string | null | undefined
  /** The words of a failure, from its status and problem. */
  describe: (status: number, problem: { code?: string; detail?: string }) => string
  fetcher?: typeof fetch
}

export function createApiRequest({ root, token, describe, fetcher }: ApiClient) {
  return async function request<T>(path: string, { method, body, signal }: ApiRequest = {}): Promise<T> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    const bearer = await token(path)
    const headers: Record<string, string> = {}
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (bearer) headers.Authorization = `Bearer ${bearer}`
    const response = await (fetcher ?? fetch)(`${root}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers,
      credentials: "omit",
      // A reader's own data is never served from the browser cache.
      ...(bearer ? { cache: "no-store" as const } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as { code?: string; detail?: string }
      throw new ApiError(response.status, problem.code ?? "", describe(response.status, problem))
    }
    const text = await response.text()
    return text ? (JSON.parse(text) as T) : (undefined as T)
  }
}

/**
 * Every row of a list, page by page, so filtering, grouping and follow buttons never silently miss later pages. An
 * empty page ends the list whatever the total says.
 */
export async function readAllPages<T>(
  read: (path: string, request?: ApiRequest) => Promise<PageSlice<T>>,
  path: string,
  { signal, size = 50 }: { signal?: AbortSignal; size?: number } = {},
) {
  const items: T[] = []
  for (let page = 0; ; page += 1) {
    const result = await read(`${path}${path.includes("?") ? "&" : "?"}page=${page}&size=${size}`, { signal })
    items.push(...result.items)
    if (!result.items.length || (result.page + 1) * result.size >= result.totalElements) return items
  }
}
