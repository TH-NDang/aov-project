import type { CSSProperties } from "react"
import type { CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import type { PlaceZone } from "../../../lib/place-zones"
import {
  landingPath,
  markEvery,
  raceBorders,
  raceDots,
  raceLines,
  racePath,
  raceScale,
  raceShoulder,
  stepOutcomes,
  type RaceLine,
  type RaceScale,
} from "../../../lib/race-model"
import { stepMark } from "../../../lib/standing-words"
import type { StandingStep, SteppedGroup } from "../../../lib/standings-steps"
import { zoneMark } from "./standings-zone"
import "./standings-race.css"

/** The heights a race shares with the rows it runs into (standings-table.css), and that of a place without rows. */
const ROW = 52
const ZONE = 34
const PLACE = 22
/** A heading stands nearer to the rows it names, and its line with it. */
const LEAN = 3
/** The strip between the end of a line and its row, beside the table and over it. */
const BESIDE = 38
const ABOVE = 22
/** The narrowest a race beside its table gets, and the room the mark of a step needs over it. */
const FIELD = 332
const MARKS = { number: 18, day: 42 }

type Race = {
  view: CompetitionView
  steps: StandingStep[]
  group: SteppedGroup
  /** The matches of the group, for the dots of the team that is lit. */
  entries: CompetitionMatch[]
  zones: PlaceZone[]
  shown: number
  /** Whether the line of the first place is golden. */
  gold: boolean
  lit: string | null
}

const at = (step: number, last: number) => ({ "--at": step / last, "--step": 1 / last }) as CSSProperties

/** The steps over a race; the one shown wears the mark that is the thumb of the range lying over them. */
function Axis({ steps, shown }: Pick<Race, "steps" | "shown">) {
  const { languageTag } = useStreamLocale()
  const every = markEvery(steps.length, FIELD, steps[0]!.kind === "DAY" ? MARKS.day : MARKS.number)
  return (
    <div className="tn-race-axis">
      {steps.map((step, index) => {
        if (index !== shown && (index % every || Math.abs(index - shown) < every)) return null
        return (
          <span
            key={step.key}
            data-now={index === shown || undefined}
            data-near={(steps.length > 15 && Math.abs(index - shown) === 1) || undefined}
            style={at(index, steps.length - 1)}
          >
            {stepMark(step, languageTag)}
          </span>
        )
      })}
    </div>
  )
}

/** The places down the side of a race. */
function Places({ scale, count }: { scale: RaceScale; count: number }) {
  return (
    <div className="tn-race-places">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} style={{ top: scale.y(index + 1) }}>
          {index + 1}
        </span>
      ))}
    </div>
  )
}

/** Where each line has come to; the line that is lit has a dot for every match instead. */
function Dots({ line, outcomes, last }: { line: RaceLine; outcomes: (boolean | null)[][]; last: number }) {
  const end = line.stops.at(-1)
  if (!end) return null
  if (line.look !== "lit") return <i data-look={line.look} style={{ ...at(end.step, last), top: end.y }} />
  return (
    <>
      {!outcomes[end.step]?.length && <i data-look="rest" style={{ ...at(end.step, last), top: end.y }} />}
      {raceDots(line.stops, outcomes).map(({ step, after, y, won }) => (
        <i
          key={`${step}:${after}`}
          data-look="lit"
          data-outcome={won == null ? "drawn" : won ? "won" : "lost"}
          style={{ ...at(step, last), "--after": after, top: y } as CSSProperties}
        />
      ))}
    </>
  )
}

/** What lies behind the lines: where one way ends and the next begins, and the zones as bands where none is named. */
function Ground({ scale, borders, bands = [] }: { scale: RaceScale; borders: number[]; bands?: PlaceZone[] }) {
  return (
    <div className="tn-race-ground">
      {bands.map(({ from, to }, index) => (
        <span
          key={from}
          data-mark={zoneMark(bands, index)}
          style={{ top: scale.y(from) - scale.row / 2, height: scale.y(to) - scale.y(from) + scale.row }}
        />
      ))}
      {borders.map((y) => (
        <i key={y} style={{ top: y }} />
      ))}
    </div>
  )
}

