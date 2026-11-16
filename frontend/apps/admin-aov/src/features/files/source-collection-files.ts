import { backendRequest } from "@/app/auth/session"
import type { PageSlice } from "../publishing/types"
import type { SourceCollection } from "./files-api"

const BATCH = 200

/** The collection with exactly this code, or null. */
export async function findSourceCollection(code: string): Promise<SourceCollection | null> {
  const page = await backendRequest<PageSlice<SourceCollection>>(
    `/admin/source-collections?q=${encodeURIComponent(code)}&size=100`,
  )
  return page.items.find((item) => item.code === code) ?? null
}

/** Presigned links by path, 200 per request; a path the collection does not hold is left out. */
export async function sourceFileLinks(collectionId: string, paths: readonly string[]) {
  const links = new Map<string, string>()
  const unique = [...new Set(paths)]
  for (let start = 0; start < unique.length; start += BATCH) {
    const response = await backendRequest<{ items: { path: string; url: string }[] }>(
      `/admin/source-collections/${collectionId}/links`,
      { method: "POST", body: JSON.stringify({ paths: unique.slice(start, start + BATCH) }) },
    )
    for (const item of response.items) links.set(item.path, item.url)
  }
  return links
}

/** Fetches the bytes behind a presigned link; they come from R2, never through the backend (ADR-030). */
export function fetchSourceFile(url: string) {
  return fetch(url, { credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" })
}

/** One collection's files, for the importers that read source data in place of the old resources folder. */
export async function openSourceCollection(code: string) {
  const collection = await findSourceCollection(code)
  if (!collection) throw new Error(`Chưa có bộ tệp nguồn ${code} trong Quản lý tệp.`)
  return {
    collection,
    links: (paths: readonly string[]) => sourceFileLinks(collection.id, paths),
    async json<T>(path: string): Promise<T> {
      const url = (await sourceFileLinks(collection.id, [path])).get(path)
      if (!url) throw new Error(`Bộ tệp nguồn ${code} chưa có ${path}.`)
      const response = await fetchSourceFile(url)
      if (!response.ok) throw new Error(`Không đọc được ${path} trong bộ tệp nguồn ${code}.`)
      return (await response.json()) as T
    },
  }
}
