import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { backendRequest } from "@/app/auth/session"
import type { PageSlice } from "@/lib/hero-types"

/** Functions a collection of private source files serves (ADR-030); the order is the browsing order. */
export const SOURCE_CATEGORIES = [
  "HERO_CAPTURE",
  "SHOP_CAPTURE",
  "BUILD_CAPTURE",
  "RANKING_CAPTURE",
  "GAME_MODE_SOURCE",
  "ESPORTS_SOURCE",
  "IMPORT_DATA",
  "ARCHIVE",
] as const
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number]

export interface SourceCollection {
  id: string
  code: string
  category: SourceCategory
  label: string
  note: string | null
  capturedOn: string | null
  fileCount: number
  totalBytes: number
  updatedAt: string
  version: number
}

export interface SourceFile {
  id: string
  path: string
  sha256: string
  sizeBytes: number
  contentType: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface SourceFileUsage {
  ownerDomain: string
  ownerType: string
  ownerId: string
  ownerName: string | null
  role: string
}

export interface SourceFileDetails extends SourceFile {
  collection: { id: string; code: string; category: SourceCategory; label: string }
  otherPlaces: { fileId: string; collectionCode: string; path: string }[]
  usages: SourceFileUsage[]
}

export interface SourceLink {
  sha256: string
  url: string
  expiresAt: string
  contentType: string
  sizeBytes: number
}

export interface SourceOrphan {
  sha256: string
  sizeBytes: number
  contentType: string
  firstPath: string
  createdAt: string
  state: "READY" | "DELETING"
}

export type CapacityLevel = "OK" | "WARNING" | "CRITICAL" | "OVER"
export type BucketRole = "MEDIA_ASSETS" | "SOURCES" | "STAGING"

export interface StorageBucket {
  role: BucketRole
  bucket: string
  files: number
  bytes: number
  orphanFiles: number | null
  orphanBytes: number | null
  groups: { key: string; files: number; bytes: number }[]
}

export interface CloudflareBucket {
  bucket: string
  objects: number
  bytes: number
  pendingUploads: number
}

export interface StorageSummary {
  generatedAt: string
  bytesPerGigabyte: number
  freeTier: { storageBytes: number; classAOperations: number; classBOperations: number }
  prices: { storageUsdPerGigabyteMonth: number; classAUsdPerMillion: number; classBUsdPerMillion: number }
  thresholds: { warning: number; critical: number }
  buckets: StorageBucket[]
  storage: { source: "DATABASE" | "CLOUDFLARE"; bytes: number; share: number; level: CapacityLevel }
  operations: {
    source: "ESTIMATE" | "CLOUDFLARE"
    month: string
    classA: number
    classB: number
    classAShare: number
    classBShare: number
    classALevel: CapacityLevel
    classBLevel: CapacityLevel
  }
  months: { month: string; files: number; bytes: number; classA: number; classB: number }[]
  cloudflare: {
    state: "NOT_CONFIGURED" | "OK" | "UNAVAILABLE"
    checkedAt: string | null
    buckets: CloudflareBucket[] | null
    operations: { from: string; to: string; classA: number; classB: number; free: number } | null
  }
}

export interface StorageEstimate {
  target: "MEDIA" | "SOURCES"
  files: number
  bytes: number
  knownFiles: number
  knownBytes: number
  newFiles: number
  newBytes: number
  classA: number
  classB: number
  storageBytesAfter: number
  storageShareAfter: number
  level: CapacityLevel
}

export const fileKeys = {
  summary: ["storage", "summary"] as const,
  collections: (category: SourceCategory | null, query: string) =>
    ["source-collections", category ?? "ALL", query] as const,
  allCollections: ["source-collections"] as const,
  collection: (id: string) => ["source-collection", id] as const,
  anyCollection: ["source-collection"] as const,
  files: (collectionId: string, query: string) => ["source-files", collectionId, query] as const,
  allFiles: ["source-files"] as const,
  file: (id: string) => ["source-file", id] as const,
  link: (sha256: string) => ["source-link", sha256] as const,
  anyFile: ["source-file"] as const,
  orphans: ["source-orphans"] as const,
  links: (sha256s: readonly string[]) => ["source-links", ...sha256s] as const,
}

/** What asking to store a file answers: bytes already in R2 are placed at once, others need a presigned PUT. */
export type UploadResult =
  | { status: "STORED"; file: SourceFile; upload: null }
  | {
      status: "UPLOAD_REQUIRED"
      file: null
      upload: {
        uploadId: string
        method: string
        uploadUrl: string
        headers: Record<string, string>
        expiresAt: string
      }
    }

// Every endpoint of private source files (ADR-030). Helpers elsewhere in the feature batch or combine these calls.

export function listCollections(params: URLSearchParams, signal?: AbortSignal) {
  return backendRequest<PageSlice<SourceCollection>>(`/admin/source-collections?${params}`, { signal })
}

/** Presigned GET links by SHA-256, at most 200 per request. */
export function linksBySha256(sha256s: readonly string[], signal?: AbortSignal) {
  return backendRequest<{ items: SourceLink[]; missing: string[] }>("/admin/source-files/links", {
    method: "POST",
    body: JSON.stringify({ sha256: sha256s }),
    signal,
  })
}

/** Presigned GET links by path inside one collection, at most 200 per request. */
export function linksByPath(collectionId: string, paths: readonly string[]) {
  return backendRequest<{ items: { path: string; sha256: string; url: string }[] }>(
    `/admin/source-collections/${collectionId}/links`,
    { method: "POST", body: JSON.stringify({ paths }) },
  )
}

export function requestUpload(
  collectionId: string,
  body: {
    path: string
    sha256: string
    sizeBytes: number
    contentType: string
    replace?: { fileId: string; expectedVersion: number }
  },
  signal?: AbortSignal,
) {
  return backendRequest<UploadResult>(`/admin/source-collections/${collectionId}/uploads`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })
}

