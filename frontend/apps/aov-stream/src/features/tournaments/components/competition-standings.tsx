import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { codeName, STAGE_FORMAT_NAMES } from "../../../lib/competition-model"
import { gameFeed } from "../../../lib/game-feed"
import { stageName } from "../../../lib/match-labels"
import { shownStages, teamOrder } from "../../../lib/standings-order"
import { lineupsQuery } from "../../../lib/tournament-api"
import { useHeldPlace } from "../../../lib/use-held-place"
import { useAskedStage } from "./asked-stage"
import { Bracket } from "./bracket"
import { FinalRanking } from "./final-ranking"
import { useStandingsAddress } from "./standings-address"
import { StandingsStage } from "./standings-stage"
import { Section } from "./section"
import { TeamFollow } from "./team-follow"

/** Every stage with its table or its bracket. One team can be followed through them all, and the address says which. */
export function CompetitionStandings({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { team, follow } = useStandingsAddress()
  const lineups = useQuery(lineupsQuery(view.id))
  const feed = useMemo(() => (lineups.data?.games.length ? gameFeed(view, lineups.data) : null), [view, lineups.data])
  const shown = useMemo(() => shownStages(view), [view])
  const teams = useMemo(() => teamOrder(view, shown), [view, shown])
  const [hinted, setHinted] = useState<string | null>(null)
  const followed = team && teams.includes(team) ? team : null
  // The way of the team appears under the bracket, over the row that was pressed.
  const hold = useHeldPlace(followed)
  const toggle = (id: string, row: Element) => {
    hold(row)
    follow(followed === id ? null : id)
  }
  useAskedStage()
  if (!shown.length)
    return (
      <div className="hub-state">
        <h2>{text("Giải chưa có bảng xếp hạng hoặc nhánh đấu", "The tournament has no standings or bracket yet")}</h2>
        <p>
          {text(
            "Bảng xếp hạng và nhánh đấu sẽ xuất hiện khi giải có lịch thi đấu.",
            "Standings and brackets appear once the tournament has a schedule.",
          )}
        </p>
      </div>
    )
  const first = shown.find(({ stepped }) => stepped)?.stage.code
  return (
    <div className="tn-stack">
      {teams.length > 1 && (
        <TeamFollow view={view} teams={teams} followed={followed} onFollow={follow} onPoint={setHinted} />
      )}
      {shown.map(({ stage, table, stepped }) =>
        table ? (
          <StandingsStage
            key={stage.code}
            view={view}
            stage={stage}
            table={table}
            stepped={stepped}
            first={stage.code === first}
            feed={feed}
            followed={followed}
            hinted={hinted}
            onFollow={toggle}
          />
        ) : (
          <Section
            key={stage.code}
            title={stageName(stage.name)}
            note={codeName(STAGE_FORMAT_NAMES, stage.format, text)}
          >
            <Bracket view={view} stage={stage} followed={followed} hinted={hinted} />
          </Section>
        ),
      )}
      <FinalRanking view={view} />
    </div>
  )
}
