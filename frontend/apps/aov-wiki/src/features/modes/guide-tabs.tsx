import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon, type WikiIconName } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { GUIDE_TABS, type GuideTab } from "./auto-chess-model"
import { ModeDialog } from "./mode-ui"
import "./guide-tabs.css"

/** The mark of each part of the guide on the phone's sheet of parts. */
const TAB_ICONS: Record<GuideTab, WikiIconName> = {
  overview: "info",
  units: "hero",
  traits: "badge",
  items: "items",
  blessings: "spark",
  quests: "clipboard",
  lineups: "chessboard",
  builder: "board",
  insights: "stats",
}

/**
 * The guide's parts as one row of tabs under the banner; a narrow row scrolls sideways and never wraps. On phones nine
 * tabs do not fit, so the row ends in a button that opens a sheet with every part as a large tile, the open one lit.
 */
export function GuideTabs({ code, active }: { code: string; active: GuideTab }) {
  const { href, locale } = useWikiContext()
  const compact = usePageLayout() === "compact"
  const [sheet, setSheet] = useState(false)
  const row = useRef<HTMLElement>(null)
  const link = (key: GuideTab) => href(`/modes/${encodeURIComponent(code)}${key === "overview" ? "" : `/${key}`}`)
  const label = wikiText(locale, "Mục cẩm nang", "Guide sections")
  // On a narrow row the open tab may sit past the edge: bring it into view without moving the page.
  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!row.current || !current) return
    row.current.scrollLeft = current.offsetLeft - (row.current.clientWidth - current.offsetWidth) / 2
  }, [active])

  const tabs = (
    <nav ref={row} className="wiki-guide-tabs" aria-label={label}>
      {GUIDE_TABS.map((item) => (
        <Link
          key={item.key}
          className="wiki-guide-tab"
          aria-current={active === item.key ? "page" : undefined}
          to={link(item.key)}
          preventScrollReset
        >
          {wikiText(locale, item.label, item.english)}
        </Link>
      ))}
    </nav>
  )
  if (!compact) return tabs
  return (
    <div className="wiki-guide-tabs-bar">
      {tabs}
      <button
        type="button"
        className="wiki-guide-tabs-all"
        aria-label={wikiText(locale, "Tất cả mục cẩm nang", "All guide sections")}
        aria-haspopup="dialog"
        onClick={() => setSheet(true)}
      >
        <WikiIcon name="cards" size={20} />
      </button>
      <ModeDialog open={sheet} onClose={() => setSheet(false)} label={label}>
        <ul className="wiki-guide-tabs-sheet">
          {GUIDE_TABS.map((item) => (
            <li key={item.key}>
              <Link
                className="wiki-guide-tabs-tile"
                aria-current={active === item.key ? "page" : undefined}
                to={link(item.key)}
                preventScrollReset
                onClick={() => setSheet(false)}
              >
                <WikiIcon name={TAB_ICONS[item.key]} size={24} />
                {wikiText(locale, item.label, item.english)}
              </Link>
            </li>
          ))}
        </ul>
      </ModeDialog>
    </div>
  )
}
