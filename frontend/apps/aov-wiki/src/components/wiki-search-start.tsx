import { useEffect, useMemo, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { referenceTranslation } from "@aov/ui/lib/entity-rich-text"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { heroCatalogQuery } from "../lib/hero-api"
import { readRecentHeroes } from "../lib/recent-heroes"
import { useChangedHeroes } from "../lib/use-changed-heroes"
import { warehouseCatalogQuery } from "../lib/warehouse-api"
import { wikiReferencesQuery } from "../lib/wiki-references"
import { SECTION_NAMES, wikiSections } from "../lib/wiki-sections"
import { ChangeKindMark } from "./change-tag"
import { WikiIcon, type WikiIconName } from "./wiki-icon"
import { WikiImage } from "./wiki-image"
import "./wiki-search-start.css"

/** One suggestion offered before any word is typed. */
export interface StartEntry {
  id: string
  label: string
  to: string
  image?: string
  /** The kind of change of a hero the version in force changed. */
  kind?: string
  icon?: WikiIconName
}

interface StartGroup {
  key: "recent" | "changed" | "items" | "sections"
  title: string
  look: "face" | "icon" | "chip"
  entries: StartEntry[]
}

/**
 * What the search offers before any word: the heroes this reader opened last, the heroes the version in force changed
 * (with the mark of their change), a few finished items, then every section of the Wiki. All of it comes from answers
 * the Wiki already keeps (the hero list, the published changes, the reference catalog, the items catalog).
 */
function useStartGroups(): StartGroup[] {
  const scope = useWikiContext()
  const { href, locale } = scope
  const t = useWikiText()
  const heroes = useQuery(heroCatalogQuery(scope))
  const references = useQuery(wikiReferencesQuery(scope))
  const items = useQuery(warehouseCatalogQuery("items", scope))
  const changed = useChangedHeroes()
  // Read once when the panel opens; the list only changes when a hero page is opened.
  const [recentCodes] = useState(readRecentHeroes)

  return useMemo(() => {
    const byCode = new Map((heroes.data?.items ?? []).map((hero) => [hero.code, hero]))
    const recent = recentCodes.flatMap((code) => {
      const hero = byCode.get(code)
      return hero
        ? [{ id: hero.id, label: hero.name, to: href(`/hero/${hero.code}`), image: hero.head?.currentVersion?.url }]
        : []
    })
    const changes = changed.heroes.flatMap((hero) =>
      hero.to
        ? [
            {
              id: hero.id,
              label: hero.name,
              to: hero.to,
              image: hero.shown?.head?.currentVersion?.url,
              kind: hero.kind,
            },
          ]
        : [],
    )
    const finished = new Set(
      (items.data ?? []).flatMap((item) => (item.kind === "items" && item.content.tier === 3 ? [item.id] : [])),
    )
    const fallback = references.data?.fallbackLocale ?? "vi-VN"
    const itemEntries = (references.data?.entities ?? []).flatMap((entity) => {
      const name = referenceTranslation(entity, locale, fallback)?.name
      return entity.kind === "item" && finished.has(entity.id) && entity.icon && entity.destinations?.wiki && name
        ? [{ id: entity.id, label: name, to: entity.destinations.wiki, image: entity.icon }]
        : []
    })
    const sections = wikiSections.map((section) => ({
      id: section.key,
      label: section.key === "updates" ? t(...SECTION_NAMES.updatesShort!) : t(...SECTION_NAMES[section.key]!),
      to: href(section.path),
      icon: section.icon,
    }))

    const groups: StartGroup[] = [
      { key: "recent", title: t("Xem gần đây", "Recently viewed"), look: "face", entries: recent.slice(0, 8) },
      {
        key: "changed",
        title: t("Thay đổi ở bản này", "Changed this version"),
        look: "face",
        entries: changes.slice(0, 8),
      },
      { key: "items", title: t("Trang bị cấp 3", "Finished items"), look: "icon", entries: itemEntries.slice(0, 8) },
      { key: "sections", title: t("Các mục", "Sections"), look: "chip", entries: sections },
    ]
    return groups.filter((group) => group.entries.length > 0)
  }, [heroes.data, references.data, items.data, changed.heroes, recentCodes, href, locale, t])
}

/**
 * The panel of the search before any word is typed: suggestions with pictures, in groups. The field keeps the focus;
 * its arrow keys move through every suggestion in reading order, which `entries` hands back to it.
 */
export function WikiSearchStart({
  listId,
  marked,
  entries,
  replace,
  onHover,
  onPick,
}: {
  listId: string
  marked: number
  /** Receives every suggestion in reading order, so the field's keys can move through them. */
  entries: RefObject<StartEntry[]>
  /** Opens a suggestion in place of the current history entry. */
  replace: boolean
  onHover: (index: number) => void
  onPick: () => void
}) {
  const t = useWikiText()
  const groups = useStartGroups()
  const flat = groups.flatMap((group) => group.entries)
  useEffect(() => {
    entries.current = flat
  })

  let index = -1
  return (
    <div id={listId} role="listbox" className="wiki-search-start" aria-label={t("Gợi ý", "Suggestions")}>
      {groups.map((group) => (
        <div key={group.key} role="group" aria-labelledby={`${listId}-${group.key}`} data-look={group.look}>
          <p id={`${listId}-${group.key}`} className="wiki-search-start-title">
            {group.title}
          </p>
          <div className="wiki-search-start-row">
            {group.entries.map((entry) => {
              index += 1
              const position = index
              return (
                <Link
                  key={entry.id}
                  id={`${listId}-${position}`}
                  role="option"
                  aria-selected={position === marked}
                  to={entry.to}
                  replace={replace}
                  tabIndex={-1}
                  title={entry.label}
                  onClick={onPick}
                  onMouseEnter={() => onHover(position)}
                >
                  {entry.icon ? (
                    <WikiIcon name={entry.icon} size={20} />
                  ) : (
                    <span className="wiki-search-start-picture">
                      {entry.image && (
                        <WikiImage className="wiki-search-start-image" src={entry.image} frameWidth={64} alt="" />
                      )}
                      {entry.kind && (
                        <span className="wiki-search-start-pip">
                          <ChangeKindMark kind={entry.kind} size={16} />
                        </span>
                      )}
                    </span>
                  )}
                  <span className="wiki-search-start-label">{entry.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
