import type { RefObject } from "react"
import { useAdminNav } from "./admin-nav"
import { NavPanel } from "./nav-panel"
import { NavRail } from "./nav-rail"
import { NavTabBar } from "./nav-tab-bar"

/** The navigation of wide screens: the rail, with the pages of one area beside it while there is room. */
export function SideNavigation() {
  const { layout, panelOpen } = useAdminNav()
  if (layout === "compact") return null
  return (
    <>
      <NavRail />
      {panelOpen && <NavPanel />}
    </>
  )
}

/** The navigation of compact screens: the areas along the bottom, out of the way while `content` is read. */
export function CompactNavigation({ content }: { content: RefObject<HTMLElement | null> }) {
  const { layout } = useAdminNav()
  return layout === "compact" ? <NavTabBar content={content} /> : null
}
