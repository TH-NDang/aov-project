import { useQuery } from "@tanstack/react-query"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import { tableRoom, type TableRoom } from "../../../lib/meetings-cells"
import { isOverdue, mostGames, mostLegs, usualLegs } from "../../../lib/meetings-model"
import { namesOf } from "../../../lib/question-words"
import { statisticsQuery } from "../../../lib/tournament-api"
import { useEntryState } from "../../../lib/use-entry-state"
import { useNow } from "../../../lib/use-now"
import { useWidth } from "../../../lib/use-width"
import { ChoiceTrack } from "./choice-track"
import type { MeetingsMode } from "./meetings-cell"
import { MeetingsSection } from "./meetings-section"
import { MeetingsTable } from "./meetings-table"
import type { MeetingsView } from "./stage-meetings"

/** Each way to read the table, named in Vietnamese and in English. */
const MODES: [MeetingsMode, readonly [string, string]][] = [
  ["matches", ["Từng trận", "Match by match"]],
  ["sum", ["Cộng lại", "Added up"]],
]

/** How to read the table, in words that fit what its cells have room for. */
function useNote(mode: MeetingsMode, room: TableRoom, legs: number, ahead: boolean) {
  const { text } = useStreamLocale()
  const marks = room.kind === "marks"
  if (mode === "sum")
    return marks
      ? text(
          "Ván thắng và thua của mọi trận, nhìn từ đội ở đầu hàng.",
          "Games won and lost over all matches, seen from the team a row starts with.",
        )
      : text("Đọc theo hàng: ván thắng và thua cộng lại.", "Read along a row: games won and lost in all.")
  if (marks)
    return text(
      "Tỷ số từng trận, nhìn từ đội ở đầu hàng. Vạch cao là ván thắng.",
      "Score by match, seen from the team a row starts with. A tall mark is a game won.",
    )
  const read =
    legs > 1
      ? text(`Đọc theo hàng, mỗi ô ${legs} trận.`, `Read along a row, ${legs} matches a cell.`)
      : text("Đọc theo hàng.", "Read along a row.")
  const bold =
    ahead && room.kind === "stack" && room.narrow
      ? text("Đậm là trận thắng, vòng tròn là trận chưa đấu.", "Bold is a match won, a ring one to come.")
      : text("Đậm là trận thắng.", "Bold is a match won.")
  return `${read} ${bold}`
}

/** Every pair of a group, match by match or added up. */
export function MeetingsMatrix(shown: MeetingsView) {
  const { view, teams, feed, meetings, part } = shown
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const now = useNow()
  const [mode, setMode] = useEntryState<MeetingsMode>("meetings", "matches")
  const { ref, width } = useWidth<HTMLElement>()
  const { data: statistics } = useQuery(statisticsQuery(view.id))
  const list = teams.flatMap((team) => meetings.get(team) ?? [])
  const legs = usualLegs(teams, meetings)
  const room = tableRoom(width, teams.map(namesOf(view, text).team), {
    compact,
    // While the games load, the rows already have the height of the marks to come.
    marked: feed ? list.some(({ marks }) => marks.length > 0) : (statistics?.games ?? 0) > 0,
    sum: mode === "sum",
    legs,
    games: mostGames(teams, meetings),
  })
  const ahead = list.some((meeting) => meeting.own == null && !isOverdue(meeting, now))
  return (
    <MeetingsSection
      ref={ref}
      title={text("Đối đầu", "Head to head")}
      note={useNote(mode, room, legs, ahead)}
      part={part}
      width={room.first + room.column * teams.length}
      control={
        mostLegs(teams, meetings) > 1 && (
          <ChoiceTrack
            label={text("Cách đọc kết quả", "How to read it")}
            size="small"
            className="tn-meet-switch"
            value={mode}
            choices={MODES.map(([key, name]) => ({ key, name: text(...name) }))}
            onChoose={setMode}
          />
        )
      }
    >
      <MeetingsTable {...shown} mode={mode} room={room} />
    </MeetingsSection>
  )
}
