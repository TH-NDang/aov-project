import { backendRequest } from "@/app/auth/session"
import { createAssetLoader } from "./asset-loader"
import { createPublishingApi } from "./publishing-api"

const loadAsset = createAssetLoader(createPublishingApi(backendRequest))

/** One cache entry per image; images asked for together are still read in one request. */
export const heroContentAssetQuery = (id: string) => ({
  queryKey: ["hero-content-asset", id],
  queryFn: () => loadAsset(id),
  staleTime: 60000,
})
