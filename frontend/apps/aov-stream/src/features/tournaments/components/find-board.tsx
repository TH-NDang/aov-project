import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { Stage } from "../../../components/stage"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  asksAnything,
  heroChoices,
  ROLE_SEATS,
  withHero,
  type HeroRole,
  type Question,
} from "../../../lib/finder-model"
import type { FeedHero } from "../../../lib/game-feed"
import { useEntryState } from "../../../lib/use-entry-state"
import { FindFoot } from "./find-filters"
import { FindOverlay } from "./find-overlay"
import { FindPanel } from "./find-panel"
import { FindPicker } from "./find-picker"
import type { Finder, Spot } from "./find-question"
import { AddSeat, FilledSeat, ROLE_NAMES } from "./find-seat"
import { FindStrip } from "./find-strip"
import { FindTeam, SIDE_NAMES } from "./find-team"
import "./find-board.css"

/** The seats of one side in a game. */
const SEATS = 5

/** The seat a panel is open at: the next empty one of a role, or that of a hero. */
type Opened = { role: HeroRole; hero: FeedHero | null }

/** The one panel of the board: which seat it is open at, and where the focus goes when it closes. */
function useSeatPanel({ ask, land }: Finder) {
  const [seat, setSeat] = useState<Opened | null>(null)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLElement | null>(null)
  const landing = useRef<Spot | "seat" | null>("seat")
  return {
    seat,
    open,
    anchor,
    isOpen: (role: HeroRole, hero: FeedHero | null) => open && seat?.role === role && seat.hero?.key === hero?.key,
    show: (at: HTMLElement, role: HeroRole, hero: FeedHero | null) => {
      const again = open && anchor.current === at
      landing.current = "seat"
      anchor.current = at
      if (!again) setSeat({ role, hero })
      setOpen(!again)
    },
    /** Asks what was chosen in the panel, which closes it. */
    choose: (next: Question, spot: Spot) => {
      landing.current = spot
      setOpen(false)
      ask(next)
    },
    close: (left: boolean) => {
      if (left) landing.current = null
      setOpen(false)
    },
    closed: () => {
      const to = landing.current
      landing.current = "seat"
      if (to === "seat") anchor.current?.focus({ preventScroll: true })
      else if (to) land(to)
    },
  }
}

type SeatPanel = ReturnType<typeof useSeatPanel>

/** The seats of some roles in one row: the heroes asked for, then the next seat while any hero would leave a game. */
function Seats({
  finder,
  panel,
  label,
  name,
  slot,
  roles,
  add,
  after,
  least = 0,
}: {
  finder: Finder
  panel: SeatPanel
  /** The word over the row, and what the row is in full. */
  label: string
  name: string
  slot: "a" | "b" | "bans"
  roles: HeroRole[]
  /** The role of the next seat, and the one that stands after it. */
  add: HeroRole
  after?: HeroRole
  /** How many seats the row shows at least. */
  least?: number
}) {
  const { question, data } = finder
  const filled = [...roles, ...(after ? [after] : [])].flatMap((role) => question[role])
  const free = question[add].length < ROLE_SEATS[add] && heroChoices(data.feed.games, question, add).size > 0
  const taken = filled.length + Number(free)
  const blank = Math.max(0, least - taken)
  if (!filled.length && !free && !least) return null
  const seats = (role: HeroRole) =>
    question[role].map((hero) => (
      <FilledSeat
        key={`${role}:${hero.key}`}
        hero={hero}
        role={role}
        opened={panel.isOpen(role, hero)}
        onOpen={(at) => panel.show(at, role, hero)}
      />
    ))
  return (
    <div
      className="tn-find-seats"
      data-slot={slot}
      data-size={taken > 4 ? "small" : taken > 3 ? "middle" : undefined}
      role="group"
      aria-label={name}
    >
      <span className="tn-find-label" aria-hidden="true">
        {label}
      </span>
      <div>
        {roles.map(seats)}
        {free && <AddSeat role={add} opened={panel.isOpen(add, null)} onOpen={(at) => panel.show(at, add, null)} />}
        {after && seats(after)}
        {Array.from({ length: blank }, (_, index) => (
          <i key={index} className="tn-find-seat" />
        ))}
      </div>
    </div>
  )
}

