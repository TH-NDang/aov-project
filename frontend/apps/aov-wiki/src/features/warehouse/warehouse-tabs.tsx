import { SECTION_NAMES } from "../../lib/wiki-sections"
import { useNavigate } from "react-router"
import { PublicTabBar } from "@aov/ui/components/public-tab-bar"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { warehousePath } from "../../lib/wiki-catalog"
import { WAREHOUSE_SECTIONS, type WarehouseKind } from "../../lib/warehouse-types"

/** The armory's four parts as tabs under the compact header, so each stays a tap away without opening the contents. */
export function WarehouseTabs({ active }: { active: WarehouseKind }) {
  const scope = useWikiContext()
  const navigate = useNavigate()
  return (
    <PublicTabBar
      label={wikiText(scope.locale, "Kho trang bị", "Armory")}
      tabs={WAREHOUSE_SECTIONS.map(({ kind }) => ({
        key: kind,
        label: wikiText(scope.locale, ...SECTION_NAMES[kind]),
      }))}
      active={active}
      onSelect={(key) => navigate(scope.href(warehousePath(key)))}
    />
  )
}
