import type { ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiText } from "../../context/wiki-context"
import type { WarehouseKind } from "../../lib/warehouse-types"
import { WarehouseShowcase, type ShowcaseIntro } from "./warehouse-showcase"

/**
 * How each part of the armory introduces itself, in two lines: a short tagline that says what the part gives in a
 * match, then a plain line on how it works. And the word that counts its entries.
 */
const ABOUT: Record<WarehouseKind, { tagline: [string, string]; lead: [string, string]; unit: [string, string] }> = {
  items: {
    tagline: ["Sáu ô đồ, một chiến thuật", "Six slots, one plan"],
    lead: [
      "Chỉ số, nội tại và đường ghép của mọi món trong cửa hàng.",
      "Stats, passives and build paths of every item in the shop.",
    ],
    unit: ["trang bị", "items"],
  },
  arcana: {
    tagline: ["Lợi thế từ phút đầu tiên", "An edge from the first minute"],
    lead: [
      "Ngọc ba màu cộng chỉ số ngay khi vào trận.",
      "Arcana of three colours add their stats as the match begins.",
    ],
    unit: ["ngọc", "arcana"],
  },
  spells: {
    tagline: ["Một phép, đúng lúc", "One spell, at the right moment"],
    lead: ["Hồi chiêu, cấp mở và tác dụng của từng phép bổ trợ.", "Cooldown, unlock level and effect of each talent."],
    unit: ["phụ trợ", "talents"],
  },
  enchantments: {
    // How a set is made is what a reader needs first here; the rules are those of the set builder.
    tagline: ["Năm phù hiệu, một lối chơi", "Five enchantments, one way to play"],
    lead: [
      "3 bậc của hệ chính, 2 phù hiệu từ hệ khác.",
      "3 tiers of a main branch, 2 enchantments from other branches.",
    ],
    unit: ["phù hiệu", "enchantments"],
  },
}

/**
 * The head of an armory page: the part's two lines and count, drawn by {@link WarehouseShowcase} on wide screens and on
 * phones. The page passes `showcase` to give the part a scene of its own.
 */
export function WarehouseHeading({
  kind,
  title,
  count,
  action,
  showcase,
}: {
  kind: WarehouseKind
  title: string
  /** Entries on screen; left out while the catalog loads. */
  count?: number
  action?: ReactNode
  /** Draws the head from its text, with the part's own scene. */
  showcase?: (intro: ShowcaseIntro) => ReactNode
}) {
  const text = useWikiText()
  const about = ABOUT[kind]
  const intro: ShowcaseIntro = {
    title,
    tagline: text(...about.tagline),
    lead: text(...about.lead),
    count: count !== undefined && count > 0 ? `${count} ${text(...about.unit)}` : undefined,
    action,
    wide: usePageLayout() === "wide",
  }
  return showcase ? showcase(intro) : <WarehouseShowcase {...intro} />
}
