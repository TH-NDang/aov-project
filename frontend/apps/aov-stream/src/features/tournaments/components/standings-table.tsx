import { useRef, type ReactNode } from "react"
import type { CompetitionStage, CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { stageName } from "../../../lib/match-labels"
import { competitionMatches, type CompetitionMatch } from "../../../lib/match-model"
import { isOut, placeZones, type PlaceZones } from "../../../lib/place-zones"
import { groupWords, wayWords, zoneWords } from "../../../lib/standing-words"
import { hasDraws, ordersByGames, standingGroups, tableOver } from "../../../lib/standings-model"
import { useSlidingRows } from "../../../lib/use-sliding-rows"
import { StandingsRow, type TableReading } from "./standings-row"
import { ZoneHeading, zoneMark } from "./standings-zone"
import "./standings-table.css"

type Table = CompetitionView["content"]["standings"][number]
type Say = (vi: string, en: string) => string

/** The name of a table: its stage, and its group where the stage has several. */
export const tableName = (stage: Pick<CompetitionStage, "name">, group: string | null | undefined, text: Say) =>
  group ? `${stageName(stage.name)}, ${groupWords(group, text)}` : stageName(stage.name)

/** The head of a table; narrow ones keep the record, the game difference and the points. */
function TableHead({ draws, moves }: { draws: boolean; moves: boolean }) {
  const { text } = useStreamLocale()
  return (
    <thead>
      <tr>
        <th scope="col" className="tn-table-rank">
          <abbr title={text("Thứ hạng", "Rank")}>#</abbr>
        </th>
        {moves && (
          <th scope="col" className="tn-table-moved">
            <span className="sr-only">{text("So với bước trước", "Since the step before")}</span>
          </th>
        )}
        <th scope="col" className="tn-table-team">
          {text("Đội", "Team")}
        </th>
        <th scope="col" className="tn-table-form">
          {text("Phong độ", "Form")}
        </th>
        <th scope="col" className="tn-table-record">
          {draws ? (
            <abbr title={text("Trận thắng – hòa – thua", "Matches won – drawn – lost")}>{text("T–H–B", "W–D–L")}</abbr>
          ) : (
            <abbr title={text("Trận thắng – trận thua", "Matches won – lost")}>{text("T–B", "W–L")}</abbr>
          )}
        </th>
        <th scope="col" className="tn-table-games">
          <abbr title={text("Ván thắng – ván thua", "Games won – lost")}>{text("Ván", "Games")}</abbr>
        </th>
        <th scope="col" className="tn-table-diff">
          <abbr title={text("Hiệu số ván", "Game difference")}>{text("HS", "+/−")}</abbr>
        </th>
        <th scope="col" className="tn-table-points">
          <abbr title={text("Điểm", "Points")}>{text("Điểm", "Pts")}</abbr>
        </th>
      </tr>
    </thead>
  )
}

/**
 * One group of a stage as a table, under a heading for every zone of places that lead the same way. Where the ways of
 * neighbours are mixed each team's own way stands under its name.
 */
export function StandingsRows({
  view,
  name,
  rows,
  entries,
  zones,
  final,
  reading,
  draws = hasDraws(rows),
  caption,
}: {
  view: CompetitionView
  /** What the table is called for those who hear it, as a page may hold the tables of several stages and groups. */
  name: string
  rows: CompetitionStanding[]
  /** The matches the rows count, for the form of each team. */
  entries: CompetitionMatch[]
  zones: PlaceZones
  /** Whether the table can no longer change, so places are won and ways are taken. */
  final: boolean
  /** On the standings tab; elsewhere the table is a card with a wash of the medals. */
  reading?: TableReading
  /** Whether matches of the stage were drawn, also when none was at the step shown. */
  draws?: boolean
  caption?: ReactNode
}) {
  const { text, languageTag } = useStreamLocale()
  const table = useRef<HTMLTableElement>(null)
  useSlidingRows(table, rows.map((row) => row.teamId).join())
  // Before the first match nobody has a place, and no place leads anywhere.
  const ranked = rows.some((row) => row.played > 0)
  const words = zoneWords(zones.zones, final, text, languageTag)
  const parts =
    ranked && zones.zones.length
      ? zones.zones.map((zone, index) => ({ zone, index, own: rows.slice(zone.from - 1, zone.to) }))
      : [{ zone: null, index: 0, own: rows }]
  const moves = !!reading?.moved
  return (
    <table ref={table} className="tn-table" data-look={reading ? "race" : "card"} aria-label={name}>
      {caption && <caption>{caption}</caption>}
      <TableHead draws={draws} moves={moves} />
      {parts
        .filter(({ own }) => own.length > 0)
        .map(({ zone, index, own }) => (
          <tbody key={index} onPointerLeave={reading && (() => reading.onPoint(null))}>
            {zone && (
              <ZoneHeading
                zone={zone}
                mark={zoneMark(zones.zones, index)}
                words={words[index]!}
                columns={moves ? 8 : 7}
                linked={!!reading}
              />
            )}
            {own.map((row) => {
              const way = zones.ways.get(row.teamId)
              return (
                <StandingsRow
                  key={row.teamId}
                  view={view}
                  row={row}
                  entries={entries}
                  medal={final || !reading}
                  draws={draws}
                  out={isOut(zone, row, final)}
                  note={way ? wayWords(way, true, text, languageTag) : null}
                  qualified={row.qualified && !zone}
                  reading={reading}
                />
              )
            })}
          </tbody>
        ))}
    </table>
  )
}

/** What the order of a table rests on, where the plan records no rule for level teams. */
export function OrderNote() {
  const { text } = useStreamLocale()
  return (
    <p className="tn-tables-note">
      {text(
        "Đội bằng điểm xếp theo hiệu số ván, rồi số ván thắng.",
        "Teams level on points are ranked by game difference, then by games won.",
      )}
    </p>
  )
}

/**
 * A stage's table as a card, split into its groups where its teams only meet within them: the first places on a wash of
 * their medal, the leader in a taller line.
 */
export function StandingsTable({ view, table, limit }: { view: CompetitionView; table: Table; limit?: number }) {
  const { text } = useStreamLocale()
  const groups = standingGroups(view, table)
  const stage = view.content.plan.stages.find((item) => item.code === table.stageCode)
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === table.stageCode)
  const over = tableOver(view, table)
  const alone = groups.length === 1
  if (!stage) return null
  return (
    <div className="tn-tables" data-groups={!alone || undefined}>
      {groups.map(({ name, rows }) => (
        <div key={name ?? "all"} className="tn-table-wrap">
          <StandingsRows
            view={view}
            name={tableName(stage, name, text)}
            rows={limit && alone ? rows.slice(0, limit) : rows}
            entries={entries}
            zones={placeZones(view, stage, rows, over, alone)}
            final={over}
            caption={name && groupWords(name, text)}
          />
        </div>
      ))}
      {ordersByGames(view, table) && <OrderNote />}
    </div>
  )
}