export function completeUpload(uploadId: string, signal?: AbortSignal) {
  return backendRequest<{ file: SourceFile }>(`/admin/source-uploads/${uploadId}/complete`, { method: "POST", signal })
}

const PAGE = 50

export function useStorageSummary() {
  return useQuery({
    queryKey: fileKeys.summary,
    queryFn: ({ signal }) => backendRequest<StorageSummary>("/admin/storage/summary", { signal }),
    staleTime: 60_000,
  })
}

export function useSourceCollections(category: SourceCategory | null, query: string) {
  return useInfiniteQuery({
    queryKey: fileKeys.collections(category, query),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ page: String(pageParam), size: String(PAGE) })
      if (category) params.set("category", category)
      if (query.trim()) params.set("q", query.trim())
      return listCollections(params, signal)
    },
    getNextPageParam: nextPageOf,
  })
}

export function useSourceCollection(id: string | null) {
  return useQuery({
    queryKey: fileKeys.collection(id ?? ""),
    queryFn: ({ signal }) => backendRequest<SourceCollection>(`/admin/source-collections/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useSourceFiles(collectionId: string | null, query: string) {
  return useInfiniteQuery({
    queryKey: fileKeys.files(collectionId ?? "", query),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ page: String(pageParam), size: String(PAGE) })
      if (query.trim()) params.set("q", query.trim())
      return backendRequest<PageSlice<SourceFile>>(`/admin/source-collections/${collectionId}/files?${params}`, {
        signal,
      })
    },
    getNextPageParam: nextPageOf,
    enabled: !!collectionId,
  })
}

export function useSourceFile(id: string | null) {
  return useQuery({
    queryKey: fileKeys.file(id ?? ""),
    queryFn: ({ signal }) => backendRequest<SourceFileDetails>(`/admin/source-files/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useSourceOrphans(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: fileKeys.orphans,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      backendRequest<PageSlice<SourceOrphan>>(`/admin/source-objects/orphans?page=${pageParam}&size=${PAGE}`, {
        signal,
      }),
    getNextPageParam: nextPageOf,
    enabled,
  })
}

/** Links live 10 minutes; they are asked again well before that, so an open screen never shows a dead link. */
const LINK_STALE_MS = 6 * 60_000

/** Presigned GET links for images and files of the private bucket, one request per screenful (at most 200). */
export function useSourceLinks(sha256s: readonly string[]) {
  const unique = [...new Set(sha256s)].sort()
  return useQuery({
    queryKey: fileKeys.links(unique),
    queryFn: async ({ signal }) => {
      const links: Record<string, SourceLink> = {}
      for (let start = 0; start < unique.length; start += 200) {
        const response = await linksBySha256(unique.slice(start, start + 200), signal)
        for (const link of response.items) links[link.sha256] = link
      }
      return links
    },
    enabled: unique.length > 0,
    staleTime: LINK_STALE_MS,
    gcTime: LINK_STALE_MS,
    refetchInterval: LINK_STALE_MS,
  })
}

export async function downloadLink(fileId: string) {
  return backendRequest<{ url: string; expiresAt: string }>(`/admin/source-files/${fileId}/download-link`, {
    method: "POST",
  })
}

export async function createCollection(input: {
  code: string
  category: SourceCategory
  label: string
  note: string | null
  capturedOn: string | null
}) {
  return backendRequest<SourceCollection>("/admin/source-collections", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function updateCollection(
  collection: SourceCollection,
  input: { label: string; note: string | null; capturedOn: string | null },
) {
  return backendRequest<SourceCollection>(`/admin/source-collections/${collection.id}`, {
    method: "PUT",
    body: JSON.stringify({ ...input, expectedVersion: collection.version }),
  })
}

export async function deleteCollection(collection: SourceCollection) {
  await backendRequest<void>(`/admin/source-collections/${collection.id}/delete`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: collection.version }),
  })
}

export async function deleteSourceFile(file: Pick<SourceFile, "id" | "version">) {
  await backendRequest<void>(`/admin/source-files/${file.id}/delete`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: file.version }),
  })
}

