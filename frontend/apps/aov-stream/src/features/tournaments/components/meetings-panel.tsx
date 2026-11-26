import { useId, useRef, useState, type RefObject } from "react"
import type { CompetitionView } from "@aov/community-contracts"
import { PopoverAnchor } from "@aov/ui/components/popover"
import { Popover, PopoverContent } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import type { GameFeed } from "../../../lib/game-feed"
import { meetingsBetween, type Meetings } from "../../../lib/meetings-model"
import { pairName } from "../../../lib/meetings-words"
import { namesOf } from "../../../lib/question-words"
import { MeetingsCard, type Pair } from "./meetings-card"
import { MeetingsCrest } from "./meetings-crest"
import "./meetings-panel.css"

function Panel({
  view,
  meetings,
  feed,
  pair,
  open,
  anchor,
  onOpenChange,
}: {
  view: CompetitionView
  meetings: Meetings
  feed: GameFeed | null
  pair: Pair
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onOpenChange: (open: boolean) => void
}) {
  const { text } = useStreamLocale()
  const wide = usePageLayout() === "wide"
  const id = useId()
  const elsewhere = useRef(false)
  const title = pairName(pair.team, pair.opponent, namesOf(view, text), text)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {wide && <PopoverAnchor virtualRef={anchor as RefObject<HTMLElement>} />}
      <PopoverContent
        drawerTitle={title}
        aria-labelledby={id}
        sideOffset={6}
        collisionPadding={16}
        className="hub-popover tn-meet-panel"
        // Without a trigger of its own the panel has to tell a press on its cell, which closes it, from one elsewhere,
        // which keeps the focus it took.
        onInteractOutside={(event) => {
          if (anchor.current?.contains(event.target as Node)) event.preventDefault()
          else elsewhere.current = wide
        }}
        // The first thing to focus may be the time of a match, which would open what it was converted from.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (!elsewhere.current) anchor.current?.focus({ preventScroll: true })
          elsewhere.current = false
        }}
      >
        {wide && (
          <h4 className="tn-meet-title" id={id}>
            <MeetingsCrest view={view} teamId={pair.team} />
            {title}
            <MeetingsCrest view={view} teamId={pair.opponent} />
          </h4>
        )}
        <MeetingsCard list={meetingsBetween(meetings, pair.team, pair.opponent)} pair={pair} feed={feed} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The card of one pair at a time: beside the cell that opened it, or as a sheet on a phone. One card serves all cells of
 * a table, so a table of eighty cells does not hold eighty overlays.
 */
export function useMeetingsPanel(view: CompetitionView, meetings: Meetings, feed: GameFeed | null) {
  const [pair, setPair] = useState<Pair | null>(null)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLElement | null>(null)
  const isOpen = ({ team, opponent }: Pair) => open && pair?.team === team && pair.opponent === opponent
  return {
    isOpen,
    toggle: (next: Pair, cell: HTMLElement) => {
      anchor.current = cell
      setOpen(!isOpen(next))
      setPair(next)
    },
    panel: pair && (
      <Panel
        view={view}
        meetings={meetings}
        feed={feed}
        pair={pair}
        open={open}
        anchor={anchor}
        onOpenChange={setOpen}
      />
    ),
  }
}
