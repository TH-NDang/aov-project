import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionMatchHref } from "../../../lib/match-model"
import { pathRoom } from "../../../lib/meetings-cells"
import { meetingOutcome, meetingRounds, type Meeting, type MeetingRound } from "../../../lib/meetings-model"
import { figures, meetingDay, meetingWords, roundName } from "../../../lib/meetings-words"
import { namesOf } from "../../../lib/question-words"
import type { StepKind } from "../../../lib/standings-steps"
import { useWidth } from "../../../lib/use-width"
import { FormMarks } from "./form-marks"
import { MeetingDay } from "./meetings-cell"
import { MeetingsCrest } from "./meetings-crest"
import { useCellFocus } from "./meetings-focus"
import { MeetingsSection } from "./meetings-section"
import type { MeetingsView } from "./stage-meetings"
import "./meetings-path.css"

/** What the columns stand for, in Vietnamese and in English. */
const COLUMNS: Record<StepKind | "COUNT", readonly [string, string]> = {
  ROUND: ["Mỗi cột một vòng.", "A column a round."],
  WEEK: ["Mỗi cột một tuần.", "A column a week."],
  MATCHDAY: ["Mỗi cột một ngày.", "A column a match day."],
  DAY: ["Mỗi cột một ngày.", "A column a day."],
  COUNT: ["Mỗi cột một lượt.", "A column a match."],
}

/** One match of a team: how it ended, whom it met and the score. It opens the match. */
function Stop({
  view,
  meeting,
  round,
  crest,
  met,
  focus,
}: Pick<MeetingsView, "view"> & {
  meeting: Meeting
  round: MeetingRound
  crest: boolean
  /** The opponent is the team followed through the tab. */
  met: boolean
  focus: object
}) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const { entry, opponentId, won } = meeting
  const rival = namesOf(view, text).team(opponentId)
  const outcome = meetingOutcome(meeting)
  const said = meetingWords(meeting, meetingDay(meeting, timeZone, languageTag), text)
  return (
    <Link
      className="tn-meet-stop"
      to={competitionMatchHref(view.id, entry.match.key)}
      aria-label={text(
        `${roundName(round, text)}, gặp ${rival}: ${said}`,
        `${roundName(round, text)}, against ${rival}: ${said}`,
      )}
      data-outcome={outcome ?? undefined}
      data-met={met || undefined}
      {...focus}
    >
      <span className="tn-meet-result">{won != null && <FormMarks marks={[{ entry, won }]} />}</span>
      {crest && <MeetingsCrest view={view} teamId={opponentId} />}
      <span className="tn-meet-rival" title={view.content.teams[opponentId]?.name}>
        {rival}
      </span>
      <span className="tn-meet-end">{outcome ? figures(meeting) : <MeetingDay meeting={meeting} />}</span>
    </Link>
  )
}

/**
 * The way of each team through a stage where teams only meet some of the others, such as a Swiss stage: a row a team in
 * the order of the table, a column a round. A narrow page scrolls it sideways under the names of the teams.
 */
export function MeetingsPath({ view, teams, meetings, followed, part }: MeetingsView) {
  const { text } = useStreamLocale()
  const { ref, width } = useWidth<HTMLElement>()
  const rounds = meetingRounds(teams, meetings)
  const names = namesOf(view, text)
  const { look, first, rival, round: least } = pathRoom(width, teams.map(names.team), rounds.length)
  const focus = useCellFocus(
    teams.map((team) => rounds.map((round) => round.of.has(team))),
    Math.max(0, teams.indexOf(followed ?? "")),
  )
  return (
    <MeetingsSection
      ref={ref}
      title={text("Đường đi của từng đội", "The way of each team")}
      note={`${text(...COLUMNS[rounds[0]?.kind ?? "COUNT"])} ${text("Vạch cao là trận thắng.", "A tall mark is a match won.")}`}
      part={part}
    >
      <div className="tn-meet-path-wrap">
        <table
          className="tn-meet-path"
          data-look={look}
          style={
            {
              "--path-first": `${first}px`,
              "--path-rival": `${rival}px`,
              minWidth: first + rounds.length * least,
            } as CSSProperties
          }
          {...focus.table}
        >
          <caption className="sr-only">
            {text(
              "Các trận của từng đội theo vòng. Mở một ô để xem trận; phím mũi tên đi giữa các ô.",
              "The matches of each team by round. Open a cell for its match; arrow keys move between cells.",
            )}
          </caption>
          <thead>
            <tr>
              <td />
              {rounds.map((round) => (
                <th key={round.number} scope="col">
                  {roundName(round, text)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, row) => (
              <tr key={team} data-followed={team === followed || undefined}>
                <th scope="row" title={view.content.teams[team]?.name}>
                  <span className="tn-meet-who">
                    <MeetingsCrest view={view} teamId={team} />
                    <span>{names.team(team)}</span>
                  </span>
                </th>
                {rounds.map((round, column) => {
                  const meeting = round.of.get(team)
                  return (
                    <td key={round.number}>
                      {meeting && (
                        <Stop
                          view={view}
                          meeting={meeting}
                          round={round}
                          crest={look === "crest"}
                          met={meeting.opponentId === followed}
                          focus={focus.cell(row, column)}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MeetingsSection>
  )
}