/** What the seat in question offers, in a panel at it. */
function SeatOverlay({ finder, panel }: { finder: Finder; panel: SeatPanel }) {
  const { text } = useStreamLocale()
  const { seat, choose } = panel
  const role = text(...ROLE_NAMES[seat?.role ?? "pick"])
  return (
    <FindOverlay
      open={panel.open}
      anchor={panel.anchor}
      title={role}
      label={seat?.hero ? `${seat.hero.name}, ${role}` : role}
      className={seat?.hero ? "tn-find-panel" : "tn-find-picker"}
      onClose={panel.close}
      onClosed={panel.closed}
    >
      {seat?.hero ? (
        <FindPanel finder={finder} hero={seat.hero} role={seat.role} onAsk={choose} />
      ) : (
        seat && (
          <FindPicker
            data={finder.data}
            question={finder.question}
            role={seat.role}
            onChoose={(hero) => choose(withHero(finder.question, seat.role, hero), "answer")}
          />
        )
      )}
    </FindOverlay>
  )
}

/**
 * What a reader looks for, laid out like a draft on the columns of the list below: a team and its picks, the bans, and
 * the picks and the team it met. On a phone the board of a question that was arrived at is folded into one line, which
 * it stays when the reader comes back to it; a question that asks nothing any more has the board open again.
 */
export function FindBoard({ finder }: { finder: Finder }) {
  const { text } = useStreamLocale()
  const { data, question, land } = finder
  const compact = usePageLayout() === "compact"
  const [folded, setFolded] = useEntryState<boolean>("board folded", compact && asksAnything(question))
  if (folded && !asksAnything(question)) setFolded(false)
  const panel = useSeatPanel(finder)
  const board = useRef<HTMLElement>(null)
  const { name, logoUrl, logoDarkUrl } = data.view.content.tournament
  const light = { src: logoUrl, darkSrc: logoDarkUrl }
  const drafted = data.whole.heroes.length > 0
  const side = (slot: "a" | "b") => {
    const role = slot === "a" ? "pick" : "vs"
    return (
      <Seats
        finder={finder}
        panel={panel}
        label={text(...SIDE_NAMES[slot])}
        name={text(...ROLE_NAMES[role])}
        slot={slot}
        roles={[role]}
        add={role}
        least={SEATS}
      />
    )
  }
  const unfold = () => {
    flushSync(() => setFolded(false))
    board.current?.querySelector<HTMLElement>(".tn-find-team")?.focus()
  }
  return (
    <Stage
      tint={name}
      lights={[
        { ...light, at: "left" },
        { ...light, at: "right" },
      ]}
      className="tn-find-stage"
    >
      <section
        ref={board}
        className="tn-find-board"
        data-folded={folded || undefined}
        aria-label={text("Bàn cấm chọn để tìm ván", "The draft board to find games with")}
      >
        <button type="button" className="tn-find-skip" onClick={() => land("answer")}>
          {text("Đến các ván tìm được", "To the games found")}
        </button>
        {folded && <FindStrip finder={finder} onEdit={unfold} />}
        {drafted ? (
          <div className="tn-line-cols tn-find-cols">
            <FindTeam finder={finder} slot="a" />
            {side("a")}
            <Seats
              finder={finder}
              panel={panel}
              label={text("Cấm", "Bans")}
              name={text(...ROLE_NAMES.ban)}
              slot="bans"
              roles={["banA", "ban"]}
              add="ban"
              after="banB"
            />
            {side("b")}
            <FindTeam finder={finder} slot="b" />
          </div>
        ) : (
          <div className="tn-find-pair">
            <FindTeam finder={finder} slot="a" />
            <span aria-hidden="true">{text("gặp", "against")}</span>
            <FindTeam finder={finder} slot="b" />
            <p>{text("Giải này chưa ghi tướng của các ván.", "The heroes of these games are not recorded yet.")}</p>
          </div>
        )}
        <FindFoot finder={finder} />
      </section>
      <SeatOverlay finder={finder} panel={panel} />
    </Stage>
  )
}
