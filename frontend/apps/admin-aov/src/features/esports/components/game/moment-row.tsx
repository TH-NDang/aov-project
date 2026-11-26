import { useEffect, useState, type ReactNode } from "react"
import { Check, ExternalLink, Link2, MoreHorizontal } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@aov/ui/components/dropdown-menu"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import type { GameSeat, GameView } from "../../model/game-view"
import type { ItemLookups } from "../../model/item-lookups"
import { OBJECTIVE_NAMES, momentWords } from "../../model/quick-moment"
import { ITEM_ACTION_LABELS, eventSide, objectiveActor, type SeatKey, type TimelineEvent } from "../../model/timeline"
import { HeroIcon, ItemSlot } from "../primitives"
import { DockMenuContent } from "./dock-menu"
import { seatLookup } from "./event-text"
import { ObjectiveIcon } from "./objective-icon"

const FACE = 22

function Face({ seat, fallen }: { seat?: GameSeat; fallen?: boolean }) {
  return (
    <span className="inline-flex shrink-0" data-side={seat?.side}>
      <HeroIcon
        hero={seat?.hero}
        size={FACE}
        title={seat ? `${seat.playerName}, ${seat.hero?.name ?? "chưa chọn tướng"}` : "Chưa rõ"}
        className={cn("rounded-md ring-2 ring-[var(--side,var(--border))]", fallen && "grayscale")}
      />
    </span>
  )
}

/** What one moment is, drawn on the side of the team it belongs to. */
function MomentWhat({ event, game, lookups }: { event: TimelineEvent; game: GameView; lookups: ItemLookups }) {
  const seat = seatLookup(game)
  const words = momentWords(event, game)
  switch (event.kind) {
    case "KILL":
      return (
        <>
          <Face seat={seat(event.killer)} />
          <span className="esp-moment-words" data-long>
            {words}
          </span>
          <Face seat={seat(event.victim)} fallen />
        </>
      )
    case "OBJECTIVE":
      return (
        <>
          <span className="esp-moment-art">
            <ObjectiveIcon objective={event.objective} size={24} />
          </span>
          <span className="esp-moment-words">{words}</span>
        </>
      )
    case "ITEM":
      return (
        <>
          <Face seat={seat(event.seat)} />
          <ItemSlot
            item={event.item ?? null}
            iconUrl={event.item ? lookups.itemIcon(event.item) : null}
            index={event.slot - 1}
            size={FACE}
          />
          <span className="esp-moment-words" data-long>
            {event.item?.name ?? "Trang bị"}
          </span>
        </>
      )
    case "NOTE":
      return null
  }
}

/** What a moment says beyond its row: who helped, who finished it, which slot, whose moment it was. */
function momentDetail(event: TimelineEvent, game: GameView, lookups: ItemLookups): string | null {
  const name = (key?: SeatKey) => seatLookup(game)(key)?.playerName ?? "Chưa rõ"
  switch (event.kind) {
    case "KILL": {
      const helped = event.assists.length ? `, hỗ trợ: ${event.assists.map(name).join(", ")}` : ""
      return `${name(event.killer)} hạ ${name(event.victim)}${helped}`
    }
    case "OBJECTIVE":
      return event.by ? `${objectiveActor(event.objective)}: ${name(event.by)}` : null
    case "ITEM": {
      const tier = event.item ? lookups.itemTier(event.item) : null
      const action = ITEM_ACTION_LABELS[event.action].toLocaleLowerCase("vi")
      const slots = event.toSlot ? `ô ${event.slot} → ô ${event.toSlot}` : `ô ${event.slot}`
      return [`${name(event.seat)} ${action}`, slots, tier && `cấp ${tier}`].filter(Boolean).join(", ")
    }
    case "NOTE":
      return event.side ? game.sides[event.side].team.name : null
  }
}

/** How a screen reader hears a moment: what it was, of which team, and both its times. */
function momentLabel(event: TimelineEvent, game: GameView, videoSecond: number | null) {
  const what =
    event.kind === "OBJECTIVE"
      ? `${OBJECTIVE_NAMES[event.objective]} của ${game.sides[event.side].team.name}`
      : momentWords(event, game)
  return `${what} lúc ${formatClock(event.at)} trong ván${videoSecond === null ? "" : `, ▸${formatClock(videoSecond)}`}`
}

/**
 * One moment of the list: blue on the left of its time, red on the right, a moment of neither under it. Pressing it goes
 * there and selects it; the selected row carries what else is known and, as children, what can be done with it.
 */
