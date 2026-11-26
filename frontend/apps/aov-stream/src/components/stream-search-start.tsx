import { useEffect, useMemo, useState, type RefObject } from "react"
import { Link } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { CompetitionLogo, StatusBadge } from "./competition-card"
import { StreamIcon } from "./stream-icon"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { competitionStatus } from "../lib/competition-model"
import { participantPath } from "../lib/participant-model"
import { forgetSearches, readRecentSearches } from "../lib/recent-searches"
import { leadingCompetitions } from "../lib/search-model"
import { shortCompetitionName } from "../lib/season-name"
import { competitionCatalogQuery, participantsQuery } from "../lib/tournament-api"
import "./stream-search-start.css"

/** One entry offered before any word is typed. `search` marks a past search, which opens its results again. */
export interface StartEntry {
  id: string
  to: string
  label: string
  search?: string
}

const TILES = 4
const CRESTS = 8

/**
 * What the search offers before any word: the reader's last searches as chips, the competitions under way (else the
 * next or the last ones) as tiles, then the teams seen last as a row of crests. All of it comes from answers the lists
 * already keep. The field keeps the focus; its arrow keys move through every entry in reading order, which `entries`
 * hands back to it.
 */
export function StreamSearchStart({
  listId,
  marked,
  entries,
  onHover,
  onPick,
}: {
  listId: string
  marked: number
  entries: RefObject<StartEntry[]>
  onHover: (index: number) => void
  onPick: (results: boolean, search?: string) => void
}) {
  const { text } = useStreamLocale()
  const [recent, setRecent] = useState(readRecentSearches)
  const catalog = useQuery(competitionCatalogQuery)
  const teams = useInfiniteQuery(participantsQuery("TEAM", "", CRESTS))
  const competitions = useMemo(() => leadingCompetitions(catalog.data ?? [], TILES), [catalog.data])
  const teamItems = teams.data?.pages[0]?.items.slice(0, CRESTS) ?? []
  const words = recent.map((search) => ({
    id: `q:${search}`,
    to: `/explore?${new URLSearchParams({ q: search })}`,
    label: search,
    search,
  }))
  const tiles = competitions.map((entry) => ({
    id: entry.id,
    to: `/competitions/${entry.id}`,
    label: shortCompetitionName(entry),
  }))
  const crests = teamItems.map((item) => ({
    id: item.id,
    to: participantPath(item),
    label: item.shortName || item.name,
  }))
  const flat = [...words, ...tiles, ...crests]
  useEffect(() => {
    entries.current = flat
  })

  let index = -1
  const option = (entry: StartEntry) => {
    index += 1
    const position = index
    return {
      id: `${listId}-${position}`,
      role: "option",
      "aria-selected": position === marked,
      tabIndex: -1,
      to: entry.to,
      onClick: () => onPick(!!entry.search, entry.search),
      onMouseEnter: () => onHover(position),
    }
  }
  const loading = catalog.isPending || teams.isPending

  return (
    <div id={listId} role="listbox" className="hub-start" aria-label={text("Gợi ý", "Suggestions")}>
      {words.length > 0 && (
        <div role="group" aria-labelledby={`${listId}-recent`} className="hub-start-group">
          <div className="hub-start-head">
            <p id={`${listId}-recent`}>{text("Tìm gần đây", "Recent")}</p>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                forgetSearches()
                setRecent([])
              }}
            >
              {text("Xóa", "Clear")}
            </button>
          </div>
          <div className="hub-start-words">
            {words.map((entry) => (
              <Link key={entry.id} {...option(entry)}>
                <StreamIcon name="clock" size={14} />
                {entry.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      {(tiles.length > 0 || catalog.isPending) && (
        <div role="group" aria-labelledby={`${listId}-competitions`} className="hub-start-group">
          <div className="hub-start-head">
            <p id={`${listId}-competitions`}>{text("Giải đấu", "Tournaments")}</p>
          </div>
          <div className="hub-start-tiles">
            {catalog.isPending
              ? Array.from({ length: TILES }, (_, key) => (
                  <span key={key} className="hub-skeleton hub-start-tile-ghost" />
                ))
              : competitions.map((entry, at) => {
                  const { tournament } = entry.content
                  return (
                    <Link key={entry.id} className="hub-start-tile" title={tournament.name} {...option(tiles[at]!)}>
                      <CompetitionLogo
                        name={tournament.name}
                        url={tournament.logoUrl}
                        darkUrl={tournament.logoDarkUrl}
                        size="card"
                      />
                      <strong>{tiles[at]!.label}</strong>
                      <StatusBadge status={competitionStatus(entry.content)} size="small" />
                    </Link>
                  )
                })}
          </div>
        </div>
      )}
      {crests.length > 0 && (
        <div role="group" aria-labelledby={`${listId}-teams`} className="hub-start-group">
          <div className="hub-start-head">
            <p id={`${listId}-teams`}>{text("Đội tuyển", "Teams")}</p>
          </div>
          <div className="hub-start-crests">
            {teamItems.map((item, at) => (
              <Link key={item.id} className="hub-start-crest" title={item.name} {...option(crests[at]!)}>
                <StreamImage src={item.imageUrl} darkSrc={item.imageDarkUrl} logo name={item.shortName || item.name} />
                <small>{crests[at]!.label}</small>
              </Link>
            ))}
          </div>
        </div>
      )}
      {!loading && flat.length === 0 && (
        <p className="hub-start-empty">
          {text("Gõ tên đội, tuyển thủ hoặc giải đấu.", "Type a team, player or tournament.")}
        </p>
      )}
    </div>
  )
}
