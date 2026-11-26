import type { MouseEvent } from "react"
import type { CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { EntityPageLink } from "../../../components/go-link"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import { movementWords, placeFigure, signed } from "../../../lib/standing-words"
import { teamForm } from "../../../lib/standings-model"
import { FormMarks } from "./form-marks"
import "./standings-row.css"

/** Names up to the first length fit a phone, and up to the second one every wider screen. */
const PHONE_NAME = 16
const LONG_NAME = 24

/** What a table of the standings tab does beyond showing its figures. */
export type TableReading = {
  /** How many places each team moved since the step before; null where a table has no steps. */
  moved: Map<string, number> | null
  /** The team followed or pointed at, and the one that is followed. */
  lit: string | null
  followed: string | null
  onFollow: (team: string, row: Element) => void
  onPoint: (team: string | null) => void
}

/** A team's name, or its short name where the whole one has no room. */
function Name({ name, short }: { name: string; short: string }) {
  if (name.length <= PHONE_NAME) return name
  if (name.length > LONG_NAME) return short
  return (
    <>
      <span className="tn-team-long">{name}</span>
      <span className="tn-team-short">{short}</span>
    </>
  )
}

/** How far a team moved: an arrow with its number, and words for those who do not see it. */
function Move({ places }: { places: number }) {
  const { text } = useStreamLocale()
  if (!places) return null
  return (
    <span className="tn-move" data-way={places > 0 ? "up" : "down"}>
      <i aria-hidden="true" />
      <span aria-hidden="true">{Math.abs(places)}</span>
      <span className="sr-only">{movementWords(places, text)}</span>
    </span>
  )
}

/** A team in a table. On the standings tab pressing its row follows it, as its crest over the stages does. */
export function StandingsRow({
  view,
  row,
  entries,
  medal,
  draws,
  out,
  note,
  qualified,
  reading,
}: {
  view: CompetitionView
  row: CompetitionStanding
  /** The matches the table counts, for the form of the team. */
  entries: CompetitionMatch[]
  /** Whether a place among the first three wears its medal. */
  medal: boolean
  draws: boolean
  /** Whether its place leads out of the competition. */
  out: boolean
  /** Where the team went, for a table whose ways make no zones. */
  note: string | null
  /** Whether the row itself has to say that its team goes on. */
  qualified: boolean
  reading?: TableReading
}) {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const { teamId, rank, tied, played, won, lost, gameWins, gameLosses, points } = row
  const team = view.content.teams[teamId]
  const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
  const short = team?.shortName || name
  const metal = medal && played > 0 && !out ? medalOf(rank) : null
  // On a phone the medal of the race's table is narrower than its column, so the arrow after it keeps some air.
  const badge = compact ? (reading ? 28 : 31) : reading ? 34 : metal === "gold" ? 42 : 36
  const under = [tied && played > 0 && text("Đồng hạng", "Tied"), note].filter(Boolean).join(", ")
  const press = (event: MouseEvent) => {
    if (event.target instanceof Element && !event.target.closest("a, button"))
      reading?.onFollow(teamId, event.currentTarget)
  }
  return (
    <tr
      data-team={teamId}
      data-medal={(!reading && metal) || undefined}
      data-out={out || undefined}
      data-lit={reading?.lit === teamId || undefined}
      data-followed={reading?.followed === teamId || undefined}
      onClick={reading && press}
      onPointerEnter={reading && ((event) => event.pointerType === "mouse" && reading.onPoint(teamId))}
    >
      <td className="tn-table-rank">
        {metal ? <RankBadge place={rank} size={badge} /> : placeFigure(row)}
        {qualified && <span className="sr-only">{text(", đã giành suất đi tiếp", ", secured a spot to advance")}</span>}
      </td>
      {reading?.moved && (
        <td className="tn-table-moved">
          <Move places={reading.moved.get(teamId) ?? 0} />
        </td>
      )}
      <th scope="row" className="tn-table-team">
        <span className="tn-team">
          <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={short} />
          <span className="tn-team-name">
            <EntityPageLink kind="TEAM" id={teamId} name={name} plain={compact}>
              <Name name={name} short={short} />
            </EntityPageLink>
            {under && <small>{under}</small>}
          </span>
        </span>
      </th>
      <td className="tn-table-form">
        <span>
          <FormMarks marks={teamForm(entries, teamId)} />
        </span>
      </td>
      <td className="tn-table-record">{(draws ? [won, played - won - lost, lost] : [won, lost]).join("–")}</td>
      <td className="tn-table-games">
        {gameWins}–{gameLosses}
      </td>
      <td className="tn-table-diff">{signed(gameWins - gameLosses)}</td>
      <td className="tn-table-points">{points}</td>
    </tr>
  )
}
