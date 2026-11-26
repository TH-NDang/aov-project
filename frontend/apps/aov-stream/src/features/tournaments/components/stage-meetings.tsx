import { useMemo } from "react"
import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import type { GameFeed } from "../../../lib/game-feed"
import { meetEveryone, openMatches, stageMeetings, type Meetings } from "../../../lib/meetings-model"
import { MeetingsMatrix } from "./meetings-matrix"
import { MeetingsOfTeam } from "./meetings-of-team"
import { MeetingsPath } from "./meetings-path"

export type StageMeetingsProps = {
  view: CompetitionView
  stage: CompetitionStage
  /** The teams of the group in the order of its table. */
  teams: string[]
  /** The published games, which the marks are drawn from; null while they load or where there are none. */
  feed: GameFeed | null
  /** The team followed through the tab. */
  followed: string | null
}

/** What each way of showing the results of a group is drawn from. */
export type MeetingsView = Omit<StageMeetingsProps, "stage"> & {
  meetings: Meetings
  /** The group shares its stage with others, whose names stand over them. */
  part: boolean
}

/** The most teams a table of every pair has room for. */
const MOST_TEAMS = { compact: 10, wide: 14 }

/**
 * Every result between the teams of one group of a stage: a table of every pair where most of them meet, one team
 * against each where they are too many for a table, and the way of each team where they only meet some of the others.
 */
export function StageMeetings({ view, stage, teams, feed, followed }: StageMeetingsProps) {
  const layout = usePageLayout()
  const meetings = useMemo(() => stageMeetings(view, stage.code, feed), [view, stage.code, feed])
  if (!teams.some((team) => meetings.has(team))) return null
  const part = [...meetings.keys()].some((team) => !teams.includes(team))
  const shown: MeetingsView = { view, teams, feed, followed, meetings, part }
  if (!meetEveryone(teams, meetings, openMatches(view, stage.code, teams, meetings))) return <MeetingsPath {...shown} />
  return teams.length > MOST_TEAMS[layout] ? <MeetingsOfTeam {...shown} /> : <MeetingsMatrix {...shown} />
}
