import { QueryObserver, type QueryClient } from "@tanstack/react-query"
import type { EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import type { AssetDetail } from "@/lib/hero-types"

/** How a screen reads one image; each view caches its own payload shape under the image. */
export type MediaAssetView = "detail" | "content" | "managed" | "avatar" | "contact"

/**
 * Every cached read of an image or of an image list sits under one root, so a change refreshes them by prefix and a
 * new view cannot be forgotten in a list of names.
 */
export const mediaKeys = {
  all: ["media"] as const,
  asset: (id: string) => ["media", "asset", id] as const,
  /** A query waiting for its image (no id yet) keeps the same shape and refreshes with nothing. */
  assetView: (id: string | null | undefined, view: MediaAssetView) => ["media", "asset", id ?? null, view] as const,
  lists: ["media", "list"] as const,
  list: (...parts: unknown[]) => ["media", "list", ...parts] as const,
  deletion: (id: string) => ["media-deletion", id] as const,
  deletionReferences: (id: string) => ["media-deletion-references", id] as const,
  competitionUsage: (id: string | null) => ["media-asset-competition-usage", id] as const,
  managedUsages: (id: string | null) => ["managed-image-usages", id] as const,
  contactRequests: ["media-contact-requests"] as const,
  gameRegions: ["game-regions"] as const,
  owners: ["media-owners"] as const,
}

const isMediaList = (queryKey: readonly unknown[]) => queryKey[0] === "media" && queryKey[1] === "list"
const mediaAssetId = (queryKey: readonly unknown[]) =>
  queryKey[0] === "media" && queryKey[1] === "asset" ? String(queryKey[2]) : null

/** Cancel older reads before refreshing every view of the changed asset. */
export async function invalidateMediaAsset(client: QueryClient, assetId: string) {
  await invalidateMediaAssets(client, [assetId])
}

/** Refresh shared lists once after a batch, together with every affected detail. */
export async function invalidateMediaAssets(client: QueryClient, assetIds: readonly string[]) {
  const ids = new Set(assetIds)
  if (!ids.size) return
  const filters = {
    predicate: ({ queryKey, state }: { queryKey: readonly unknown[]; state: { data: unknown } }) => {
      if (isMediaList(queryKey) || ids.has(mediaAssetId(queryKey) ?? "")) return true
      if (queryKey[0] !== "user-profile") return false
      const data = state.data as { avatarAssetId?: string; items?: { avatarAssetId?: string }[] } | undefined
      return (
        ids.has(data?.avatarAssetId ?? "") || !!data?.items?.some((profile) => ids.has(profile.avatarAssetId ?? ""))
      )
    },
  }
  await client.cancelQueries(filters)
  await client.invalidateQueries(filters)
}

/** Refreshes every cached image view, e.g. after an owner rename rewrote sources across many images. */
export async function invalidateAllMediaAssets(client: QueryClient) {
  const filters = {
    predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => queryKey[0] === "media",
  }
  await client.cancelQueries(filters)
  await client.invalidateQueries(filters)
}

/** Icons observe the same query as the asset picker, including version changes. */
export function createMediaIconResolver(
  client: QueryClient,
  read: (id: string) => Promise<AssetDetail>,
): EntityIconResolver {
  const options = (id: string) => ({
    queryKey: mediaKeys.assetView(id, "detail"),
    queryFn: () => read(id),
    staleTime: 300000,
  })
  const resolve: EntityIconResolver = async (entity) =>
    entity.iconAssetId ? (await client.fetchQuery(options(entity.iconAssetId))).currentUrl : entity.icon
  resolve.subscribe = (entity, update) => {
    if (!entity.iconAssetId) return () => {}
    const observer = new QueryObserver(client, options(entity.iconAssetId))
    const unsubscribe = observer.subscribe((result) => update(result.data?.currentUrl))
    update(observer.getCurrentResult().data?.currentUrl)
    return unsubscribe
  }
  return resolve
}
