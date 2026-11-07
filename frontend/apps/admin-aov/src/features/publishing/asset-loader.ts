import { ApiError } from "@/lib/api/errors"
import type { AssetDetail } from "./types"

/** The backend refuses more ids than this in one request. */
const idsPerRequest = 100
/** Long enough for a screen mounting many images, and for what its first results reveal, to share a request. */
const gatherMs = 10
/** One malformed id would fail the whole request, so only ids the backend can parse may share one. */
const shareable = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

type AssetReader = {
  asset: (id: string) => Promise<AssetDetail>
  assetsById: (ids: readonly string[]) => Promise<AssetDetail[]>
}
type Waiter = { resolve: (asset: AssetDetail) => void; reject: (reason: unknown) => void }

/**
 * Reads assets like `read.asset`, except that ids asked for at about the same moment share one request. Callers keep one
 * query per asset, so each image's cache entry, invalidation and error state stay its own.
 */
export function createAssetLoader(read: AssetReader) {
  let waiting = new Map<string, Waiter[]>()

  const settle = async (ids: string[], waiters: Map<string, Waiter[]>) => {
    try {
      // A lone id keeps the plain read, with the backend's own not-found error.
      const assets = ids.length === 1 ? [await read.asset(ids[0])] : await read.assetsById(ids)
      const found = new Map(assets.map((asset) => [asset.id, asset]))
      for (const id of ids) {
        const asset = found.get(id)
        for (const waiter of waiters.get(id)!) {
          if (asset) waiter.resolve(asset)
          else
            waiter.reject(
              new ApiError({ status: 404, code: "MEDIA_ASSET_NOT_FOUND", detail: `Media asset ${id} does not exist.` }),
            )
        }
      }
    } catch (error) {
      for (const id of ids) for (const waiter of waiters.get(id)!) waiter.reject(error)
    }
  }

  const flush = () => {
    const waiters = waiting
    waiting = new Map()
    const ids = [...waiters.keys()]
    for (let start = 0; start < ids.length; start += idsPerRequest)
      void settle(ids.slice(start, start + idsPerRequest), waiters)
  }

  return (id: string): Promise<AssetDetail> => {
    if (!shareable.test(id)) return read.asset(id)
    return new Promise((resolve, reject) => {
      if (!waiting.size) setTimeout(flush, gatherMs)
      waiting.set(id, [...(waiting.get(id) ?? []), { resolve, reject }])
    })
  }
}
