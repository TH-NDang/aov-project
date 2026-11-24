import { Fragment } from "react"
import type { CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { EntityPageLink } from "../../../components/go-link"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionMatches, type CompetitionMatch } from "../../../lib/match-model"
import { ordersByGames, standingGroups, teamForm, type StandingGroup } from "../../../lib/standings-model"
import { FormMarks } from "./form-marks"
import "./standings-table.css"

type Table = CompetitionView["content"]["standings"][number]

/** The head of the table; narrow screens keep the record, the game difference and the points. */
function TableHead() {
  const { text } = useStreamLocale()
  return (
    <thead>
      <tr>
        <th scope="col" className="tn-rank">
          <abbr title={text("Thứ hạng", "Rank")}>#</abbr>
        </th>
        <th scope="col">{text("Đội", "Team")}</th>
        <th scope="col" className="tn-wide-only">
          {text("Phong độ", "Form")}
        </th>
        <th scope="col">
          <abbr title={text("Trận thắng – trận thua", "Matches won – lost")}>{text("T–B", "W–L")}</abbr>
        </th>
        <th scope="col" className="tn-wide-only">
          <abbr title={text("Ván thắng – ván thua", "Games won – lost")}>{text("Ván", "Games")}</abbr>
        </th>
        <th scope="col">
          <abbr title={text("Hiệu số ván", "Game difference")}>{text("HS", "+/−")}</abbr>
        </th>
        <th scope="col">{text("Điểm", "Points")}</th>
      </tr>
    </thead>
  )
}

function Row({
  view,
  row,
  entries,
}: {
  view: CompetitionView
  row: CompetitionStanding
  /** The matches of the stage, for the form of the team. */
  entries: CompetitionMatch[]
}) {
  const { text } = useStreamLocale()
  const team = view.content.teams[row.teamId]
  const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
  const difference = row.gameWins - row.gameLosses
  // Before the first match every team shares the first line, which is no place worth a medal.
  const medal = row.played > 0 ? medalOf(row.rank) : null
  return (
    <tr data-qualified={row.qualified || undefined} data-medal={medal || undefined}>
      <td className="tn-rank">
        {medal ? <RankBadge place={row.rank} size={medal === "gold" ? 42 : 36} /> : row.rank}
        {row.qualified && (
          <span className="sr-only">{text(", đã giành suất đi tiếp", ", secured a spot to advance")}</span>
        )}
      </td>
      <th scope="row">
        <span className="tn-team">
          <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
          <span className="tn-team-name">
            <EntityPageLink kind="TEAM" id={row.teamId} name={name} />
            {row.tied && row.played > 0 && <small>{text("Đồng hạng", "Tied")}</small>}
          </span>
        </span>
      </th>
      <td className="tn-wide-only">
        <FormMarks marks={teamForm(entries, row.teamId)} />
      </td>
      <td>
        {row.won}–{row.lost}
      </td>
      <td className="tn-wide-only">
        {row.gameWins}–{row.gameLosses}
      </td>
      <td>{difference > 0 ? `+${difference}` : difference}</td>
      <td>
        <strong>{row.points}</strong>
      </td>
    </tr>
  )
}

/**
 * One group of a stage as a table. `advance` draws the line between the places that go on and the others, where the
 * stage sends a number of teams on.
 */
function GroupTable({
  view,
  group,
  stageCode,
  advance,
  limit,
}: {
  view: CompetitionView
  group: StandingGroup
  stageCode: string
  advance: number
  limit?: number
}) {
  const { text } = useStreamLocale()
  const rows = limit ? group.rows.slice(0, limit) : group.rows
  const entries = competitionMatches([view]).filter((entry) => entry.match.stageCode === stageCode)
  return (
    <div className="tn-table-wrap">
      <table className="tn-table">
        {group.name && (
          <caption>
            {/^[A-Z]$/.test(group.name)
              ? text(`Bảng ${group.name}`, `Group ${group.name}`)
              : text(`Nhóm ${group.name}`, `Group ${group.name}`)}
          </caption>
        )}
        <TableHead />
        <tbody>
          {rows.map((row, index) => (
            <Fragment key={row.teamId}>
              <Row view={view} row={row} entries={entries} />
              {advance > 0 && index === advance - 1 && index < rows.length - 1 && (
                <tr className="tn-table-line">
                  <td colSpan={7}>
                    <span>{text(`${advance} đội đi tiếp`, `Top ${advance} advance`)}</span>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A stage's table, split into its groups where its teams only meet within them. */
export function StandingsTable({ view, table, limit }: { view: CompetitionView; table: Table; limit?: number }) {
  const { text } = useStreamLocale()
  const groups = standingGroups(view, table)
  const stage = view.content.plan.stages.find((item) => item.code === table.stageCode)
  // The number of teams that go on is the stage's, so it draws no line inside one of several groups.
  const advance = groups.length === 1 ? (stage?.advance ?? 0) : 0
  return (
    <div className="tn-tables" data-groups={groups.length > 1 || undefined}>
      {groups.map((group) => (
        <GroupTable
          key={group.name ?? "all"}
          view={view}
          group={group}
          stageCode={table.stageCode}
          advance={advance}
          limit={groups.length === 1 ? limit : undefined}
        />
      ))}
      {ordersByGames(view, table) && (
        <p className="tn-tables-note">
          {text(
            "Đội bằng điểm xếp theo hiệu số ván, rồi số ván thắng.",
            "Teams level on points are ranked by game difference, then by games won.",
          )}
        </p>
      )}
    </div>
  )
}
