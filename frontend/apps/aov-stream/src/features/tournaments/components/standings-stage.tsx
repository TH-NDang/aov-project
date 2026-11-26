import { memo, useMemo, useState } from "react"
import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import type { GameFeed } from "../../../lib/game-feed"
import { stageName } from "../../../lib/match-labels"
import { competitionMatches, type CompetitionMatch } from "../../../lib/match-model"
import { dayMonth } from "../../../lib/match-time"
import { placeZones, type PlaceZones } from "../../../lib/place-zones"
import { LEAST_RACE } from "../../../lib/race-model"
import { groupWords } from "../../../lib/standing-words"
import { hasDraws, standingGroups, tableOver, type StandingGroup } from "../../../lib/standings-model"
import { movement, type SteppedTable } from "../../../lib/standings-steps"
import { stageAnchor } from "./standings-anchors"
import { useShownStep, type ShownStep } from "./standings-address"
import { StandingsMatches } from "./standings-matches"
import { StandingsRace } from "./standings-race"
import { StandingsReason } from "./standings-reason"
import type { TableReading } from "./standings-row"
import { StepButtons, StepRange } from "./standings-steps-control"
import { StandingsRows, tableName } from "./standings-table"
import { StageMeetings } from "./stage-meetings"
import "./standings-stage.css"

type Table = CompetitionView["content"]["standings"][number]

// Every result between the teams is drawn once: it does not change with the step a table is read at.
const Meetings = memo(StageMeetings)

type Following = { followed: string | null; onFollow: TableReading["onFollow"] }

type GroupProps = Following & {
  view: CompetitionView
  stage: CompetitionStage
  stepped: SteppedTable | null
  group: StandingGroup
  /** Which of the stage's groups this is. */
  index: number
  race: boolean
  /** Whether the control of the steps stands with the race; one shared by several groups stands over them. */
  controls: boolean
  step: ShownStep
  /** The matches of the stage, and those its table counts at the step shown. */
  entries: CompetitionMatch[]
  counted: CompetitionMatch[]
  zones: PlaceZones
  /** Whether the stage is over. */
  over: boolean
  feed: GameFeed | null
  lit: string | null
  onPoint: (team: string | null) => void
}

/** One group of a stage: its race and its table, why its borders fell where they fell, its matches and its meetings. */
function Group({
  view,
  stage,
  stepped,
  group,
  index,
  race,
  controls,
  step,
  entries,
  counted,
  zones,
  over,
  feed,
  lit,
  followed,
  onFollow,
  onPoint,
}: GroupProps) {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const teams = useMemo(() => group.rows.map(({ teamId }) => teamId), [group])
  const own = useMemo(() => {
    const members = new Set(teams)
    return entries.filter(({ match, result }) =>
      [result?.teamAId || match.a.teamId, result?.teamBId || match.b.teamId].some((team) => team && members.has(team)),
    )
  }, [entries, teams])
  const tables = stepped?.groups[index]
  const rows = tables?.tables[step.shown] ?? group.rows
  const latest = !stepped || step.shown === stepped.steps.length - 1
  const final = over && latest
  const reading: TableReading = {
    moved: tables ? new Map(rows.map(({ teamId }) => [teamId, movement(tables, step.shown, teamId)])) : null,
    lit,
    followed,
    onFollow,
    onPoint,
  }
  const control = stepped && controls ? { steps: stepped.steps, step, live: !over } : null
  return (
    <div className="tn-stand-group">
      {group.name && <h3>{groupWords(group.name, text)}</h3>}
      <div className="tn-stand-table" data-race={race || undefined}>
        {race && tables && (
          <StandingsRace
            view={view}
            steps={stepped!.steps}
            group={tables}
            entries={own}
            zones={zones.zones}
            shown={step.shown}
            gold={over}
            lit={lit}
          />
        )}
        {control && compact && (
          <div className="tn-stand-steps">
            <StepButtons {...control} />
          </div>
        )}
        {control && <StepRange {...control} className="tn-stand-range" axis />}
        <div className="tn-stand-rows">
          <StandingsRows
            view={view}
            name={tableName(stage, group.name, text)}
            rows={rows}
            entries={counted}
            // Where a team itself went is known once its table is as it stands now.
            zones={latest ? zones : { ...zones, ways: new Map() }}
            final={final}
            reading={reading}
            draws={hasDraws(tables?.tables.at(-1) ?? rows)}
          />
        </div>
      </div>
      <StandingsReason view={view} stage={stage} rows={rows} zones={zones.zones} entries={counted} final={final} />
      {stepped && step.named && <StandingsMatches stage={stage} step={stepped.steps[step.shown]!} entries={own} />}
      <div className="tn-stand-meetings">
        <Meetings view={view} stage={stage} teams={teams} feed={feed} followed={followed} />
      </div>
    </div>
  )
}

