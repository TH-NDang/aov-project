import { QueryObserver, type QueryClient } from "@tanstack/react-query"
import type { EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import type { AssetDetail } from "../publishing/types"

// Existing screens cache different projections; refresh them without mixing their payload shapes.
const details = new Set(["publishing-asset", "hero-content-asset", "managed-image", "profile-draft-avatar"])
const lists = new Set(["publishing-assets", "managed-images"])

/** Cancel older reads before refreshing every view of the changed asset. */
export async function invalidateMediaAsset(client: QueryClient, assetId: string) {
  const filters = {
    predicate: ({ queryKey, state }: { queryKey: readonly unknown[]; state: { data: unknown } }) => {
      if (lists.has(String(queryKey[0])) || (details.has(String(queryKey[0])) && queryKey[1] === assetId)) return true
      if (queryKey[0] !== "user-profile") return false
      const data = state.data as { avatarAssetId?: string; items?: { avatarAssetId?: string }[] } | undefined
      return data?.avatarAssetId === assetId || !!data?.items?.some((profile) => profile.avatarAssetId === assetId)
    },
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
    queryKey: ["publishing-asset", id],
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
