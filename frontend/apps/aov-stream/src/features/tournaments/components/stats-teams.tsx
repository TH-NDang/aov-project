import { useMemo, type CSSProperties } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { clubOrder } from "../../../lib/club-model"
import { teamMatches, teamRecords } from "../../../lib/team-draft-model"
import { ClubMvps } from "./club-mvps"
import { ClubRow, ClubRowHead } from "./club-row"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./stats-teams.css"

/**
 * Every team of the games counted, in the order the competition left them, with all of its games side by side: one mark
 * a game, one cluster a match. Below it those named the best of a game most often.
 */
export function StatsTeams({ data }: { data: StatsData }) {
  const { text } = useStreamLocale()
  const { view, feed, period } = data
  const records = useMemo(() => clubOrder(view, teamRecords(feed), period), [view, feed, period])
  const most = Math.max(1, ...records.map(({ games }) => games.length))
  const matches = Math.max(1, ...records.map(teamMatches))
  const heroes = feed.games.some(({ sides }) => sides.some(({ picks }) => picks.length > 0))
  if (!records.length)
    return (
      <div className="hub-state">
        <h2>{text("Chưa có ván nào ghi tên hai đội", "No game names its teams yet")}</h2>
      </div>
    )
  return (
    <div className="tn-clubs-part">
      <Section
        title={text("Từng đội, từng ván", "Every team, game by game")}
        note={text(
          "mỗi vạch một ván, mỗi cụm một trận, vạch cao là thắng",
          "one mark a game, one cluster a match, a tall mark is a win",
        )}
      >
        {!heroes && (
          <p className="tn-quiet">
            {text("Giải này chưa ghi tướng của các ván.", "The heroes of these games are not recorded yet.")}
          </p>
        )}
        {/* A mark is eleven pixels at its widest and a match adds three, so the longest season needs no more than this. */}
        <div style={{ "--season": `${most * 11 + matches * 3}px` } as CSSProperties}>
          <ClubRowHead heroes={heroes} />
          <ol className="tn-clubs">
            {records.map((record) => (
              <li key={record.teamId}>
                <ClubRow data={data} record={record} most={most} heroes={heroes} />
              </li>
            ))}
          </ol>
        </div>
      </Section>
      <ClubMvps data={data} />
    </div>
  )
}
