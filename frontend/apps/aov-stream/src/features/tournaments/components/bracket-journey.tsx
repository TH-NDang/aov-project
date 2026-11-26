import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { journeyEnd, type JourneyEnd, type JourneyStop } from "../../../lib/bracket-journey"
import { bracketRoundName, type BracketLayout } from "../../../lib/bracket-model"
import { competitionMatchHref } from "../../../lib/match-model"
import "./bracket-journey.css"

const ENDS: Record<JourneyEnd, readonly [vi: string, en: string] | null> = {
  champion: ["Vô địch", "Champion"],
  "runner-up": ["Á quân", "Runner-up"],
  out: ["Dừng bước", "Knocked out"],
  open: null,
}

/** A team's way through the bracket in words: every match in order, its opponent and its score. */
export function JourneyStrip({
  view,
  layout,
  teamId,
  stops,
}: {
  view: CompetitionView
  layout: BracketLayout
  teamId: string
  stops: JourneyStop[]
}) {
  const { text, languageTag } = useStreamLocale()
  const team = view.content.teams[teamId]
  // Where no match leads to another, a lost one says nothing of what comes next.
  const end = layout.links.length ? journeyEnd(layout, stops) : "open"
  const word = ENDS[end]
  return (
    <div className="tn-journey" data-end={end} aria-live="polite">
      <p className="tn-journey-team">
        <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || team?.name || "?"} />
        <span>
          <b>{team?.name}</b>
          {word && (
            <small>
              {end === "champion" && <StreamIcon name="trophy" size={14} />}
              {text(word[0], word[1])}
            </small>
          )}
        </span>
      </p>
      <ol>
        {stops.map((stop, index) => {
          const { entry } = stop.node
          const rival = stop.opponentId ? view.content.teams[stop.opponentId] : undefined
          return (
            <li key={entry.match.key} data-outcome={stop.outcome ?? undefined}>
              <Link to={competitionMatchHref(entry.competition.id, entry.match.key)}>
                <span className="tn-journey-number">{index + 1}</span>
                <span className="tn-journey-round">{bracketRoundName(stop.node.round, languageTag)}</span>
                <span className="tn-journey-rival">
                  <b>{stop.score ? `${stop.score[0]}–${stop.score[1]}` : "vs"}</b>
                  <span>{rival?.shortName || rival?.name || text("Chờ xác định", "TBD")}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** The measures the trail needs to find a card on the drawing. */
export type TrailMeasures = {
  card: number
  gap: number
  height: number
  /** Height of the line above a card's two teams. */
  head: number
  top: (stop: JourneyStop) => number
}

const CORNER = 9

/** From one match to the next: level out of the card, one rounded turn in the gap, level into the other. */
function leg(from: { x: number; y: number }, to: { x: number; y: number }, gap: number) {
  const dy = to.y - from.y
  const turn = to.x - gap / 2
  const r = Math.min(CORNER, Math.abs(dy) / 2)
  if (r < 1) return `M${from.x} ${from.y}H${to.x}`
  const way = Math.sign(dy)
  return `M${from.x} ${from.y}H${turn - r}Q${turn} ${from.y} ${turn} ${from.y + way * r}V${to.y - way * r}Q${turn} ${to.y} ${turn + r} ${to.y}H${to.x}`
}

/**
 * A team's way drawn over the bracket as one line of light: solid where it won and went on, dashed where it fell to
 * the lower bracket, gold when the way ends with the title.
 */
export function JourneyTrail({
  stops,
  end,
  measures,
}: {
  stops: JourneyStop[]
  end: JourneyEnd
  measures: TrailMeasures
}) {
  const { card, gap, height, head, top } = measures
  if (!card) return null
  const row = (stop: JourneyStop) => top(stop) + head + ((height - head) / 4) * (stop.side === "a" ? 1 : 3)
  const x = (stop: JourneyStop) => stop.node.column * (card + gap)
  return (
    <svg className="tn-trail" data-end={end} aria-hidden="true">
      {stops.slice(1).map((stop, index) => {
        const before = stops[index]!
        return (
          <path
            key={stop.node.entry.match.key}
            d={leg({ x: x(before) + card, y: row(before) }, { x: x(stop), y: row(stop) }, gap)}
            pathLength={1}
            data-fell={before.outcome === "lost" || undefined}
            style={{ animationDelay: `${index * 140}ms` }}
          />
        )
      })}
    </svg>
  )
}

/** The width of a card on screen, which the sheet sets from the room there is. */
export function useCardWidth(columns: number, gap: number) {
  const plan = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState(0)
  useEffect(() => {
    const element = plan.current
    if (!element) return
    const measure = () => setCard((element.offsetWidth + gap) / columns - gap)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [columns, gap])
  return { plan, card }
}