export async function deleteOrphan(sha256: string) {
  await backendRequest<void>(`/admin/source-objects/${sha256}/delete`, { method: "POST" })
}

export async function estimateUpload(target: "MEDIA" | "SOURCES", files: { sha256?: string; sizeBytes: number }[]) {
  return backendRequest<StorageEstimate>("/admin/storage/estimates", {
    method: "POST",
    body: JSON.stringify({ target, files }),
  })
}

// Writes. Each goes through a mutation: a failure is shown once, by the shared toast, or inline where the mutation
// is silent because the form shows it next to the field.

function useFilesMutation<T, R>(write: (input: T) => Promise<R>, meta?: { silent?: boolean }) {
  const client = useQueryClient()
  return useMutation({ mutationFn: write, onSettled: () => refreshSourceFiles(client), meta })
}

export const useDeleteCollection = () => useFilesMutation(deleteCollection)

export const useDeleteSourceFile = () => useFilesMutation(deleteSourceFile)

/** The sheet lists every orphan and says inline which one could not be removed. */
export const useDeleteOrphan = () => useFilesMutation(deleteOrphan, { silent: true })

/** The collection form shows its error next to the fields. */
export const useSaveCollection = (collection: SourceCollection | null) =>
  useFilesMutation(
    (input: {
      code: string
      category: SourceCategory
      label: string
      note: string | null
      capturedOn: string | null
    }) =>
      collection
        ? updateCollection(collection, { label: input.label, note: input.note, capturedOn: input.capturedOn })
        : createCollection(input),
    { silent: true },
  )

/** Opening a file asks for a short-lived link first; a failure reaches the shared toast. */
export const useDownloadLink = () => useMutation({ mutationFn: downloadLink })

/** After any change the lists, the open collection and the storage figures read again. */
export async function refreshSourceFiles(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: fileKeys.allCollections }),
    client.invalidateQueries({ queryKey: fileKeys.anyCollection }),
    client.invalidateQueries({ queryKey: fileKeys.allFiles }),
    client.invalidateQueries({ queryKey: fileKeys.anyFile }),
    client.invalidateQueries({ queryKey: fileKeys.orphans }),
    client.invalidateQueries({ queryKey: fileKeys.summary }),
  ])
}
