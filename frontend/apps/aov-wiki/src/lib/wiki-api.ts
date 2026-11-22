/**
 * The Wiki's client of wiki-service. Every request of the app goes through here, so each one carries no cookie, a
 * failure keeps its HTTP status and problem code, and lists are read to their last page the same way everywhere.
 * Endpoints themselves are declared in each feature's `*-api.ts`.
 */
export const WIKI_API_ROOT = "/api/wiki/v1"

/** A failed request: the HTTP status, and the problem code when wiki-service sent one. */
export class WikiApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.name = "WikiApiError"
    this.status = status
    this.code = code
  }
}

export interface WikiRequest {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  /** Sent as JSON. */
  body?: unknown
  /** The signed-in reader's access token. Public reads never carry one, so they stay cacheable. */
  token?: string | null
  signal?: AbortSignal
  /** Gives up after this long even when the caller does not cancel. */
  timeoutMs?: number
}

export const isWikiApiError = (error: unknown, status?: number): error is WikiApiError =>
  error instanceof WikiApiError && (status === undefined || error.status === status)

async function failure(response: Response) {
  let code: string | undefined
  let detail = ""
  try {
    const problem = (await response.json()) as { code?: string; detail?: string }
    code = problem.code
    detail = problem.detail ?? ""
  } catch {
    // A body that is not problem JSON keeps the status only.
  }
  return new WikiApiError(response.status, code, detail || `Request failed with ${response.status}`)
}

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (!timeoutMs) return signal
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/** Sends one request to wiki-service and reads its JSON answer; 204 answers undefined. */
export async function wikiRequest<T>(path: string, request: WikiRequest = {}): Promise<T> {
  const { method = "GET", body, token, signal, timeoutMs } = request
  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${WIKI_API_ROOT}${path}`, {
    method,
    signal: requestSignal(signal, timeoutMs),
    credentials: "omit",
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    // A reader's own data is never served from the browser cache.
    ...(token ? { cache: "no-store" as const } : {}),
  })
  if (!response.ok) throw await failure(response)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

/** A public read. */
export const wikiGet = <T>(path: string, signal?: AbortSignal) => wikiRequest<T>(path, { signal })

export interface WikiPage<T> {
  items: T[]
  totalElements: number
}

const withPage = (params: URLSearchParams, index: number, size: number) => {
  const query = new URLSearchParams(params)
  query.set("page", String(index))
  query.set("size", String(size))
  return query
}

/** One page of a list. */
export const wikiGetPage = <T>(
  path: string,
  params: URLSearchParams,
  index: number,
  size: number,
  signal?: AbortSignal,
) => wikiGet<WikiPage<T>>(`${path}?${withPage(params, index, size)}`, signal)

/**
 * Every row of a list from page `from` on, so filtering and grouping never miss later pages. An empty page ends the
 * list whatever the total says.
 */
export async function wikiGetAll<T>(
  path: string,
  params: URLSearchParams,
  signal?: AbortSignal,
  { size = 100, from = 0 }: { size?: number; from?: number } = {},
) {
  const items: T[] = []
  for (let index = from; ; index++) {
    const slice = await wikiGetPage<T>(path, params, index, size, signal)
    items.push(...slice.items)
    if (!slice.items.length || (index + 1) * size >= slice.totalElements) return items
  }
}

/**
 * Every row of a list whose pages carry more than the rows, such as the filters of the skin collection: the first
 * page comes back whole beside the rows of all pages. Later pages are read `parallel` at a time. `ahead` pages are
 * asked for together with the first, before the total is known, for a list known to fill more than one page; a page
 * past the end is dropped.
 */
export async function wikiGetPages<Page, Item>(
  path: string,
  params: URLSearchParams,
  signal: AbortSignal | undefined,
  reading: {
    size: number
    items: (page: Page) => readonly Item[]
    total: (page: Page) => number
    parallel?: number
    ahead?: number
  },
) {
  const read = (index: number) => wikiGet<Page>(`${path}?${withPage(params, index, reading.size)}`, signal)
  const ahead = Math.max(0, reading.ahead ?? 0)
  const [first, ...early] = await Promise.all(Array.from({ length: 1 + ahead }, (_, index) => read(index)))
  const items = [...reading.items(first!)]
  const count = Math.ceil(reading.total(first!) / reading.size)
  for (const page of early.slice(0, Math.max(0, count - 1))) items.push(...reading.items(page))
  const step = Math.max(1, reading.parallel ?? 1)
  for (let index = 1 + early.length; index < count && items.length; index += step) {
    const batch = await Promise.all(Array.from({ length: Math.min(step, count - index) }, (_, at) => read(index + at)))
    const rows = batch.flatMap((page) => [...reading.items(page)])
    items.push(...rows)
    if (!rows.length) break
  }
  return { first: first!, items }
}
