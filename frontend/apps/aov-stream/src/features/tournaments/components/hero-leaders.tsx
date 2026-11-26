import { useMemo } from "react"
import { Link } from "react-router"
import { Stage } from "../../../components/stage"
import { useStreamLocale } from "../../../components/stream-locale"
import { leaders } from "../../../lib/facts-model"
import { lineFate, type HeroLine } from "../../../lib/hero-model"
import { leaderFact, leaderTitle } from "../../../lib/leader-words"
import { statsHref } from "../../../lib/statistics-routes"
import { FactWords } from "./fact-words"
import { FateBar } from "./fate-bar"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./hero-leaders.css"

const ENDS = ["left", "center", "right"] as const

/** Fewer games than this have nobody lead them. */
const LEAST_GAMES = 3

/** The heroes a competition is led by, on one stage lit by their pictures: each with what it leads by as a fact. */
export function HeroLeaders({ data, lines }: { data: StatsData; lines: HeroLine[] }) {
  const { text, languageTag } = useStreamLocale()
  const { counted } = data
  const { games } = counted
  const shown = useMemo(() => leaders(data.records.values(), games), [data.records, games])
  if (!shown.length || games < LEAST_GAMES) return null
  return (
    <Stage
      tint={data.view.content.tournament.name}
      lights={shown.map(({ line }, at) => ({ src: line.hero.iconUrl, at: ENDS[at]! }))}
      shaded
      className="tn-leaders"
    >
      {shown.map((leader) => {
        const { hero } = leader.line
        return (
          <Link key={leader.kind} className="tn-leader" to={statsHref(data.view.id, { hero, scope: data.period?.key })}>
            <HeroPortrait hero={hero} />
            <span className="tn-leader-name">
              <span>{leaderTitle(leader, lines, counted, text)}</span>
              <strong>{hero.name}</strong>
            </span>
            <span className="tn-leader-fact">
              <span>
                <FactWords words={leaderFact(leader, counted, text, languageTag)} />
              </span>
              <FateBar fate={lineFate(leader.line, counted)} />
            </span>
          </Link>
        )
      })}
    </Stage>
  )
}
