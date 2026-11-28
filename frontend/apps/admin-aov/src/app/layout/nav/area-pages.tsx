import { Link, useLocation } from "react-router"
import { activeNavItem, type NavArea, type NavItem } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { useSession } from "@/app/auth/auth-gate"
import { useAttentionCounts } from "../use-attention-counts"
import { useAdminNav } from "./admin-nav"
import { recentItems, type NavCounts } from "./nav-model"
import "./admin-nav.css"

export interface PageGroup {
  key: string
  title?: string
  items: NavItem[]
}

/** An area's groups as shown; the overview adds the pages opened last, other than the one being read. */
export function useAreaGroups(area: NavArea): PageGroup[] {
  const { recent } = useAdminNav()
  const { actor } = useSession()
  const { pathname } = useLocation()
  const groups = area.groups.map((group, index) => ({ key: `${area.key}:${index}`, ...group }))
  if (area.key !== "home") return groups
  const current = activeNavItem(pathname)
  const items = recentItems(recent, actor?.capabilities ?? []).filter((item) => item !== current)
  return items.length ? [...groups, { key: "recent", title: "Gần đây", items }] : groups
}

export function PageRow({ item, counts, onNavigate }: { item: NavItem; counts: NavCounts; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const active = activeNavItem(pathname)?.to === item.to
  const count = item.badge ? counts[item.badge] : undefined
  return (
    <li>
      <Link
        to={item.to}
        className="adm-nav-row"
        aria-current={active ? "page" : undefined}
        data-soon={item.soon || undefined}
        title={item.description}
        onClick={onNavigate}
      >
        <NavIcon item={item} className="size-5.5" />
        <span className="adm-nav-title">{item.title}</span>
        {item.soon ? (
          <span className="adm-nav-soon">Sắp có</span>
        ) : count ? (
          <span className="adm-nav-count">{count}</span>
        ) : null}
      </Link>
    </li>
  )
}

/** The pages of one area as a list, for the panel beside the rail and the wide column. */
export function AreaPages({ area, onNavigate }: { area: NavArea; onNavigate?: () => void }) {
  const counts = useAttentionCounts()
  const groups = useAreaGroups(area)
  return (
    <div className="adm-nav-groups">
      {groups.map((group) => (
        <section key={group.key} className="adm-nav-group" aria-label={group.title ?? area.title}>
          {group.title && <h3 className="adm-nav-heading">{group.title}</h3>}
          <ul>
            {group.items.map((item) => (
              <PageRow key={item.to} item={item} counts={counts} onNavigate={onNavigate} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
