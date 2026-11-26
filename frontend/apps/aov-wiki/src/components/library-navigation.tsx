import { useSyncExternalStore, type ReactNode } from "react"
import { Link } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { WikiIcon, type WikiIconName } from "./wiki-icon"
import { ChangeKindMark } from "./change-tag"
import { GameFrame } from "./game-frame"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { useSeasonMarks } from "../lib/season-updates"
import { wikiSections, type WikiSectionKey, SECTION_NAMES } from "../lib/wiki-sections"
import "./library-navigation.css"

/** Matches the width below which `library-navigation.css` narrows the sidebar to its icons. */
const ICONS_ONLY_QUERY = "(max-width: 1179.98px)"

function subscribeToIconsOnly(onChange: () => void) {
  const query = window.matchMedia(ICONS_ONLY_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Whether the sidebar shows only its icons, so each link needs a tooltip with its name. */
function useIconsOnly() {
  return useSyncExternalStore(
    subscribeToIconsOnly,
    () => window.matchMedia(ICONS_ONLY_QUERY).matches,
    () => false,
  )
}

/** What a tooltip says: the section's name, and under it what the season changed or how many versions it holds. */
interface Tip {
  name: string
  line?: ReactNode
}

/** The short word players use for each kind of change, in the tooltip's tally. */
const KIND_WORDS: Record<string, [string, string]> = {
  BUFF: ["tăng", "buff"],
  NERF: ["giảm", "nerf"],
  REWORK: ["làm lại", "rework"],
  FIX: ["sửa lỗi", "fix"],
  RELEASE: ["mới", "new"],
  ADDED: ["mới", "new"],
}

/**
 * Every section of the Wiki in its group, as tiles of a game lobby: each section's mark in a hexagonal socket over its
 * name, inside a small game frame, two to a row under a title between two lines; the current tile glows. `sidebar` is
 * the column beside every section page of the wide layout, one ornate frame that starts with the home page and narrows
 * to its sockets below 1180px; `sheet` is the contents sheet of the compact header, the same tiles three to a row. A
 * section the versions of the season in force changed carries an angled "New" tag on its corner (a lit gem when only
 * sockets show), detailed by its tooltip.
 */
export function LibraryNavigation({
  active,
  onNavigate,
  layout = "sheet",
}: {
  active?: WikiSectionKey
  onNavigate?: () => void
  layout?: "sheet" | "sidebar"
}) {
  const { href, locale } = useWikiContext()
  const t = useWikiText()
  const sidebar = layout === "sidebar"
  const iconsOnly = useIconsOnly() && sidebar
  const { season, patchCount, marks } = useSeasonMarks()

  /** "Changed in 17/11 and 30/10", at most two days then how many more. */
  const daysText = (days: string[]) => {
    const shown = days.slice(0, 2).join(t(" và ", " and "))
    const more = days.length > 2 ? t(` và ${days.length - 2} bản khác`, ` and ${days.length - 2} more`) : ""
    return t(`Đổi ở bản ${shown}${more}`, `Changed in ${shown}${more}`)
  }

  const entry = (key: string, to: string, icon: WikiIconName, name: string, current = false) => {
    const mark = marks[key as WikiSectionKey]
    const tip: Tip = mark
      ? {
          name,
          line: mark.kinds?.length ? (
            <>
              {t(`Bản ${mark.days[0]}:`, `Update ${mark.days[0]}:`)}
              {mark.kinds.map(([kind, count]) => (
                <span key={kind} className="wiki-library-nav-tip-kind">
                  <ChangeKindMark kind={kind} size={14} />
                  {count.toLocaleString(locale)} {t(...(KIND_WORDS[kind] ?? ["chỉnh", "tweak"]))}
                </span>
              ))}
            </>
          ) : (
            daysText(mark.days)
          ),
        }
      : key === "updates" && patchCount
        ? {
            name,
            line: season
              ? t(`Mùa ${season} có ${patchCount} bản`, `${patchCount} updates in season ${season}`)
              : t(`${patchCount} bản trong mùa này`, `${patchCount} updates this season`),
          }
        : { name }
    return (
      <NamedLink key={key} tip={tip} tooltip={sidebar && (iconsOnly || Boolean(tip.line))}>
        <Link
          to={to}
          onClick={onNavigate}
          className="wiki-library-nav-link wiki-frame wiki-frame-hover"
          data-selected={current ? "" : undefined}
          aria-current={current ? "page" : undefined}
        >
          <span className="wiki-frame-socket wiki-library-nav-socket" data-lit={current ? "" : undefined}>
            <WikiIcon name={icon} size={22} />
          </span>
          <span className="wiki-library-nav-name">{name}</span>
          {mark && (
            <span className="wiki-library-nav-new">
              <span className="sr-only">: </span>
              {t("Mới", "New")}
            </span>
          )}
        </Link>
      </NamedLink>
    )
  }

  const groups = (
    <>
      {sidebar && (
        <div className="wiki-library-nav-group" data-group="home">
          {entry("home", href("/"), "home", t("Trang chủ", "Home"))}
        </div>
      )}
      {(["characters", "warehouse", "play", "news"] as const).map((group) => (
        <div className="wiki-library-nav-group" key={group}>
          <h3 className="wiki-frame-divider">{t(...SECTION_NAMES[group]!)}</h3>
          {wikiSections
            .filter((section) => section.group === group)
            .map((section) =>
              entry(
                section.key,
                href(section.path),
                section.icon,
                t(...SECTION_NAMES[section.key]!),
                active === section.key,
              ),
            )}
        </div>
      ))}
    </>
  )

  return (
    <TooltipProvider delayDuration={150}>
      {sidebar ? (
        <GameFrame
          as="nav"
          className="wiki-library-navigation"
          data-layout="sidebar"
          aria-label={t("Các mục của Wiki", "Wiki sections")}
        >
          {groups}
        </GameFrame>
      ) : (
        <nav className="wiki-library-navigation" data-layout="sheet" aria-label={t("Mục lục", "Contents")}>
          {groups}
        </nav>
      )}
    </TooltipProvider>
  )
}

/**
 * Wraps a link in a tooltip when it needs one: a small game frame beside the item with a pointer toward it, the name in
 * bold and, under it, what the season changed. Shown on hover and on keyboard focus.
 */
function NamedLink({ tip, tooltip, children }: { tip: Tip; tooltip: boolean; children: ReactNode }) {
  if (!tooltip) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} collisionPadding={12} className="wiki-library-nav-tooltip">
        <span className="wiki-library-nav-tip-pointer" aria-hidden="true" />
        <span className="wiki-frame wiki-library-nav-tip">
          <strong>{tip.name}</strong>
          {tip.line && <span className="wiki-library-nav-tip-line">{tip.line}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
