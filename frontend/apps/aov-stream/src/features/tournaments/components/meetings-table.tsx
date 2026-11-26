import type { CSSProperties } from "react"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import type { TableRoom } from "../../../lib/meetings-cells"
import { meetingsBetween } from "../../../lib/meetings-model"
import { pairWords } from "../../../lib/meetings-words"
import { namesOf } from "../../../lib/question-words"
import { MeetingsCell, type MeetingsMode } from "./meetings-cell"
import { MeetingsCrest } from "./meetings-crest"
import { useCellFocus } from "./meetings-focus"
import { useMeetingsPanel } from "./meetings-panel"
import type { MeetingsView } from "./stage-meetings"
import "./meetings-table.css"

/**
 * Every pair of a group as a table: a row is a team, a column whom it met. A cell opens the matches of its two teams;
 * the row and the column of the followed team are tinted, and so are those pointed at.
 */
export function MeetingsTable({
  view,
  teams,
  meetings,
  feed,
  followed,
  mode,
  room,
}: MeetingsView & { mode: MeetingsMode; room: TableRoom }) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const names = namesOf(view, text)
  const lists = teams.map((team) =>
    teams.map((other) => (team === other ? [] : meetingsBetween(meetings, team, other))),
  )
  const focus = useCellFocus(
    lists.map((row) => row.map((list) => list.length > 0)),
    Math.max(0, teams.indexOf(followed ?? "")),
  )
  const { isOpen, toggle, panel } = useMeetingsPanel(view, meetings, feed)
  const fullName = (id: string) => view.content.teams[id]?.name ?? names.team(id)
  return (
    <div className="tn-meet-wrap">
      <table
        className="tn-meet-table"
        data-kind={room.kind}
        data-names={room.names}
        style={
          {
            "--meet-first": `${room.first}px`,
            "--meet-column": `${room.column}px`,
            maxWidth: room.first + room.column * teams.length,
          } as CSSProperties
        }
        {...focus.table}
      >
        <caption className="sr-only">
          {text(
            "Kết quả giữa các đội, nhìn từ đội ở đầu hàng. Mở một ô để xem các trận; phím mũi tên đi giữa các ô.",
            "Results between the teams, seen from the team a row starts with. Open a cell for its matches; arrow keys move between cells.",
          )}
        </caption>
        <thead>
          <tr>
            <td />
            {teams.map((team) => (
              <th key={team} scope="col" title={fullName(team)} data-followed={team === followed || undefined}>
                {room.crests && <MeetingsCrest view={view} teamId={team} />}
                <span className={room.crests ? "sr-only" : undefined}>{names.team(team)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, row) => (
            <tr key={team} data-followed={team === followed || undefined}>
              <th scope="row" title={fullName(team)}>
                <span className="tn-meet-name">
                  <MeetingsCrest view={view} teamId={team} />
                  <span>{names.team(team)}</span>
                </span>
              </th>
              {teams.map((opponent, column) => {
                const list = lists[row]![column]!
                const pair = { team, opponent }
                return (
                  <td
                    key={opponent}
                    data-own={team === opponent || undefined}
                    data-followed={opponent === followed || undefined}
                  >
                    {list.length > 0 && (
                      <button
                        type="button"
                        className="tn-meet-open"
                        aria-haspopup="dialog"
                        aria-expanded={isOpen(pair)}
                        aria-label={pairWords(team, list, { names, text, timeZone, languageTag })}
                        onClick={(event) => toggle(pair, event.currentTarget)}
                        {...focus.cell(row, column)}
                      >
                        <MeetingsCell list={list} mode={mode} look={room} />
                      </button>
                    )}
                    {!list.length && team !== opponent && (
                      <span className="sr-only">{text("Chưa gặp nhau", "Have not met")}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {panel}
    </div>
  )
}
