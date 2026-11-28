import type { RefObject } from "react"
import { Link, useLocation } from "react-router"
import { LogOut } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@aov/ui/components/drawer"
import { AovNavIcon } from "@/app/aov-nav-icon"
import { activeNavItem, type NavArea, type NavItem } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { logout } from "@/app/auth/session"
import { useTheme } from "@/app/theme"
import { useAttentionCounts } from "../use-attention-counts"
import { AccountAvatar, IconCredit, THEME_CHOICES, useAccount } from "../user-menu"
import { useAdminNav } from "./admin-nav"
import { useAreaGroups } from "./area-pages"
import { areaCount, type NavCounts } from "./nav-model"
import { useBarHidden } from "./use-bar-hidden"
import "./admin-nav.css"

function Tile({ item, counts, onNavigate }: { item: NavItem; counts: NavCounts; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const active = activeNavItem(pathname)?.to === item.to
  const count = item.badge ? counts[item.badge] : undefined
  return (
    <li>
      <Link
        to={item.to}
        className="adm-tile"
        aria-current={active ? "page" : undefined}
        data-soon={item.soon || undefined}
        onClick={onNavigate}
      >
        <NavIcon item={item} className="size-7.5" />
        <span className="adm-tile-title">{item.title}</span>
        {item.soon ? (
          <span className="adm-tile-note">Sắp có</span>
        ) : count ? (
          <span className="adm-tile-count">{count}</span>
        ) : null}
      </Link>
    </li>
  )
}

/** Phones keep the account here, since they have no rail for it. */
function AccountTiles({ onNavigate }: { onNavigate: () => void }) {
  const { displayName } = useAccount()
  const { theme, setTheme } = useTheme()
  return (
    <section className="adm-sheet-group" aria-label="Tài khoản">
      <h3 className="adm-nav-heading">Tài khoản</h3>
      <Link to="/profile" className="adm-sheet-account" onClick={onNavigate}>
        <AccountAvatar className="size-10" />
        <span className="min-w-0 flex-1 truncate">{displayName}</span>
      </Link>
      <div className="adm-theme-switch" role="radiogroup" aria-label="Giao diện">
        {THEME_CHOICES.map(({ value, label, Icon }) => (
          <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)}>
            <Icon aria-hidden="true" />
            {value === "system" ? "Tự động" : label}
          </button>
        ))}
      </div>
      <div className="adm-sheet-actions">
        <Link to="/settings" className="adm-sheet-action" onClick={onNavigate}>
          Cài đặt
        </Link>
        <button type="button" className="adm-sheet-action" onClick={() => void logout()}>
          <LogOut aria-hidden="true" />
          Đăng xuất
        </button>
      </div>
      <IconCredit className="mt-3" />
    </section>
  )
}

function AreaSheet({ area, onNavigate }: { area: NavArea; onNavigate: () => void }) {
  const counts = useAttentionCounts()
  const groups = useAreaGroups(area)
  return (
    <div className="adm-sheet">
      <div className="adm-sheet-head">
        <span className="adm-sheet-socket">
          <AovNavIcon name={area.icon} className="size-6.5" />
        </span>
        <DrawerTitle className="type-section-title">{area.title}</DrawerTitle>
        <DrawerDescription className="sr-only">Các trang của {area.title}</DrawerDescription>
      </div>
      {groups.map((group) => (
        <section key={group.key} className="adm-sheet-group" aria-label={group.title ?? area.title}>
          {group.title && <h3 className="adm-nav-heading">{group.title}</h3>}
          <ul className="adm-tiles">
            {group.items.map((item) => (
              <Tile key={item.to} item={item} counts={counts} onNavigate={onNavigate} />
            ))}
          </ul>
        </section>
      ))}
      {area.key === "system" && <AccountTiles onNavigate={onNavigate} />}
    </div>
  )
}

/**
 * Compact screens: the five areas along the bottom, within reach of the thumb. Each opens its pages as a sheet of tiles
 * that closes when dragged down or tapped outside. The bar slides away while the page is read downwards and comes
 * back after a short scroll up.
 */
export function NavTabBar({ content }: { content: RefObject<HTMLElement | null> }) {
  const { areas, current, floating, setFloating } = useAdminNav()
  const counts = useAttentionCounts()
  const open = areas.find((area) => area.key === floating)
  const close = () => setFloating(null)
  const bar = useBarHidden(content, true)
  return (
    <>
      <nav
        className="adm-tabbar"
        aria-label="Khu vực quản trị"
        data-hidden={(bar.hidden && !open) || undefined}
        style={{ gridTemplateColumns: `repeat(${areas.length}, 1fr)` }}
        onFocus={bar.show}
      >
        {areas.map((area) => {
          const count = areaCount(area, counts)
          return (
            <button
              key={area.key}
              type="button"
              className="adm-tab"
              data-current={current?.key === area.key || undefined}
              aria-expanded={floating === area.key}
              aria-label={count ? `${area.title}, ${count} mục mới` : area.title}
              onClick={() => setFloating(floating === area.key ? null : area.key)}
            >
              <AovNavIcon name={area.icon} className="size-6.5" />
              <span>{area.short ?? area.title}</span>
              {!!count && <span className="adm-tab-count">{count}</span>}
            </button>
          )
        })}
      </nav>
      <Drawer open={!!open} onOpenChange={(next) => !next && close()}>
        <DrawerContent className="adm-sheet-content">
          {open && <AreaSheet area={open} onNavigate={close} />}
        </DrawerContent>
      </Drawer>
    </>
  )
}
