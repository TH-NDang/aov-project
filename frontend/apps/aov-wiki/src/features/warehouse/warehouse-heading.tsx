import type { ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiText } from "../../context/wiki-context"
import type { WarehouseKind } from "../../lib/warehouse-types"
import { CatalogShowcase, type ShowcaseIntro } from "../../components/catalog-showcase"

/** The word that counts the entries of each part of the armory. */
const UNITS: Record<WarehouseKind, [string, string]> = {
  items: ["trang bị", "items"],
  arcana: ["ngọc", "arcana"],
  spells: ["phụ trợ", "talents"],
  enchantments: ["phù hiệu", "enchantments"],
}

/**
 * The head of an armory page, as clean as the hero library's: the part's name and count, the data version in the
 * corner, and a scene of the part's own pictures, drawn by {@link CatalogShowcase}. The page passes `showcase` to give
 * the part its scene.
 */
export function WarehouseHeading({
  kind,
  title,
  count,
  version,
  showcase,
}: {
  kind: WarehouseKind
  title: string
  /** Entries on screen; left out while the catalog loads. */
  count?: number
  version?: ReactNode
  /** Draws the head from its text, with the part's own scene. */
  showcase?: (intro: ShowcaseIntro) => ReactNode
}) {
  const text = useWikiText()
  const intro: ShowcaseIntro = {
    title,
    count: count !== undefined && count > 0 ? `${count} ${text(...UNITS[kind])}` : undefined,
    corner: version,
    wide: usePageLayout() === "wide",
  }
  return showcase ? showcase(intro) : <CatalogShowcase {...intro} />
}
