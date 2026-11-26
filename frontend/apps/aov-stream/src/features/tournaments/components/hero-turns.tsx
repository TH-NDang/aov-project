import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react"
import { Link } from "react-router"
import type { DraftKind, Side } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import type { DraftAct } from "../../../lib/draft-shape"
import { gamesText } from "../../../lib/feed-words"
import type { FeedHero } from "../../../lib/game-feed"
import { orderedGames, type StaffTurn } from "../../../lib/hero-page-model"
import { statsHref } from "../../../lib/statistics-routes"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./hero-turns.css"

const KINDS: Record<DraftKind, readonly [string, string]> = { BAN: ["Cấm", "Bans"], PICK: ["Chọn", "Picks"] }
const SIDES: Record<Side, readonly [string, string]> = {
  BLUE: ["bên xanh", "blue side"],
  RED: ["bên đỏ", "red side"],
}

/** The arrow keys go from bar to bar, so the chart is one stop of the Tab key. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const bars = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a")]
  const at = bars.findIndex((bar) => bar === document.activeElement)
  const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: bars.length - 1 }[event.key]
  if (at < 0 || to == null) return
  event.preventDefault()
  bars[to]?.focus()
}

/** A turn of the draft: the bar stands above the line for the blue side and hangs below it for the red one. */
function Beat({
  data,
  at: { turn, games, question },
  name,
  most,
  stop,
  onFocus,
}: {
  data: StatsData
  at: StaffTurn
  name: string
  most: number
  stop: boolean
  onFocus: () => void
}) {
  const { text, languageTag } = useStreamLocale()
  const count = gamesText(games, text, languageTag)
  return (
    <li
      className="tn-turns-beat"
      data-side={turn.side}
      data-kind={turn.kind}
      style={{ "--share": games / most } as CSSProperties}
    >
      {games > 0 && (
        <Link
          to={statsHref(data.view.id, { question, scope: data.period?.key })}
          tabIndex={stop ? 0 : -1}
          onFocus={onFocus}
          aria-label={text(`Lượt ${turn.turn}, ${name}: ${count}`, `Turn ${turn.turn}, ${name}: ${count}`)}
        >
          <i aria-hidden="true" />
          <b aria-hidden="true">{games.toLocaleString(languageTag)}</b>
        </Link>
      )}
    </li>
  )
}

/** The staff in words, for readers who do not see it. */
function StaffTable({ staff, hero }: { staff: StaffTurn[]; hero: FeedHero }) {
  const { text } = useStreamLocale()
  // A table keeps the size of its rows whatever width and height it is given, so a box around it hides it.
  return (
    <div className="sr-only">
      <table>
        <caption>{text(`${hero.name} theo từng lượt cấm chọn`, `${hero.name} turn by turn of the draft`)}</caption>
        <thead>
          <tr>
            <th scope="col">{text("Lượt", "Turn")}</th>
            <th scope="col">{text("Bên", "Side")}</th>
            <th scope="col">{text("Cấm hay chọn", "Ban or pick")}</th>
            <th scope="col">{text("Số ván", "Games")}</th>
          </tr>
        </thead>
        <tbody>
          {staff.map(({ turn, games }) => (
            <tr key={turn.turn}>
              <th scope="row">{turn.turn}</th>
              <td>{text(...SIDES[turn.side])}</td>
              <td>{turn.kind === "BAN" ? text("cấm", "ban") : text("chọn", "pick")}</td>
              <td>{games}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * When in a draft a hero is taken, as a staff of its turns: those of the blue side stand above the line, those of the
 * red side below it, bans hollow. Every bar opens the games it counts.
 */
export function HeroTurns({
  data,
  hero,
  acts,
  staff,
}: {
  data: StatsData
  hero: FeedHero
  acts: DraftAct[]
  staff: StaffTurn[]
}) {
  const { text, languageTag } = useStreamLocale()
  const { games } = data.feed
  const ordered = useMemo(() => orderedGames(games), [games])
  const [current, setCurrent] = useState<number | null>(null)
  const taken = staff.filter((item) => item.games > 0)
  const stop = taken.find(({ turn }) => turn.turn === current) ?? taken[0]
  const most = Math.max(...taken.map((item) => item.games))
  // Each side of the line is as tall as its own longest bar needs.
  const reach = (side: Side) =>
    Math.max(0, ...taken.filter(({ turn }) => turn.side === side).map((item) => item.games)) / most
  const of = new Map(staff.map((item) => [item.turn.turn, item]))
  const actName = (kind: DraftKind, nth: number) =>
    acts.filter((act) => act.kind === kind).length > 1 ? `${text(...KINDS[kind])} ${nth}` : text(...KINDS[kind])
  const turnName = ({ turn: { side, kind } }: StaffTurn) =>
    text(
      `${SIDES[side][0]} ${kind === "BAN" ? "cấm" : "chọn"} ${hero.name}`,
      `${SIDES[side][1]} ${kind === "BAN" ? "bans" : "picks"} ${hero.name}`,
    )
  // Two acts share a line on a phone.
  const columns = Math.max(...acts.map(({ turns }, index) => turns.length + (acts[index ^ 1]?.turns.length ?? 0)))
  const known = ordered.toLocaleString(languageTag)
  const all = games.length.toLocaleString(languageTag)
  return (
    <Section
      id="hero-turns"
      title={text("Lúc nào trong lượt cấm chọn", "When in the draft")}
      note={text(`${known} trong ${all} ván có ghi thứ tự`, `${known} of ${all} games record the order`)}
    >
      <div className="tn-turns">
        <ul className="tn-turns-legend">
          <li data-side="BLUE">{text("bên xanh, trên vạch", "blue side, above the line")}</li>
          <li data-side="RED">{text("bên đỏ, dưới vạch", "red side, below the line")}</li>
          <li data-kind="BAN">{text("cấm", "bans")}</li>
        </ul>
        <div
          className="tn-turns-acts"
          role="group"
          aria-label={text("Các lượt cấm chọn", "Turns of the draft")}
          style={{ "--up": reach("BLUE"), "--down": reach("RED"), "--columns": columns } as CSSProperties}
          onKeyDown={moveFocus}
        >
          {acts.map(({ kind, nth, turns }) => (
            <div className="tn-turns-act" key={`${kind}${nth}`} style={{ "--turns": turns.length } as CSSProperties}>
              <h3>{actName(kind, nth)}</h3>
              <ol>
                {turns.map(({ turn }) => {
                  const at = of.get(turn)!
                  return (
                    <Beat
                      key={turn}
                      data={data}
                      at={at}
                      name={turnName(at)}
                      most={most}
                      stop={at === stop}
                      onFocus={() => setCurrent(turn)}
                    />
                  )
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>
      <StaffTable staff={staff} hero={hero} />
    </Section>
  )
}
