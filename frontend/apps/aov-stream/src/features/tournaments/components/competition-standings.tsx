import type { CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { codeName, playedOrder, STAGE_FORMAT_NAMES } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"
import { allPlayed } from "../../../lib/standings-model"
import { Bracket } from "./bracket"
import { FinalRanking } from "./final-ranking"
import { Section } from "./section"
import { StandingsTable } from "./standings-table"

/** Every stage with its table or its bracket: the latest stage first, since it decides. */
export function CompetitionStandings({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { plan, standings } = view.content
  const stages = playedOrder(
    plan.stages.filter((stage) => plan.matches.some((match) => match.stageCode === stage.code)),
    plan.matches,
  ).reverse()
  const shown = stages.flatMap((stage) => {
    const table = standings.find((item) => item.stageCode === stage.code)
    return stage.format !== "ROUND_ROBIN" || table ? [{ stage, table }] : []
  })
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
  return (
    <div className="tn-stack">
      {shown.map(({ stage, table }) => (
        <Section
          key={stage.code}
          title={stageName(stage.name)}
          note={
            table
              ? table.complete || allPlayed(view, table)
                ? text("Đã hoàn tất", "Final")
                : text("Tạm tính", "Provisional")
              : codeName(STAGE_FORMAT_NAMES, stage.format, text)
          }
        >
          {table ? <StandingsTable view={view} table={table} /> : <Bracket view={view} stage={stage} />}
        </Section>
      ))}
      <FinalRanking view={view} />
    </div>
  )
}
