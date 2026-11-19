import { useQueries } from "@tanstack/react-query"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import type { LightboxImage } from "@/components/image-lightbox"
import { ImageCreditPanel } from "../../../media/components/library/image-credit-panel"
import { visibleSources } from "../../../media/model/media-source-gaps"
import { heroContentAssetQuery } from "../../model/assets/hero-content-asset"

/**
 * The large view of pictures that already sit on the page, with their credits, in the order given. The returned
 * function gives the set and the position to open for one entry, or nothing while its picture is not ready.
 */
export function useAssetGallery(entries: readonly { id?: string | null; title: string }[]) {
  // One query per picture: an empty slot asks for nothing, and a picture used twice is read once.
  const ids = [...new Set(entries.flatMap(({ id }) => (id ? [id] : [])))]
  const assets = useQueries({ queries: ids.map((id) => heroContentAssetQuery(id)) })
  const images: LightboxImage[] = []
  const positions = new Map<number, number>()
  entries.forEach((entry, order) => {
    const asset = entry.id ? assets[ids.indexOf(entry.id)]?.data : undefined
    if (!asset?.currentUrl) return
    positions.set(order, images.length)
    images.push({
      path: asset.currentUrl,
      title: entry.title,
      meta: (
        <ImageCreditPanel
          sources={visibleSources(currentMediaSources(asset.provenance ?? [], asset.currentVersionId))}
          assetId={asset.id}
        />
      ),
    })
  })
  return (order: number) => {
    const index = positions.get(order)
    return index === undefined ? undefined : { images, index }
  }
}