/** The state of a table in a word: how it stands now, or up to which day it was read. */
function useTableState(table: Table, over: boolean, day: string | null | undefined) {
  const { text, languageTag } = useStreamLocale()
  if (day) return text(`Đến hết ${dayMonth(day, languageTag)}`, `Up to ${dayMonth(day, languageTag)}`)
  if (over) return text("Đã hoàn tất", "Final")
  return table.rows.some((row) => row.played > 0)
    ? text("Tạm tính", "Provisional")
    : text("Chưa thi đấu", "Not started")
}

/**
 * A stage whose teams stand in a table. Where the table can be worked out again after every step of the stage, one
 * control steps through it: the rows, the race that runs into them and the reason under them are those of that step.
 */
export function StandingsStage({
  view,
  stage,
  table,
  stepped,
  first,
  feed,
  followed,
  hinted,
  onFollow,
}: Following & {
  view: CompetitionView
  stage: CompetitionStage
  table: Table
  stepped: SteppedTable | null
  /** Whether the address names the steps of this stage without its code. */
  first: boolean
  feed: GameFeed | null
  /** The team whose crest is pointed at. */
  hinted: string | null
}) {
  const compact = usePageLayout() === "compact"
  const groups = useMemo(() => standingGroups(view, table), [view, table])
  const entries = useMemo(
    () => competitionMatches([view]).filter((entry) => entry.match.stageCode === stage.code),
    [view, stage.code],
  )
  const steps = stepped?.steps ?? []
  const step = useShownStep(steps, stage.code, first)
  const raced = groups.map(({ rows }) => steps.length >= LEAST_RACE && rows.length >= LEAST_RACE)
  const [pointed, setPointed] = useState<string | null>(null)
  const over = tableOver(view, table)
  const alone = groups.length === 1
  const zones = useMemo(
    () => groups.map(({ rows }) => placeZones(view, stage, rows, over, alone)),
    [view, stage, groups, over, alone],
  )
  const played = new Set(steps.slice(0, step.shown + 1).flatMap(({ matches }) => matches))
  const counted = stepped ? entries.filter(({ match }) => played.has(match.key)) : entries
  const state = useTableState(table, over, step.shown < steps.length - 1 ? steps[step.shown]?.days.at(-1) : null)
  // One race has its control to itself: the range over its lines, and on a phone the buttons under them.
  const within = alone && raced[0]!
  const control = stepped ? { steps, step, live: !over } : null
  return (
    <section className="tn-block tn-stand" id={stageAnchor(stage.code)} tabIndex={-1}>
      <div className="tn-stand-head">
        <div className="tn-heading" data-flush="">
          <h2>
            {stageName(stage.name)} <small>{state}</small>
          </h2>
        </div>
        {control && !(compact && within) && (
          <div className="tn-stand-control">
            <StepButtons {...control}>{!within && steps.length > 2 && <StepRange {...control} />}</StepButtons>
          </div>
        )}
      </div>
      <div className="tn-stand-groups" data-columns={(!alone && !raced.some(Boolean)) || undefined}>
        {groups.map((group, index) => (
          <Group
            key={group.name ?? "all"}
            view={view}
            stage={stage}
            stepped={stepped}
            group={group}
            index={index}
            race={raced[index]!}
            controls={within}
            step={step}
            entries={entries}
            counted={counted}
            zones={zones[index]!}
            over={over}
            feed={feed}
            lit={pointed ?? hinted ?? followed}
            followed={followed}
            onFollow={onFollow}
            onPoint={setPointed}
          />
        ))}
      </div>
    </section>
  )
}
