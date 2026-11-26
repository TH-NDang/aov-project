import { Fragment, useEffect, useEffectEvent, useMemo, useRef, useState, type RefObject } from "react"
import { ListFilter, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { formatClock } from "@/lib/clock"
import type { GameView } from "../../model/game-view"
import { isMajorMoment, type ItemLookups } from "../../model/item-lookups"
import {
  EVERY_MOMENT,
  isFiltered,
  momentBlocks,
  momentChoices,
  shownMoments,
  type MomentFilter,
} from "../../model/moment-rows"
import { KIND_LABELS, type SeatKey, type TimelineEvent, type TimelineKind } from "../../model/timeline"
import { DockMenuContent } from "./dock-menu"
import { seatLookup } from "./event-text"
import { MomentRow, MomentTools, type MomentActions } from "./moment-row"
import "./moments.css"

const KINDS: readonly TimelineKind[] = ["KILL", "OBJECTIVE", "ITEM", "NOTE"]

/** How long the list stays where the reader scrolled it before it follows the video again. */
const LEFT_ALONE_MS = 4000
/** Longer than a smooth scroll takes; what scrolls meanwhile is the list itself, not the reader. */
const MOVING_MS = 700

/**
 * The moments of a game in their order, blue on the left and red on the right, with the line of now between those the
 * video has shown and the later ones. The line stays in sight while the video plays or goes elsewhere.
 */
export function MomentList({
  game,
  events,
  lookups,
  now,
  activeId,
  videoAt,
  onSelect,
  ...actions
}: MomentActions & {
  game: GameView
  events: TimelineEvent[]
  lookups: ItemLookups
  /** Game second of the video; null while it shows something else than this game being played. */
  now: number | null
  activeId: string | null
  videoAt?: (event: TimelineEvent) => number
  onSelect: (event: TimelineEvent) => void
}) {
  const list = useRef<HTMLOListElement>(null)
  const [filter, setFilter] = useState<MomentFilter>(EVERY_MOMENT)
  const isMajor = useMemo(() => isMajorMoment(lookups), [lookups])
  const shown = useMemo(() => shownMoments(events, filter, isMajor), [events, filter, isMajor])
  const blocks = useMemo(() => momentBlocks(shown), [shown])
  const current = now === null ? null : blocks.filter((block) => block.start <= now).at(-1)?.id
  // The line of now stands before the first moment still to come, or under the last one.
  const next = now === null ? null : shown.find((event) => event.at > now)
  useListScroll(list, now, activeId)

  const line = now !== null && shown.length > 0 && (
    <li className="esp-moment-now" data-now aria-hidden="true">
      {formatClock(now)}
    </li>
  )
  return (
    <section className="esp-moments" aria-label={`Diễn biến ván ${game.number}`}>
      <MomentFilterBar game={game} events={events} isMajor={isMajor} filter={filter} onFilter={setFilter} />
      <ol ref={list}>
        {blocks.map((block) => (
          <li key={block.id} data-group={block.id} data-current={block.id === current || undefined}>
            {block.fight && (
              <p className="esp-fight">
                Giao tranh {block.fight.BLUE}–{block.fight.RED}
              </p>
            )}
            <ol>
              {block.events.map((event) => {
                const videoSecond = videoAt ? videoAt(event) : null
                return (
                  <Fragment key={event.id}>
                    {event === next && line}
                    <MomentRow
                      event={event}
                      game={game}
                      lookups={lookups}
                      videoSecond={videoSecond}
                      later={now !== null && event.at > now}
                      active={event.id === activeId}
                      onSelect={() => onSelect(event)}
                    >
                      <MomentTools event={event} videoSecond={videoSecond} {...actions} />
                    </MomentRow>
                  </Fragment>
                )
              })}
            </ol>
          </li>
        ))}
        {!next && line}
      </ol>
      {!shown.length && (
        <p className="esp-moments-none">
          {events.length ? "Không có diễn biến nào khớp." : `Chưa ghi diễn biến nào của ván ${game.number}.`}
        </p>
      )}
    </section>
  )
}

/**
 * Keeps the line of now, and a moment that was just selected, in the part of the dock that is seen. Where the whole page
 * scrolls, as on a phone, nothing moves it but the reader.
 */
function useListScroll(list: RefObject<HTMLOListElement | null>, now: number | null, activeId: string | null) {
  const leftAloneUntil = useRef(0)
  const movingUntil = useRef(0)
  useEffect(() => {
    const scroller = list.current?.closest<HTMLElement>(".esp-body")
    if (!scroller) return
    const onScroll = () => {
      if (Date.now() > movingUntil.current) leftAloneUntil.current = Date.now() + LEFT_ALONE_MS
    }
    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => scroller.removeEventListener("scroll", onScroll)
  }, [list])

  const bring = useEffectEvent((row: string, place: number) => {
    const target = list.current?.querySelector<HTMLElement>(row)
    const section = list.current?.closest("section")
    const scroller = section?.closest<HTMLElement>(".esp-body")
    if (!target || !section || !scroller || scroller.scrollHeight <= scroller.clientHeight) return
    const box = scroller.getBoundingClientRect()
    // The pad stays over the top of the list, unless the two stand side by side.
    const pad = section.previousElementSibling?.getBoundingClientRect()
    const over = pad && pad.right > section.getBoundingClientRect().left + 1 ? pad.height : 0
    const top = box.top + over
    const seen = target.getBoundingClientRect()
    if (seen.top >= top && seen.bottom <= box.bottom - 24) return
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    movingUntil.current = Date.now() + MOVING_MS
    scroller.scrollTo({
      top: scroller.scrollTop + seen.top - top - (box.bottom - top) * place,
      behavior: still ? "auto" : "smooth",
    })
  })

  useEffect(() => {
    if (now !== null && Date.now() > leftAloneUntil.current) bring("[data-now]", 0.5)
  }, [now])
  useEffect(() => {
    if (activeId) bring("[data-active]", 0.3)
  }, [activeId])
}

/** The filter, only where there is something to narrow; while it is on, its words stand in its place. */
function MomentFilterBar({
  game,
  events,
  isMajor,
  filter,
  onFilter,
}: {
  game: GameView
  events: TimelineEvent[]
  isMajor: (event: TimelineEvent) => boolean
  filter: MomentFilter
  onFilter: (filter: MomentFilter) => void
}) {
  const choices = useMemo(() => momentChoices(events, isMajor), [events, isMajor])
  if (choices.kinds.size < 2 && !choices.hiddenItems && !isFiltered(filter)) return null
  const seat = seatLookup(game)
  const words = [
    filter.kind && KIND_LABELS[filter.kind],
    filter.seat && (seat(filter.seat)?.playerName ?? "Chưa rõ"),
    filter.allItems && "Cả trang bị cấp 1–2",
  ]
    .filter(Boolean)
    .join(", ")
  return (
    <div className="esp-moments-bar">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="xs" variant="ghost" className="min-w-0">
            <ListFilter aria-hidden /> <span className="truncate">{words || "Lọc"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DockMenuContent align="end" className="max-h-80 w-56">
          <DropdownMenuRadioGroup
            value={filter.kind ?? ""}
            onValueChange={(kind) => onFilter({ ...filter, kind: (kind || null) as TimelineKind | null })}
          >
            <DropdownMenuRadioItem value="">Mọi diễn biến</DropdownMenuRadioItem>
            {KINDS.filter((kind) => choices.kinds.has(kind)).map((kind) => (
              <DropdownMenuRadioItem key={kind} value={kind}>
                {KIND_LABELS[kind]} <span className="esp-num ml-auto">{choices.kinds.get(kind)}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {choices.seats.size > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={filter.seat ?? ""}
                onValueChange={(key) => onFilter({ ...filter, seat: (key || null) as SeatKey | null })}
              >
                <DropdownMenuRadioItem value="">Mọi tuyển thủ</DropdownMenuRadioItem>
                {[...game.sides.BLUE.seats, ...game.sides.RED.seats]
                  .filter((entry) => choices.seats.has(entry.key))
                  .map((entry) => (
                    <DropdownMenuRadioItem key={entry.key} value={entry.key}>
                      {entry.playerName} <span className="esp-num ml-auto">{choices.seats.get(entry.key)}</span>
                    </DropdownMenuRadioItem>
                  ))}
              </DropdownMenuRadioGroup>
            </>
          )}
          {choices.hiddenItems > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filter.allItems}
                onCheckedChange={(allItems) => onFilter({ ...filter, allItems })}
              >
                Cả trang bị cấp 1–2 ({choices.hiddenItems})
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DockMenuContent>
      </DropdownMenu>
      {words && (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Bỏ lọc ${words}`}
          onClick={() => onFilter(EVERY_MOMENT)}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  )
}
