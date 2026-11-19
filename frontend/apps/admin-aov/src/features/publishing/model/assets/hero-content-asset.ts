import { backendRequest } from "@/app/auth/session"
import { createAssetLoader } from "./asset-loader"
import { createPublishingApi } from "@/lib/api/publishing-api"
import { mediaKeys } from "@/features/media/api/media-cache"

const loadAsset = createAssetLoader(createPublishingApi(backendRequest))

/** One cache entry per image; images asked for together are still read in one request. */
export const heroContentAssetQuery = (id: string) => ({
  queryKey: mediaKeys.assetView(id, "content"),
  queryFn: () => loadAsset(id),
  staleTime: 60000,
})
