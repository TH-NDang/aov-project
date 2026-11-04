import type { ReactNode } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { backendRequest } from "@/app/auth/session"
import type { LightboxImage } from "@/components/image-lightbox"
import { HeroAsset } from "./hero-asset"
import { createPublishingApi } from "./publishing-api"
import type { MediaRole, Skin } from "./types"
import { ImageCreditPanel } from "../media/image-credit-panel"
import { visibleSources } from "../media/media-source-gaps"
import { useSkinBadge } from "../media/skin-badge-label"

const api = createPublishingApi(backendRequest)

/** Gallery order: the splash leads, as it does on the card. */
const roles = [
  ["SPLASH", "Ảnh nền"],
  ["PORTRAIT", "Chân dung"],
  ["HEAD", "Đại diện"],
] as const satisfies readonly (readonly [MediaRole, string])[]

export const skinImageIds = (skin: Skin): Record<MediaRole, string | null | undefined> => ({
  SPLASH: skin.artAssetId,
  PORTRAIT: skin.portraitAssetId,
  HEAD: skin.headAssetId,
})

/** The images every hero skin carries, with its tier badge over the splash. */
export function SkinCard({
  skin,
  name,
  locale,
  children,
  action,
}: {
  skin: Skin
  name: string
  locale: string
  /** Text under the name, e.g. description and acquisition note. */
  children?: ReactNode
  action?: ReactNode
}) {
  const ids = skinImageIds(skin)
  const assets = useQueries({
    queries: roles.map(([role]) => ({
      queryKey: ["hero-content-asset", ids[role]],
      queryFn: () => api.asset(ids[role]!),
      enabled: !!ids[role],
      staleTime: 60000,
    })),
  })
  // Every image opens the same gallery, so the arrows move between the skin's images.
  const images: LightboxImage[] = []
  const positions: Partial<Record<MediaRole, number>> = {}
  roles.forEach(([role, label], index) => {
    const asset = assets[index].data
    if (!asset?.currentUrl) return
    positions[role] = images.length
    const sources = visibleSources(currentMediaSources(asset.provenance ?? [], asset.currentVersionId))
    images.push({
      path: asset.currentUrl,
      title: `${name} · ${label}`,
      meta: <ImageCreditPanel sources={sources} assetId={asset.id} />,
    })
  })
  const gallery = (role: MediaRole) => (positions[role] === undefined ? undefined : { images, index: positions[role]! })
  const { result, badge } = useSkinBadge(skin.rarityCode, locale)
  const badgeName = badge?.displayName && badge.displayName !== badge.code ? badge.displayName : null

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative isolate">
        <HeroAsset
          id={ids.SPLASH}
          alt={`${name} · Ảnh nền`}
          className="aspect-video rounded-none border-0"
          preview
          gallery={gallery("SPLASH")}
        />
        <SkinBadgeOverlay iconAssetId={badge?.iconAssetId} name={badgeName} />
        {action && <div className="absolute top-2 right-2 rounded-full bg-background/95">{action}</div>}
      </div>
      <div className="flex items-start gap-3 p-3">
        <div className="flex shrink-0 items-end gap-1.5">
          <HeroAsset
            id={ids.HEAD}
            alt={`${name} · Đại diện`}
            className="size-12 rounded-lg"
            preview
            gallery={gallery("HEAD")}
          />
          <HeroAsset
            id={ids.PORTRAIT}
            alt={`${name} · Chân dung`}
            className="h-12 w-8 rounded-md"
            preview
            gallery={gallery("PORTRAIT")}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="line-clamp-2 font-semibold break-words">{name}</h4>
          {skin.rarityCode && (
            <p className="type-meta truncate" title={skin.rarityCode}>
              {badgeName ?? (result.isPending ? "Đang tải nhãn…" : skin.rarityCode)}
            </p>
          )}
        </div>
      </div>
      {children && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </article>
  )
}

/** The tier badge sits on the splash like in game; its name is also written under the skin name. */
function SkinBadgeOverlay({ iconAssetId, name }: { iconAssetId?: string | null; name: string | null }) {
  const icon = useQuery({
    queryKey: ["hero-content-asset", iconAssetId],
    queryFn: () => api.asset(iconAssetId!),
    enabled: !!iconAssetId,
    staleTime: 60000,
  })
  const url = icon.data?.currentUrl
  if (!url && !name) return null
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-2 left-2 z-10 flex max-w-[45%]">
      {url ? (
        <img src={url} alt="" className="h-10 w-auto object-contain drop-shadow-[0_1px_3px_rgb(0_0_0/0.7)]" />
      ) : (
        <span className="truncate rounded-md bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">{name}</span>
      )}
    </span>
  )
}
