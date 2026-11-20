import type { ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import type { WarehouseKind } from "../../lib/warehouse-types"
import "./warehouse-heading.css"

/** What each part of the armory holds, in one line, and the word that counts its entries. */
const ABOUT: Record<WarehouseKind, { lead: [string, string]; unit: [string, string] }> = {
  items: {
    lead: [
      "Chỉ số, nội tại và đường ghép của mọi trang bị trong cửa hàng.",
      "Stats, passives and build paths of every item in the shop.",
    ],
    unit: ["trang bị", "items"],
  },
  arcana: {
    lead: [
      "Ngọc ba màu theo từng bậc, với chỉ số mỗi viên cộng thêm.",
      "Arcana of three colors by tier, with the stats each one adds.",
    ],
    unit: ["ngọc", "arcana"],
  },
  spells: {
    lead: [
      "Phép bổ trợ mang vào trận: hồi chiêu, cấp mở và tác dụng.",
      "Talents taken into a match: cooldown, unlock level and effect.",
    ],
    unit: ["phụ trợ", "talents"],
  },
  enchantments: {
    lead: [
      "Phù hiệu theo từng hệ, nâng dần qua các bậc của nhánh đã chọn.",
      "Enchantments by realm, raised tier by tier along the chosen branch.",
    ],
    unit: ["phù hiệu", "enchantments"],
  },
}

/**
 * The head of an armory page on wide screens: the part's name over a line about what it holds and how many entries
 * there are, with its emblem large and faint behind, and the data version on the right. Phones name the page in their
 * header and keep the part tabs instead.
 */
export function WarehouseHeading({
  kind,
  title,
  count,
  action,
}: {
  kind: WarehouseKind
  title: string
  /** Entries on screen; left out while the catalog loads. */
  count?: number
  action?: ReactNode
}) {
  const text = useWikiText()
  if (usePageLayout() === "compact") return null
  const about = ABOUT[kind]
  return (
    <header className="wiki-warehouse-heading-banner" data-kind={kind}>
      <WikiIcon name={kind} size={168} className="wiki-warehouse-heading-emblem" />
      <div className="wiki-warehouse-heading-text">
        <span className="wiki-warehouse-heading-eyebrow">
          <WikiIcon name={kind} size={18} />
          {text("Kho trang bị", "Armory")}
        </span>
        <h1>{title}</h1>
        <p>
          {text(...about.lead)}
          {count !== undefined && count > 0 && (
            <span className="wiki-warehouse-heading-count">
              {count} {text(...about.unit)}
            </span>
          )}
        </p>
      </div>
      {action && <div className="wiki-warehouse-heading-action">{action}</div>}
    </header>
  )
}