/** The lines up to the step shown, and a dotted guide from the end of each on into the row of its team. */
function Lines({
  lines,
  steps,
  shown,
  scale,
  shoulder,
  outcomes,
  landing,
}: Pick<Race, "steps" | "shown"> & {
  lines: RaceLine[]
  scale: RaceScale
  shoulder: number
  outcomes: (boolean | null)[][]
  /** The width of the strip between the end of the lines and the rows. */
  landing: number
}) {
  const last = steps.length - 1
  const lit = lines.some(({ look }) => look === "lit") || undefined
  return (
    <>
      <div className="tn-race-field" data-lit={lit}>
        <svg viewBox={`0 0 ${last} ${scale.height}`} height={scale.height} preserveAspectRatio="none">
          {lines.map(({ teamId, stops, look }) => (
            <g key={teamId} data-look={look}>
              {stops.length > 0 && shown < last && (
                <path className="tn-race-guide" d={`M${last} ${stops.at(-1)!.y}H${shown}`} />
              )}
              <path className="tn-race-line" d={racePath(stops, shoulder)} />
            </g>
          ))}
        </svg>
        <span className="tn-race-now" style={at(shown, last)} />
        {lines.map((line) => (
          <Dots key={line.teamId} line={line} outcomes={outcomes} last={last} />
        ))}
      </div>
      <svg className="tn-race-landing" data-lit={lit} width={landing} height={scale.height}>
        {lines.map(
          ({ teamId, stops, row, look }) =>
            stops.length > 0 && (
              <g key={teamId} data-look={look}>
                <path className="tn-race-guide" d={landingPath(stops.at(-1)!.y, row, landing)} />
              </g>
            ),
        )}
      </svg>
    </>
  )
}

/**
 * How the teams of a table rose and fell, step by step. Beside the table the lines run into its rows; over it, where
 * there is no room beside, they end at the short names of the teams. Level teams meet in the middle of the places they
 * share, and nothing is drawn after the step shown but the guides. The table says all of it in words and figures, so
 * the drawing is hidden from screen readers.
 */
export function StandingsRace({ view, steps, group, entries, zones, shown, gold, lit }: Race) {
  const rows = group.tables[shown]!
  const beside = raceScale(rows.length, ROW, zones, ZONE)
  const above = raceScale(rows.length, PLACE)
  const outcomes = lit ? stepOutcomes(steps, entries, lit) : []
  const drawn = { steps, shown, outcomes, shoulder: raceShoulder(group) }
  return (
    <>
      <div className="tn-race" data-form="above" aria-hidden="true">
        <Places scale={above} count={rows.length} />
        <Ground scale={above} borders={raceBorders(zones, above)} bands={zones} />
        <Lines {...drawn} lines={raceLines(group, shown, above, { lit, gold })} scale={above} landing={ABOVE} />
        <div className="tn-race-names" style={{ gridAutoRows: PLACE }}>
          {rows.map(({ teamId }) => {
            const team = view.content.teams[teamId]
            return (
              <span key={teamId} data-lit={teamId === lit || undefined}>
                {team?.shortName || team?.name}
              </span>
            )
          })}
        </div>
      </div>
      <div className="tn-race" data-form="beside" aria-hidden="true">
        <Axis steps={steps} shown={shown} />
        <Places scale={beside} count={rows.length} />
        <Ground scale={beside} borders={raceBorders(zones, beside).map((y) => y + LEAN)} />
        <Lines {...drawn} lines={raceLines(group, shown, beside, { lit, gold })} scale={beside} landing={BESIDE} />
      </div>
    </>
  )
}
