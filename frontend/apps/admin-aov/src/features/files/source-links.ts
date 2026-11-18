import { useCallback } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { linksBySha256 } from "./files-api"

/** Links live 10 minutes (ADR-030 section 6); an older one is asked again before an image needs it. */
export const SOURCE_LINK_FRESH_MS = 8 * 60_000
/** A link this young that fails to load points at a real problem, not at an expired signature. */
const RETRY_AFTER_MS = 60_000
const BATCH = 200
const SHA256 = /^[0-9a-f]{64}$/

export interface SourceImageLink {
  sha256: string
  url: string
  expiresAt: string
}

interface Waiting {
  sha256: string
  resolve: (link: SourceImageLink | null) => void
  reject: (error: unknown) => void
}

let waiting: Waiting[] = []
let scheduled = false

async function flush() {
  const batch = waiting
  waiting = []
  scheduled = false
  const unique = [...new Set(batch.map((entry) => entry.sha256))]
  for (let start = 0; start < unique.length; start += BATCH) {
    const chunk = new Set(unique.slice(start, start + BATCH))
    const callers = batch.filter((entry) => chunk.has(entry.sha256))
    try {
      const response = await linksBySha256([...chunk])
      const found = new Map<string, SourceImageLink>(response.items.map((link) => [link.sha256, link]))
      for (const entry of callers) entry.resolve(found.get(entry.sha256) ?? null)
    } catch (error) {
      for (const entry of callers) entry.reject(error)
    }
  }
}

/** Links asked for in the same moment leave as one request per 200 pictures, however many images ask. */
export function loadSourceLink(sha256: string): Promise<SourceImageLink | null> {
  return new Promise((resolve, reject) => {
    waiting.push({ sha256, resolve, reject })
    if (scheduled) return
    scheduled = true
    setTimeout(() => void flush(), 0)
  })
}

export const sourceLinkKey = (sha256: string) => ["source-link", sha256] as const

export interface SourceUrls {
  /** The picture's presigned link; undefined while it loads, when its bytes are not stored, or after a failure. */
  url: (sha256: string | null | undefined) => string | undefined
  /** True when the backend knows no stored bytes for the picture, or could not be asked. */
  failed: (sha256: string | null | undefined) => boolean
  /** Asks again for a link that stopped loading; false when the link is too young to have expired. */
  retry: (sha256: string | null | undefined) => boolean
}

/** Presigned links for pictures of the private bucket (evidence captures), by SHA-256. */
export function useSourceUrls(sha256s: readonly (string | null | undefined)[]): SourceUrls {
  const client = useQueryClient()
  const unique = [...new Set(sha256s.filter((value): value is string => !!value && SHA256.test(value)))]
  const results = useQueries({
    queries: unique.map((sha256) => ({
      queryKey: sourceLinkKey(sha256),
      queryFn: () => loadSourceLink(sha256),
      staleTime: SOURCE_LINK_FRESH_MS,
      gcTime: SOURCE_LINK_FRESH_MS,
      retry: 1,
    })),
  })
  const state = new Map(unique.map((sha256, index) => [sha256, results[index]!]))

  const retry = useCallback(
    (sha256: string | null | undefined) => {
      if (!sha256) return false
      const query = client.getQueryState(sourceLinkKey(sha256))
      if (!query || Date.now() - query.dataUpdatedAt < RETRY_AFTER_MS) return false
      void client.invalidateQueries({ queryKey: sourceLinkKey(sha256) })
      return true
    },
    [client],
  )
  return {
    url: (sha256) => (sha256 ? (state.get(sha256)?.data?.url ?? undefined) : undefined),
    failed: (sha256) => {
      const result = sha256 ? state.get(sha256) : undefined
      return !!result && (result.isError || (result.isSuccess && result.data === null))
    },
    retry,
  }
}

export function useSourceUrl(sha256: string | null | undefined) {
  const urls = useSourceUrls([sha256])
  return { url: urls.url(sha256), failed: urls.failed(sha256), retry: () => urls.retry(sha256) }
}
