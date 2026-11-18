/**
 * A fake backend for tests: one handler answers every request the app sends, and every request is recorded. Nothing
 * here reaches a real service.
 */
export type ApiRequest = {
  method: string
  /** Path inside the service, without `/api/wiki/v1` or `/api/community/v1`, with its query string. */
  path: string
  /** Path without the query string. */
  pathname: string
  url: URL
  service: "wiki" | "community" | "other"
  /** Parsed JSON body, or the raw body when it is not JSON. */
  body: unknown
  init?: RequestInit
}

export type Handler = (request: ApiRequest) => Response | undefined | Promise<Response | undefined>

export const json = (body: unknown, status = 200) => Response.json(body, { status })

export const noContent = () => new Response(null, { status: 204 })

export const notFound = (request: ApiRequest) =>
  json({ code: "NOT_FOUND", detail: `Unexpected ${request.method} ${request.path}` }, 404)

/** A page in the shape every list endpoint answers with. */
export const page = <T>(
  items: T[],
  { page = 0, size = Math.max(items.length, 1), totalElements = items.length } = {},
) => json({ items, page, size, totalElements })

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return body ?? undefined
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

export function apiRequest(input: RequestInfo | URL, init?: RequestInit): ApiRequest {
  const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost/")
  const prefix = url.pathname.match(/^\/api\/(wiki|community)\/v1/)
  const pathname = prefix ? url.pathname.slice(prefix[0].length) || "/" : url.pathname
  return {
    method: (init?.method ?? "GET").toUpperCase(),
    path: pathname + url.search,
    pathname,
    url,
    service: (prefix?.[1] as "wiki" | "community" | undefined) ?? "other",
    body: parseBody(init?.body),
    init,
  }
}

/**
 * A fetch that asks each handler in turn and answers 404 when none knows the request. The returned `requests` keeps
 * every request in order, so a test can check what was sent.
 */
export function fakeBackend(...handlers: Handler[]) {
  const requests: ApiRequest[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = apiRequest(input, init)
    requests.push(request)
    for (const handle of handlers) {
      const response = await handle(request)
      if (response) return response
    }
    return notFound(request)
  }
  return { fetch, requests }
}
