import { isApiError } from "@/lib/api/errors"
import type { CaptureKind, CaptureSetFile } from "../../../server/capture-sets.ts"
import { linksByPath, listCollections, type SourceCollection } from "./files-api"

/** Where the sync tool publishes a capture collection's derived manifest (server/capture-sets.ts, ADR-030 section 8). */
export const CAPTURE_SET_FILE = "capture-manifest.json"

export interface PublishedSet<T> {
  collection: SourceCollection
  set: T
}

type SetOf<K extends CaptureKind> = Extract<CaptureSetFile, { kind: K }>

/** Sets by the SHA-256 of their file: a set downloads again only after publishing changed it. */
const parsed = new Map<string, Promise<unknown>>()
/** A look at the collections already on its way serves every query that asks meanwhile. */
const pending = new Map<CaptureKind, Promise<PublishedSet<CaptureSetFile>[]>>()

async function collectionsOf(kind: CaptureKind) {
  const collections: SourceCollection[] = []
  for (let page = 0; ; page++) {
    const slice = await listCollections(new URLSearchParams({ category: kind, page: String(page), size: "100" }))
    collections.push(...slice.items)
    if (!slice.items.length || collections.length >= slice.totalElements) return collections
  }
}

async function readSet(collection: SourceCollection): Promise<PublishedSet<CaptureSetFile> | null> {
  const links = await linksByPath(collection.id, [CAPTURE_SET_FILE])
  const link = links.items.find((item) => item.path === CAPTURE_SET_FILE)
  // Pictures arrive before their manifest, so a collection being filled is simply not offered yet.
  if (!link) return null
  let set = parsed.get(link.sha256)
  if (!set) {
    set = fetch(link.url, { credentials: "omit", redirect: "error" }).then((response) => {
      if (!response.ok) throw new Error(`Không đọc được danh mục ảnh của bộ ${collection.label}.`)
      return response.json()
    })
    parsed.set(link.sha256, set)
    set.catch(() => parsed.delete(link.sha256))
  }
  return { collection, set: (await set) as CaptureSetFile }
}

/** Every published set of one kind, as the sync tool's publish-captures left it in the private bucket. */
export function fetchPublishedSets<K extends CaptureKind>(kind: K): Promise<PublishedSet<SetOf<K>>[]> {
  const running = pending.get(kind)
  if (running) return running as Promise<PublishedSet<SetOf<K>>[]>
  const sets = (async () => {
    const read = await Promise.all((await collectionsOf(kind)).map(readSet))
    return read.filter((entry): entry is PublishedSet<CaptureSetFile> => !!entry && entry.set.kind === kind)
  })().finally(() => pending.delete(kind))
  pending.set(kind, sets)
  return sets as Promise<PublishedSet<SetOf<K>>[]>
}

/** An account without catalog:read cannot open source files; its screens leave the evidence out instead of failing. */
export const isSourceAccessDenied = (error: unknown) => isApiError(error) && error.status === 403
