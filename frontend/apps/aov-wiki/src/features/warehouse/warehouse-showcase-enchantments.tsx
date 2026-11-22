import { useMemo, type CSSProperties } from "react"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { useWikiContext } from "../../context/wiki-context"
import {
  warehouseImage,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
} from "../../lib/warehouse-types"
import type { WarehouseEnchantment } from "./use-item-catalog"
import { CatalogShowcase, type ShowcaseIntro } from "../../components/catalog-showcase"
import "./warehouse-showcase-enchantments.css"

interface Banner {
  code: string
  name: string
  tone: string
  emblem?: string
  /** The branch's first enchantment of each tier, I to III, where it has a picture. */
  pieces: string[]
}

/**
 * The enchantments' head: the branches as banners hung side by side across the right of the banner, each slanted, in
 * its own colour, with its emblem, its name and its first enchantment of each tier. The banners take turns to light up,
 * so the eye travels across them.
 */
export function EnchantmentShowcase({
  intro,
  entries,
  groups,
}: {
  intro: ShowcaseIntro
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
}) {
  const { locale } = useWikiContext()
  const banners = useMemo(() => branchBanners(entries, groups, locale), [entries, groups, locale])
  return (
    <CatalogShowcase
      {...intro}
      scene={
        banners.length > 0 && (
          <div className="wiki-enchantment-banners" style={{ "--banners": banners.length } as CSSProperties}>
            {banners.map((banner, index) => (
              <div
                key={banner.code}
                className="wiki-enchantment-banner"
                style={{ "--banner-tone": banner.tone, "--banner-order": index } as CSSProperties}
              >
                <div className="wiki-enchantment-banner-face">
                  {banner.emblem && <img className="wiki-enchantment-banner-emblem" src={banner.emblem} alt="" />}
                  <span className="wiki-enchantment-banner-name">{banner.name}</span>
                  <span className="wiki-enchantment-banner-pieces">
                    {banner.pieces.map((url) => (
                      <img key={url} src={url} alt="" loading="lazy" decoding="async" />
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      }
    />
  )
}

function branchBanners(entries: PublishedWarehouseRecord[], groups: WarehouseGroup[], locale: string): Banner[] {
  const records = entries.filter((entry): entry is WarehouseEnchantment => entry.kind === "enchantments")
  const first = (branchCode: string, tier: number) => {
    const entry = records
      .filter(({ content }) => content.branchCode === branchCode && content.tier === tier)
      .sort((a, b) => (a.content.position ?? 99) - (b.content.position ?? 99))[0]
    return entry && warehouseImage(entry)
  }
  return groups.map((group) => ({
    code: group.code,
    name: warehouseText(group.translations, locale)?.name || group.code,
    tone: enchantmentBranchColor(group),
    emblem: group.icon?.currentVersion?.url,
    pieces: [1, 2, 3].flatMap((tier) => first(group.code, tier) ?? []),
  }))
}
