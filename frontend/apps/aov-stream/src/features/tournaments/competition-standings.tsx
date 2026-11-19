import { Fragment, type CSSProperties } from "react"
import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { EntityPageLink } from "../../components/public-competitions"
import { MatchCard } from "../../components/match-card"
import { bracketLanes, codeName, STAGE_FORMAT_NAMES } from "../../lib/competition-model"
import type { CompetitionMatch } from "../../lib/match-model"
import { Block } from "./competition-block"
import { standingsAndBrackets } from "./competition-page-model"

/** Every table and every bracket of the competition, in the order their stages are played. */
export function CompetitionStandings({ view, matches }: { view: CompetitionView; matches: CompetitionMatch[] }) {
  const { text } = useStreamLocale()
  const { plan } = view.content
  const { standings, knockouts } = standingsAndBrackets(view)
  if (!standings.length && !knockouts.length)
    return (
      <div className="hub-state">
        <h2>{text("Giải chưa có bảng xếp hạng hoặc nhánh đấu", "The tournament has no standings or bracket yet")}</h2>
      </div>
    )
  return (
    <div className="tn-stack">
      {standings.map((table) => (
        <Block
          key={table.stageCode}
          title={
            plan.stages.find((stage) => stage.code === table.stageCode)?.name ?? text("Bảng xếp hạng", "Standings")
          }
          note={table.complete ? text("Đã hoàn tất", "Final") : text("Tạm tính", "Provisional")}
        >
          <StandingsTable view={view} table={table} />
        </Block>
      ))}
      {knockouts.map((stage) => (
        <Block key={stage.code} title={stage.name} note={codeName(STAGE_FORMAT_NAMES, stage.format, text)}>
          <Bracket stage={stage} matches={matches} />
        </Block>
      ))}
    </div>
  )
}

/** The table of one round-robin stage; `limit` keeps its first rows. */
export function StandingsTable({
  view,
  table,
  limit,
}: {
  view: CompetitionView
  table: CompetitionView["content"]["standings"][number]
  limit?: number
}) {
  const { text } = useStreamLocale()
  const { teams } = view.content
  const rows = limit ? table.rows.slice(0, limit) : table.rows
  const anyQualified = table.rows.some((row) => row.qualified)
  return (
    <div className="tn-table-wrap">
      <table className="tn-table">
        <thead>
          <tr>
            <th scope="col" className="tn-rank">
              #
            </th>
            <th scope="col">{text("Đội", "Team")}</th>
            <th scope="col" className="tn-wide-only">
              {text("Trận", "Matches")}
            </th>
            <th scope="col">
              <abbr title={text("Trận thắng – trận thua", "Matches won – lost")}>{text("T–B", "W–L")}</abbr>
            </th>
            <th scope="col" className="tn-wide-only">
              <abbr title={text("Ván thắng – ván thua", "Games won – lost")}>{text("Ván", "Games")}</abbr>
            </th>
            <th scope="col">
              <abbr title={text("Hiệu số ván", "Game difference")}>HS</abbr>
            </th>
            <th scope="col">{text("Điểm", "Points")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const team = teams[row.teamId]
            const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
            const difference = row.gameWins - row.gameLosses
            return (
              <tr key={row.teamId} data-qualified={row.qualified || undefined}>
                <td className="tn-rank">
                  {row.rank}
                  {row.tied && <span title={text("Đồng hạng", "Tied")}>=</span>}
                  {row.qualified && (
                    <span className="sr-only">{text(", đã giành suất đi tiếp", ", secured a spot to advance")}</span>
                  )}
                </td>
                <th scope="row">
                  <span className="tn-team">
                    <StreamImage src={team?.logoUrl} name={team?.shortName || name} />
                    <EntityPageLink kind="TEAM" id={row.teamId} name={name} />
                  </span>
                </th>
                <td className="tn-wide-only">{row.played}</td>
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
          })}
        </tbody>
      </table>
      {anyQualified && (
        <p className="tn-table-note">
          <i aria-hidden="true" />
          {text("Đã giành suất đi tiếp", "Secured a spot to advance")}
        </p>
      )}
    </div>
  )
}

/** The lanes of a double elimination, in Vietnamese and in English. */
const LANE_TITLES = {
  upper: ["Nhánh thắng", "Upper bracket"],
  lower: ["Nhánh thua", "Lower bracket"],
  final: ["Chung kết tổng", "Grand final"],
} as const

/**
 * An elimination stage read from left to right. Rounds share their columns across the lanes, so a match of the lower
 * lane stands under the upper-lane round played at the same point, and the final closes the row on its own.
 */
export function Bracket({ stage, matches }: { stage: CompetitionStage; matches: CompetitionMatch[] }) {
  const { text } = useStreamLocale()
  const entries = matches.filter((entry) => entry.match.stageCode === stage.code)
  const byKey = new Map(entries.map((entry) => [entry.match.key, entry]))
  const lanes = bracketLanes(entries.map((entry) => entry.match))
  const rounds = [...new Set(entries.map((entry) => entry.match.round))].sort((a, b) => a - b)
  const laned = lanes.some((lane) => lane.key !== "rounds")
  return (
    <div
      className="tn-bracket"
      tabIndex={0}
      role="group"
      aria-label={text(`Nhánh đấu ${stage.name}`, `${stage.name} bracket`)}
    >
      <div
        className="tn-bracket-grid"
        data-laned={laned || undefined}
        style={{ "--bracket-rounds": rounds.length } as CSSProperties}
      >
        {lanes.map((lane) =>
          lane.rounds.map(({ round, matches: list }, index) => {
            const column = rounds.indexOf(round)
            return (
              <Fragment key={`${lane.key}:${round}`}>
                {!laned && (
                  <h3 className="tn-bracket-title" style={{ gridColumn: column + 1 }}>
                    {rounds.length > 1 && column === rounds.length - 1 && list.length === 1
                      ? text("Chung kết", "Final")
                      : text(`Vòng ${column + 1}`, `Round ${column + 1}`)}
                  </h3>
                )}
                <div className="tn-bracket-round" data-lane={lane.key} style={{ gridColumn: column + 1 }}>
                  {laned && index === 0 && (
                    <h3 className="tn-bracket-title">{text(...LANE_TITLES[lane.key as "upper"])}</h3>
                  )}
                  {list.map((match) => (
                    <MatchCard key={match.key} entry={byKey.get(match.key)!} brief final={lane.key === "final"} />
                  ))}
                </div>
              </Fragment>
            )
          }),
        )}
      </div>
    </div>
  )
}
