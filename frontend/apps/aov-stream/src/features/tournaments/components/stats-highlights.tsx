import { useMemo, type ReactNode } from "react"
import { comebacks, pairRecords, sidesOf, teamHeroRecords, trends } from "../../../lib/facts-model"
import { factRoom, isTelling, rarePicks, splitStacks, topMvps, type FactRoom } from "../../../lib/highlights"
import { mvpRecords } from "../../../lib/team-draft-model"
import { useWidth } from "../../../lib/use-width"
import { FactComebacks } from "./fact-comebacks"
import { FewGames } from "./fact-few"
import { FactLengths } from "./fact-lengths"
import { FactMvps } from "./fact-mvps"
import { FactOnce } from "./fact-once"
import { FactRecords } from "./fact-records"
import { FactSides } from "./fact-sides"
import { FactTrends, TRENDS } from "./fact-trends"
import { LaneStage } from "./lane-stage"
import type { StatsData } from "./stats-data"
import "./stats-highlights.css"

/** Records of heroes with a team that are told. */
const TEAM_RECORDS = 4

/** A fact with about how tall it stands, in pixels, so that two stacks of them end about level. */
type Fact = { key: string; height: number; node: ReactNode }

/** The height of a fact of some lines: its heading, then the lines. */
const tall = (lines: number, height: number) => 42 + lines * height
const sum = (counts: number[]) => counts.reduce((total, count) => total + count, 0)

/** What the games counted have evidence of, in the order it is read; some stand taller where the room is narrow. */
function factsOf(data: StatsData, room: FactRoom): Fact[] {
  const { feed, whole, period, records, view } = data
  const games = feed.games.length
  const told = {
    teams: teamHeroRecords(feed, TEAM_RECORDS).filter(isTelling),
    pairs: pairRecords(records, "with", games).filter(isTelling),
    duels: pairRecords(records, "against", games).filter(isTelling),
  }
  const groups = [told.teams, told.pairs, told.duels].map((group) => group.length).filter(Boolean)
  const sides = sidesOf(feed, whole)
  const mvps = topMvps(mvpRecords(feed).filter(({ playerId }) => view.content.players[playerId]))
  const turned = comebacks(feed)
  // A part of the competition has no parts of its own to compare.
  const changes = period ? null : trends(whole)
  const ways = changes ? [changes.up, changes.down].map((way) => Math.min(way.length, TRENDS)).filter(Boolean) : []
  const once = rarePicks(records)
  const facts: (Fact | false)[] = [
    groups.length > 0 && {
      key: "records",
      height: tall(sum(groups), 69) + groups.length * 46 - 24,
      node: <FactRecords data={data} records={told} />,
    },
    feed.games.some((game) => game.seconds) && {
      key: "lengths",
      height: room === "wide" ? 467 : 666,
      node: <FactLengths data={data} />,
    },
    sides.blue + sides.red > 0 && { key: "sides", height: 128, node: <FactSides data={data} sides={sides} /> },
    mvps.rows.length > 0 && {
      key: "mvps",
      height: tall(mvps.rows.length, 57),
      node: <FactMvps data={data} mvps={mvps} />,
    },
    turned.length > 0 && {
      key: "comebacks",
      height: tall(turned.length, 57),
      node: <FactComebacks data={data} comebacks={turned} />,
    },
    !!changes && {
      key: "trends",
      height: tall(sum(ways), 53) + ways.length * 40 + 36,
      node: <FactTrends data={data} trends={changes} />,
    },
    once.length > 0 && {
      key: "once",
      height: tall(Math.ceil(once.length / (room === "wide" ? 3 : 2)), 56),
      node: <FactOnce data={data} once={once} />,
    },
  ]
  return facts.filter((fact) => fact !== false)
}

/** The places of the facts: on a phone one column, else two stacks that end about level. */
function stacksOf(facts: Fact[], room: FactRoom): Fact[][] {
  if (room === "column") return [facts]
  return splitStacks(facts.map(({ height }) => height)).map((stack) => stack.map((at) => facts[at]!))
}

/**
 * What the games counted are remembered by: the heroes of the five lanes, then the facts, in two stacks on their own so
 * that a tall one leaves no hole beside a short one.
 */
export function StatsHighlights({ data }: { data: StatsData }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const room = width ? factRoom(width) : null
  const facts = useMemo(() => (room ? factsOf(data, room) : []), [data, room])
  return (
    <div ref={ref} className="tn-highlights">
      <LaneStage data={data} />
      <FewGames games={data.feed.games.length} />
      {room && facts.length > 0 && (
        <div className="tn-highlights-stacks">
          {stacksOf(facts, room).map(
            (stack, at) =>
              stack.length > 0 && (
                <div key={at}>
                  {stack.map(({ key, node }) => (
                    <div key={key}>{node}</div>
                  ))}
                </div>
              ),
          )}
        </div>
      )}
    </div>
  )
}
