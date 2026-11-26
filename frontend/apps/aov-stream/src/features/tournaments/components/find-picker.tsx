import { useMemo, useRef, useState, type KeyboardEvent } from "react"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText, laneName } from "../../../lib/feed-words"
import type { HeroRole, Question } from "../../../lib/finder-model"
import type { FeedHero } from "../../../lib/game-feed"
import { heroOffers, narrowOffers, tileAfter, type HeroOffer } from "../../../lib/hero-offer"
import { LANES } from "../../../lib/tournament-model"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./find-picker.css"

/** The faces on offer, of which one at a time is in the tab order; the arrow keys go from face to face. */
function Tiles({
  offers,
  first,
  onChoose,
  onLeave,
}: {
  offers: HeroOffer[]
  /** The first face is what Enter in the search takes. */
  first: boolean
  onChoose: (hero: FeedHero) => void
  onLeave: () => void
}) {
  const { text, languageTag } = useStreamLocale()
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const move = (event: KeyboardEvent) => {
    const tiles = [...(list.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])]
    const at = tiles.findIndex((tile) => tile === document.activeElement)
    if (at < 0) return
    const columns = tiles.filter((tile) => tile.offsetTop === tiles[0]!.offsetTop).length
    const next = tileAfter(event.key, at, columns, tiles.length)
    if (next == null) return
    event.preventDefault()
    if (next < 0) onLeave()
    else {
      setActive(next)
      tiles[next]!.focus()
    }
  }
  const tab = Math.min(active, offers.length - 1)
  return (
    <div
      ref={list}
      className="tn-find-tiles"
      role="listbox"
      aria-label={text("Tướng, số ván còn lại", "Heroes, games left")}
      onKeyDown={move}
    >
      {offers.map(({ hero, games }, index) => (
        <button
          key={hero.key}
          type="button"
          role="option"
          aria-selected={false}
          aria-label={`${hero.name}, ${gamesText(games, text, languageTag)}`}
          tabIndex={index === tab ? 0 : -1}
          data-first={(first && index === 0) || undefined}
          onFocus={() => setActive(index)}
          onClick={() => onChoose(hero)}
        >
          <HeroPortrait hero={hero} />
          <span>{hero.name}</span>
          <small>{gamesText(games, text, languageTag)}</small>
        </button>
      ))}
    </div>
  )
}

/** The choice of a hero for a seat: every hero that leaves games, with how many, narrowed by name and by lane. */
export function FindPicker({
  data,
  question,
  role,
  onChoose,
}: {
  data: StatsData
  question: Question
  role: HeroRole
  onChoose: (hero: FeedHero) => void
}) {
  const { text } = useStreamLocale()
  const [search, setSearch] = useState("")
  const [lane, setLane] = useState<Lane | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // On a phone Enter is the key that puts the keyboard away.
  const enters = usePageLayout() === "wide" && !!search.trim()
  const offers = useMemo(
    () => heroOffers(data.feed, data.records, question, role),
    [data.feed, data.records, question, role],
  )
  const shown = narrowOffers(offers, search, lane)
  const lanes = LANES.filter((item) => offers.some((offer) => offer.lanes.includes(item)))
  return (
    <div ref={body} className="tn-find-picker-body">
      <div className="tn-find-picker-head">
        <label className="tn-find-search">
          <StreamIcon name="search" size={16} />
          <input
            ref={input}
            type="search"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={40}
            placeholder={text("Tìm tướng", "Find a hero")}
            aria-label={text("Tìm tướng", "Find a hero")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                body.current?.querySelector<HTMLElement>("[role=option][tabindex='0']")?.focus()
              }
              if (event.key !== "Enter") return
              if (!enters) event.currentTarget.blur()
              else if (shown[0]) onChoose(shown[0].hero)
            }}
          />
        </label>
        {lanes.length > 1 && (
          <div className="tn-find-lanes" role="group" aria-label={text("Đường", "Lane")}>
            {lanes.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={lane === item}
                aria-label={laneName(item, text)}
                title={laneName(item, text)}
                onClick={() => setLane(lane === item ? null : item)}
              >
                <HeroLaneIcon lane={item} size={18} />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="sr-only" role="status">
        {text(`${shown.length} tướng`, `${shown.length} ${shown.length === 1 ? "hero" : "heroes"}`)}
      </p>
      {shown.length ? (
        <Tiles
          key={`${search}|${lane}`}
          offers={shown}
          first={enters}
          onChoose={onChoose}
          onLeave={() => input.current?.focus({ preventScroll: true })}
        />
      ) : (
        <p className="tn-find-none">
          {search.trim()
            ? text(`Không có tướng nào tên “${search.trim()}” ở các ván này.`, `No hero named “${search.trim()}” here.`)
            : text("Không có tướng nào ở các ván này.", "No hero in these games.")}
        </p>
      )}
    </div>
  )
}
