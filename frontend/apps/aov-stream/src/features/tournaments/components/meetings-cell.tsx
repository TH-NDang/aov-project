import { Fragment } from "react"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import type { TableRoom } from "../../../lib/meetings-cells"
import {
  isOverdue,
  meetingOutcome,
  meetingScore,
  sumMarks,
  sumOutcome,
  type Meeting,
} from "../../../lib/meetings-model"
import { figures, meetingDay } from "../../../lib/meetings-words"
import { useNow } from "../../../lib/use-now"
import { GameMarks } from "./game-marks"
import "./meetings-cell.css"

/** Every match on its own, or the games of all of them as one sum. */
export type MeetingsMode = "matches" | "sum"
/** What a cell has room for. */
export type CellLook = Pick<TableRoom, "kind" | "narrow">

/**
 * The day of a match to come, or a dash where nobody knows it or the result of a match that day. In a narrow column the
 * day takes two lines, and where scores stand one under the other a ring says that a match is to come.
 */
export function MeetingDay({ meeting, look }: { meeting: Meeting; look?: CellLook }) {
  const { languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const now = useNow()
  const day = isOverdue(meeting, now) ? null : meetingDay(meeting, timeZone, languageTag)
  if (!day) return "–"
  if (!look?.narrow) return day
  if (look.kind === "stack") return <i className="tn-meet-ahead" />
  return day.split(/(?<=\D)/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {part}
    </Fragment>
  ))
}

/**
 * The matches of two teams, seen from the first: the marks of each match in order over its score, or the sum of their
 * games over all marks. A match without a score shows its day. What the cell says in words stands on the button around
 * it.
 */
export function MeetingsCell({ list, mode, look }: { list: Meeting[]; mode: MeetingsMode; look: CellLook }) {
  const score = meetingScore(list)
  const marks = look.kind === "marks"
  if (mode === "sum" && score.played > 0)
    return (
      <span className="tn-meet-sum" data-outcome={sumOutcome(score)}>
        {figures(score)}
        {marks && <GameMarks marks={sumMarks(score)} unit={4} height={15} />}
      </span>
    )
  return (
    <span className="tn-meet-legs" data-kind={look.kind}>
      {(mode === "sum" ? list.slice(0, 1) : list).map((meeting) => (
        <span key={meeting.entry.match.key} className="tn-meet-leg" data-outcome={meetingOutcome(meeting) ?? undefined}>
          {marks && meeting.marks.length > 0 && <GameMarks marks={meeting.marks} unit={4} height={15} />}
          <span>{meeting.own == null ? <MeetingDay meeting={meeting} look={look} /> : figures(meeting)}</span>
        </span>
      ))}
    </span>
  )
}
