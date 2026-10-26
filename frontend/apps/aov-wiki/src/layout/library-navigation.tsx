import { NavLink, useLocation, useSearchParams } from "react-router"
import { WikiIcon } from "../components/wiki-icon"
import { useWikiContext } from "../context/wiki-context"
import "./library-navigation.css"

const NAV_NAMES = {
  book: "book",
  hero: "hero",
  skin: "skin",
  equipment: "items",
  enchantment: "enchantments",
  arcana: "arcana",
  spell: "spells",
  map: "map",
  mode: "mode",
} as const

export function LibraryNavIcon({ name }: { name: keyof typeof NAV_NAMES }) {
  return <WikiIcon name={NAV_NAMES[name]} />
}
const UPCOMING = [
  { label: "map", icon: "map" },
  { label: "mode", icon: "mode" },
] as const

export function LibraryNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t, href } = useWikiContext()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const warehouseTab = pathname === "/warehouse" ? (params.get("tab") ?? "items") : null
  return (
    <nav className="wiki-library-navigation" aria-label={t("contents")}>
      <details className="wiki-library-nav-group" open>
        <summary>
          <LibraryNavIcon name="book" />
          <span>{t("characters")}</span>
          <span className="wiki-library-nav-chevron" aria-hidden="true">
            <WikiIcon name="chevron" size={14} />
          </span>
        </summary>
        <NavLink className="wiki-library-nav-link wiki-library-nav-child" to={href("/hero")} onClick={onNavigate}>
          <LibraryNavIcon name="hero" />
          <span>{t("heroes")}</span>
        </NavLink>
        <NavLink className="wiki-library-nav-link wiki-library-nav-child" to={href("/skins")} onClick={onNavigate}>
          <LibraryNavIcon name="skin" />
          <span>{t("skins")}</span>
        </NavLink>
      </details>
      <details className="wiki-library-nav-group" open>
        <summary>
          <LibraryNavIcon name="equipment" />
          <span>{t("warehouse")}</span>
          <span className="wiki-library-nav-chevron" aria-hidden="true">
            <WikiIcon name="chevron" size={14} />
          </span>
        </summary>
        {(
          [
            { tab: "items", name: "Trang bị", icon: "equipment" },
            { tab: "enchantments", name: "Phù hiệu", icon: "enchantment" },
            { tab: "arcana", name: "Bảng ngọc", icon: "arcana" },
            { tab: "spells", name: "Phụ trợ", icon: "spell" },
          ] as const
        ).map((entry) => (
          <NavLink
            key={entry.tab}
            to={href(`/warehouse?tab=${entry.tab}`)}
            className="wiki-library-nav-link wiki-library-nav-child"
            aria-current={warehouseTab === entry.tab ? "page" : false}
            onClick={onNavigate}
          >
            <LibraryNavIcon name={entry.icon} />
            <span>{t(entry.tab)}</span>
          </NavLink>
        ))}
      </details>
      <div className="wiki-library-nav-upcoming">
        {UPCOMING.map((item) => (
          <div key={item.label} className="wiki-library-nav-unavailable" aria-disabled="true">
            <LibraryNavIcon name={item.icon} />
            <span>{t(item.label)}</span>
            <span className="wiki-library-nav-soon">{t("comingSoon")}</span>
          </div>
        ))}
      </div>
      <NavLink className="wiki-library-nav-home" to={href("/")} onClick={onNavigate}>
        {t("backHome")}
        <WikiIcon name="open" size={14} />
      </NavLink>
    </nav>
  )
}
