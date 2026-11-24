import type { CompetitionView } from "@aov/community-contracts"
import { MatchCard } from "../../../components/match-card"
import { MatchSpotlight } from "../../../components/match-spotlight"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionStatus, matchStrip, matchUnderway, playedOrder } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"
import type { CompetitionMatch } from "../../../lib/match-model"
import { matchSides } from "../../../lib/match-schedule"
import { useNow } from "../../../lib/use-now"
import { Bracket } from "./bracket"
import { CompetitionAbout } from "./competition-about"
import { CompetitionAwards } from "./competition-awards"
import { CompetitionFacts } from "./competition-facts"
import { FinalRanking } from "./final-ranking"
import { Section } from "./section"
import { StandingsTable } from "./standings-table"
import { TeamWall } from "./team-wall"
import "./competition-overview.css"

export type CompetitionTab = "overview" | "matches" | "standings" | "teams" | "info"

/** The main stage of each kind: the table with the most matches and the last elimination stage played. */
function mainStages(view: CompetitionView) {
  const { plan, standings } = view.content
  const count = (code: string) => plan.matches.filter((match) => match.stageCode === code).length
  const table = [...standings].sort((a, b) => count(b.stageCode) - count(a.stageCode))[0]
  const knockout = playedOrder(plan.stages, plan.matches)
    .filter((stage) => stage.format !== "ROUND_ROBIN" && count(stage.code) > 0)
    .at(-1)
  return { table, knockout }
}

/** The matches a reader wants first: the one on now or next on a stage, the others of that moment as cards. */
function AroundNow({ matches, open }: { matches: CompetitionMatch[]; open: () => void }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const strip = matchStrip(matches, now, 7, 4)
  // A pairing still open says little here; it has its place in the schedule and the bracket.
  const ahead = strip.filter(
    (entry) => entry.result?.scoreA == null && matchSides(entry, languageTag).some((side) => side.known),
  )
  const live = ahead.some((entry) => matchUnderway(entry, now))
  const results = strip.filter((entry) => entry.result?.scoreA != null)
  const more = { label: text("Lịch & kết quả", "Schedule & results"), open }
  return (
    <>
      {ahead.length > 0 && (
        <Section
          title={live ? text("Đang và sắp diễn ra", "Now and next") : text("Sắp diễn ra", "Coming up")}
          more={more}
        >
          <div className="tn-now">
            <MatchSpotlight entry={ahead[0]!} />
            {ahead.length > 1 && (
              <div className="tn-now-cards">
                {ahead.slice(1, 5).map((entry) => (
                  <MatchCard key={entry.match.key} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </Section>
      )}
      {results.length > 0 && (
        <Section title={text("Kết quả mới nhất", "Latest results")} more={ahead.length ? undefined : more}>
          <div className="tn-results">
            {results.map((entry) => (
              <MatchCard key={entry.match.key} entry={entry} />
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

/**
 * What a reader wants first: the matches around now, how the bracket stands, then the table with the final ranking,
 * the awards and the facts beside it. The other tabs hold each of these in full.
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
  const stage = plan.stages.find((item) => item.code === table?.stageCode)
  const started = matches.some((entry) => entry.result?.scoreA != null)
  const finished = competitionStatus(view.content) === "FINISHED"
  // Before anybody has played, a table of zeros says nothing the list of teams does not say better.
  const showTable = table && (started || finished)
  const bracket = knockout && (
    <Section title={text("Nhánh đấu", "Bracket")} note={stageName(knockout.name)}>
      <Bracket view={view} stage={knockout} />
    </Section>
  )
  return (
    <div className="tn-summary">
      {!matches.length && (
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
      <AroundNow matches={matches} open={() => openTab("matches")} />
      {bracket}
      <div className="tn-overview">
        <div className="tn-overview-main">
          {showTable && (
            <Section
              title={text("Bảng xếp hạng", "Standings")}
              note={stage && stageName(stage.name)}
              more={
                table.rows.length > 10 || standings.length > 1
                  ? { label: text("Xem đầy đủ", "See all"), open: () => openTab("standings") }
                  : undefined
              }
            >
              <StandingsTable view={view} table={table} limit={10} />
            </Section>
          )}
          {showTable ? <CompetitionFacts view={view} wide /> : <TeamWall view={view} open={() => openTab("teams")} />}
        </div>
        <aside className="tn-overview-side">
          <CompetitionAbout view={view} />
          {!showTable && <CompetitionFacts view={view} />}
          <FinalRanking view={view} />
          <CompetitionAwards view={view} preview={3} />
        </aside>
      </div>
    </div>
  )
}
