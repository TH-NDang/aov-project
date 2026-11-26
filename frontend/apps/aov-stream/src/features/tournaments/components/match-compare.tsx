import type { ReactNode } from "react"
import { Link } from "react-router"
import { RankBadge } from "@aov/ui/components/rank-badge"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionMatches, competitionMatchHref, type CompetitionMatch } from "../../../lib/match-model"
import { matchSides } from "../../../lib/match-schedule"
import { comparedPlaces } from "../../../lib/place-zones"
import { meetings, teamForm, teamRecord } from "../../../lib/standings-model"
import { FormMarks } from "./form-marks"
import "./match-compare.css"

type Line = { label: string; a: ReactNode; b: ReactNode; ahead?: "a" | "b" | null }

const better = (a: number, b: number) => (a === b ? null : a > b ? "a" : "b")

/**
 * How two teams compare over the rest of the competition: their place, their record, their form and their meetings.
 * Nothing shows until both have played something besides this match.
 */
export function MatchCompare({ entry }: { entry: CompetitionMatch }) {
  const { text, languageTag } = useStreamLocale()
  const [a, b] = matchSides(entry, languageTag)
  if (!a.teamId || !b.teamId || !a.known || !b.known) return null
  const others = competitionMatches([entry.competition]).filter((item) => item.match.key !== entry.match.key)
  const [first, second] = [teamRecord(others, a.teamId), teamRecord(others, b.teamId)]
  if (!first.played || !second.played) return null
  const rank = comparedPlaces(entry.competition, entry.match.stageCode, a.teamId, b.teamId)
  const rate = (record: typeof first) => record.won / record.played
  const games = (record: typeof first) => record.gamesWon - record.gamesLost
  const met = meetings(others, a.teamId, b.teamId)
  const lines: Line[] = [
    ...(rank
      ? [
          {
            label: text("Thứ hạng", "Rank"),
            a: <RankBadge place={rank.a} />,
            b: <RankBadge place={rank.b} />,
            ahead: better(rank.b, rank.a),
          } satisfies Line,
        ]
      : []),
    {
      label: text("Trận thắng – thua", "Matches won – lost"),
      a: `${first.won}–${first.lost}`,
      b: `${second.won}–${second.lost}`,
      ahead: better(rate(first), rate(second)),
    },
    {
      label: text("Ván thắng – thua", "Games won – lost"),
      a: `${first.gamesWon}–${first.gamesLost}`,
      b: `${second.gamesWon}–${second.gamesLost}`,
      ahead: better(games(first), games(second)),
    },
    {
      label: text("Phong độ", "Form"),
      a: <FormMarks marks={teamForm(others, a.teamId)} />,
      b: <FormMarks marks={teamForm(others, b.teamId)} />,
    },
  ]
  return (
    <section className="tn-block" aria-labelledby="match-compare">
      <div className="tn-heading">
        <h2 id="match-compare">
          {text("So sánh hai đội", "How the teams compare")}{" "}
          <small>{text("các trận khác trong giải", "other matches of the tournament")}</small>
        </h2>
      </div>
      <div className="tn-compare">
        <div className="tn-compare-teams">
          {[a, b].map((team) => (
            <span key={team.side} data-side={team.side}>
              <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
              <strong title={team.fullName}>{team.name}</strong>
            </span>
          ))}
        </div>
        <dl>
          {lines.map((line) => (
            <div key={line.label}>
              <dd data-ahead={line.ahead === "a" || undefined}>{line.a}</dd>
              <dt>{line.label}</dt>
              <dd data-ahead={line.ahead === "b" || undefined}>{line.b}</dd>
            </div>
          ))}
        </dl>
        {met.length > 0 && (
          <p className="tn-compare-met">
            <span>{text("Đã gặp nhau", "Already met")}</span>
            {met.map((item) => {
              const [one, two] = matchSides(item, languageTag)
              // The score reads in the order of this page's teams, whoever was listed first that time.
              const [own, other] = one.teamId === a.teamId ? [one, two] : [two, one]
              return (
                <Link key={item.match.key} to={competitionMatchHref(item.competition.id, item.match.key)}>
                  {a.name} {own.score}–{other.score} {b.name}
                </Link>
              )
            })}
          </p>
        )}
      </div>
    </section>
  )
}