export function MomentRow({
  event,
  game,
  lookups,
  videoSecond,
  later,
  active,
  onSelect,
  children,
}: {
  event: TimelineEvent
  game: GameView
  lookups: ItemLookups
  /** Where the moment is in the video, when the game has a place there. */
  videoSecond: number | null
  /** The video has not reached it yet. */
  later: boolean
  active: boolean
  onSelect: () => void
  children?: ReactNode
}) {
  // A kill nobody is named for still stands on one side of the list.
  const side = event.kind === "NOTE" ? null : (eventSide(event) ?? "BLUE")
  const detail = active ? momentDetail(event, game, lookups) : null
  return (
    <li
      className="esp-moment-item"
      data-event={event.id}
      data-kind={event.kind}
      data-active={active || undefined}
      data-later={later || undefined}
    >
      <button
        type="button"
        className="esp-moment"
        aria-current={active ? "true" : undefined}
        aria-label={momentLabel(event, game, videoSecond)}
        onClick={onSelect}
      >
        <span className="esp-moment-time">{formatClock(event.at)}</span>
        {side ? (
          <span className="esp-moment-what" data-side={side}>
            <MomentWhat event={event} game={game} lookups={lookups} />
          </span>
        ) : (
          // A long title is cut in the list; pointed at it is said whole, and the selected row has room for all of it.
          <span
            className={cn("esp-moment-title", active && "whitespace-normal [overflow-wrap:anywhere]")}
            title={momentWords(event, game)}
          >
            {momentWords(event, game)}
          </span>
        )}
      </button>
      {active && (
        <div className="esp-moment-more">
          {detail && <p>{detail}</p>}
          {event.note && <p className="esp-moment-note">{event.note}</p>}
          {children && <div className="esp-moment-acts">{children}</div>}
        </div>
      )}
    </li>
  )
}

/** What can be done with a moment; the two links are there while viewing too. */
export type MomentActions = {
  onMove?: (event: TimelineEvent, seconds: 1 | -1) => void
  onEdit?: (event: TimelineEvent) => void
  onDelete?: (event: TimelineEvent) => void
  /** Link to this page at the moment, and to the moment on YouTube, when the game has a place in its video. */
  shareLink?: (event: TimelineEvent) => string
  youtubeLink?: (event: TimelineEvent) => string
}

/** The actions of the selected moment. Recording, the links are behind the dots; viewing, they are all there is. */
export function MomentTools({
  event,
  videoSecond,
  onMove,
  onEdit,
  onDelete,
  shareLink,
  youtubeLink,
}: MomentActions & { event: TimelineEvent; videoSecond: number | null }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])
  const copy = () =>
    void navigator.clipboard
      ?.writeText(shareLink!(event))
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  const copyWords = (
    <>
      {copied ? <Check aria-hidden /> : <Link2 aria-hidden />} {copied ? "Đã chép" : "Chép liên kết"}
    </>
  )
  const youtube = youtubeLink?.(event)
  const watchWords = `Mở trên YouTube${videoSecond === null ? "" : ` lúc ▸${formatClock(videoSecond)}`}`

  if (!onEdit && !onDelete)
    return (
      <>
        {shareLink && (
          <Button type="button" size="xs" variant="ghost" onClick={copy}>
            {copyWords}
          </Button>
        )}
        {youtube && (
          <Button asChild size="xs" variant="ghost">
            <a href={youtube} target="_blank" rel="noreferrer" title={watchWords}>
              <ExternalLink aria-hidden /> Mở trên YouTube
            </a>
          </Button>
        )}
      </>
    )
  return (
    <>
      {/* An item depends on what the slots held just before it, so its time is changed in its form. */}
      {onMove && event.kind !== "ITEM" && (
        <>
          <Button type="button" size="xs" variant="ghost" onClick={() => onMove(event, -1)}>
            −1 giây
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => onMove(event, 1)}>
            +1 giây
          </Button>
        </>
      )}
      {onEdit && (
        <Button type="button" size="xs" variant="ghost" onClick={() => onEdit(event)}>
          Sửa
        </Button>
      )}
      {onDelete && (
        <Button type="button" size="xs" variant="ghost" onClick={() => onDelete(event)}>
          Xóa
        </Button>
      )}
      {(shareLink || youtube) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-xs" variant="ghost" aria-label="Liên kết của diễn biến này">
              {copied ? <Check aria-hidden /> : <MoreHorizontal aria-hidden />}
            </Button>
          </DropdownMenuTrigger>
          <DockMenuContent align="end">
            {shareLink && <DropdownMenuItem onSelect={copy}>{copyWords}</DropdownMenuItem>}
            {youtube && (
              <DropdownMenuItem asChild>
                <a href={youtube} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden /> {watchWords}
                </a>
              </DropdownMenuItem>
            )}
          </DockMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}
