import { useStreamLocale } from "../../components/stream-locale"
import { MatchCard } from "../../components/match-card"
import { matchStrip } from "../../lib/competition-model"
import type { CompetitionMatch } from "../../lib/match-model"
import type { CompetitionView } from "@aov/community-contracts"
import { Block } from "./competition-block"
import { mainStages, type CompetitionTab } from "./competition-page-model"
import { Awards, Facts, Format } from "./competition-side-cards"
import { Bracket, StandingsTable } from "./competition-standings"

/**
 * What a reader wants first: the matches around now, where the table stands, how the knockout went, and the facts of
 * the competition beside them. The other tabs hold each of these in full.
 */
export function CompetitionOverview({
  view,
  matches,
  openTab,
}: {
  view: CompetitionView
  matches: CompetitionMatch[]
  openTab: (tab: CompetitionTab) => void
}) {
  const { text } = useStreamLocale()
  const { plan, standings } = view.content
  const { table, knockout } = mainStages(view)
  const strip = matchStrip(matches, Date.now(), 4, 4)
  const ahead = strip.filter((entry) => entry.result?.scoreA == null)
  const shown = (ahead.length ? ahead : strip).slice(0, 4)
  const empty = !shown.length && !table && !knockout
  return (
    <div className="tn-overview">
      <div className="tn-overview-main">
        {empty && (
          <div className="hub-state">
            <h2>{text("Lịch thi đấu chưa được công bố", "The schedule has not been announced")}</h2>
            <p>
              {text(
                "Trận đấu và bảng xếp hạng sẽ xuất hiện tại đây khi ban tổ chức công bố.",
                "Matches and standings will appear here once the organizer announces them.",
              )}
            </p>
            {plan.entrants.length > 0 && (
              <button type="button" className="cp-button" onClick={() => openTab("teams")}>
                {text(`Xem ${plan.entrants.length} đội tham dự`, `See the ${plan.entrants.length} teams taking part`)}
              </button>
            )}
          </div>
        )}
        {shown.length > 0 && (
          <Block
            title={ahead.length ? text("Sắp diễn ra", "Upcoming") : text("Trận gần nhất", "Latest matches")}
            more={{ label: text("Lịch & kết quả", "Schedule & results"), open: () => openTab("matches") }}
          >
            <div className="tn-match-grid">
              {shown.map((entry) => (
                <MatchCard key={entry.match.key} entry={entry} />
              ))}
            </div>
          </Block>
        )}
        {table && (
          <Block
            title={text("Bảng xếp hạng", "Standings")}
            note={plan.stages.find((stage) => stage.code === table.stageCode)?.name}
            more={
              table.rows.length > 10 || standings.length > 1
                ? { label: text("Xem đầy đủ", "See all"), open: () => openTab("standings") }
                : undefined
            }
          >
            <StandingsTable view={view} table={table} limit={10} />
          </Block>
        )}
        {knockout && (
          <Block title={text("Nhánh đấu", "Bracket")} note={knockout.name}>
            <Bracket stage={knockout} matches={matches} />
          </Block>
        )}
      </div>
      <aside className="tn-overview-side">
        <Facts view={view} />
        <Format view={view} />
        <Awards view={view} />
      </aside>
    </div>
  )
}
