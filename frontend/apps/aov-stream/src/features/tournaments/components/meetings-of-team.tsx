import { useState } from "react"
import type { CompetitionView } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { meetingsBetween, meetingScore, sumOutcome } from "../../../lib/meetings-model"
import { figures, pairWords } from "../../../lib/meetings-words"
import { namesOf } from "../../../lib/question-words"
import { ChoiceMenu } from "./choice-menu"
import { MeetingsCell } from "./meetings-cell"
import { MeetingsCrest } from "./meetings-crest"
import { useMeetingsPanel } from "./meetings-panel"
import { MeetingsSection } from "./meetings-section"
import type { MeetingsView } from "./stage-meetings"
import "./meetings-of-team.css"

/** The team whose results are read, which opens the choice of another one. */
function TeamChoice({
  view,
  teams,
  team,
  onChoose,
}: {
  view: CompetitionView
  teams: string[]
  team: string
  onChoose: (team: string) => void
}) {
  const { text } = useStreamLocale()
  const names = namesOf(view, text)
  return (
    <ChoiceMenu
      title={text("Xem kết quả của đội nào", "Whose results to read")}
      align="start"
      value={team}
      choices={teams.map((id) => ({
        key: id,
        name: view.content.teams[id]?.name ?? names.team(id),
        mark: <MeetingsCrest view={view} teamId={id} />,
      }))}
      onChoose={onChoose}
    >
      <button
        type="button"
        className="tn-meet-choice"
        aria-label={text(`${names.team(team)}, chọn đội khác`, `${names.team(team)}, choose another team`)}
      >
        {names.team(team)}
        <StreamIcon name="chevronRight" size={14} />
      </button>
    </ChoiceMenu>
  )
}

/** The team followed through the tab, or the first of the table, until a reader chooses another one here. */
function useChosenTeam(teams: string[], followed: string | null) {
  const [seen, setSeen] = useState(followed)
  const [chosen, setChosen] = useState<string | null>(null)
  if (seen !== followed) {
    setSeen(followed)
    setChosen(null)
  }
  return [[chosen, followed].find((team) => team && teams.includes(team)) ?? teams[0]!, setChosen] as const
}

/** One team against each of the others, for groups too large for a table of every pair. */
export function MeetingsOfTeam({ view, teams, meetings, feed, followed, part }: MeetingsView) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const compact = usePageLayout() === "compact"
  const [team, setTeam] = useChosenTeam(teams, followed)
  const { isOpen, toggle, panel } = useMeetingsPanel(view, meetings, feed)
  const names = namesOf(view, text)
  const rows = teams.flatMap((opponent) => {
    const list = opponent === team ? [] : meetingsBetween(meetings, team, opponent)
    return list.length ? [{ opponent, list, score: meetingScore(list) }] : []
  })
  const several = rows.some(({ score }) => score.played > 1)
  return (
    <MeetingsSection
      title={text("Đối đầu", "Head to head")}
      note={
        <>
          {text("Kết quả của", "Results of")} <TeamChoice view={view} teams={teams} team={team} onChoose={setTeam} />{" "}
          {text("với từng đội", "against each team")}
        </>
      }
      part={part}
    >
      <ul className="tn-meet-list">
        {rows.map(({ opponent, list, score }) => {
          const pair = { team, opponent }
          return (
            <li key={opponent}>
              <button
                type="button"
                className="tn-meet-row"
                aria-haspopup="dialog"
                aria-expanded={isOpen(pair)}
                aria-label={pairWords(team, list, { names, text, timeZone, languageTag })}
                onClick={(event) => toggle(pair, event.currentTarget)}
              >
                <MeetingsCrest view={view} teamId={opponent} />
                <strong>{(!compact && view.content.teams[opponent]?.name) || names.team(opponent)}</strong>
                <MeetingsCell list={list} mode="matches" look={{ kind: compact ? "scores" : "marks", narrow: false }} />
                {several && <b data-outcome={sumOutcome(score)}>{score.played > 1 && figures(score)}</b>}
              </button>
            </li>
          )
        })}
      </ul>
      {panel}
    </MeetingsSection>
  )
}
