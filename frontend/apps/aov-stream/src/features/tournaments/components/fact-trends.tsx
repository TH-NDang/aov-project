import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import type { Trend, TrendPeriod, Trends } from "../../../lib/facts-model"
import { gamesText, periodName } from "../../../lib/feed-words"
import { heroesHref } from "../../../lib/heroes-view"
import { shareText } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-trends.css"

/** Heroes listed for each way a share may go. */
export const TRENDS = 4

/** A name that breaks between its words alone: "2–4" stays whole in a narrow column. */
const ranged = (name: string) => name.replaceAll("–", "–\u2060")

/** Heroes seen much more, or much less, from one part of the competition to the next: a column a part. */
export function FactTrends({ data, trends: { periods, up, down } }: { data: StatsData; trends: Trends }) {
  const { text, languageTag } = useStreamLocale()
  const most = Math.max(...[...up, ...down].flatMap(({ shares }) => shares))
  const groups: { title: string; trends: Trend[] }[] = [
    { title: text("Có mặt nhiều hơn lúc đầu", "Seen more than at first"), trends: up.slice(0, TRENDS) },
    { title: text("Có mặt ít hơn lúc đầu", "Seen less than at first"), trends: down.slice(0, TRENDS) },
  ]
  const title = periods.some(({ patch }) => patch)
    ? text("Qua các bản cập nhật", "From update to update")
    : text("Qua các giai đoạn", "From stage to stage")
  const partly = periods.some(({ games, shown }) => shown < games)
  const gamesOf = ({ games, shown }: TrendPeriod) =>
    shown < games ? text(`${shown}/${games} ván`, `${shown}/${games} games`) : gamesText(games, text, languageTag)
  return (
    <Section
      title={title}
      note={
        partly
          ? text("tỷ lệ ván có mặt, trong các ván có ghi lượt cấm", "share of games seen in, of those that record bans")
          : text("tỷ lệ ván có mặt", "share of games seen in")
      }
    >
      <table className="tn-fact-trends" aria-label={title}>
        <thead>
          <tr>
            <td />
            {periods.map((period) => (
              <th key={period.key} scope="col">
                <Link to={heroesHref(data.view.id, {}, period.key)}>
                  {ranged(periodName(period, text, languageTag))}
                  <span>{gamesOf(period)}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        {groups
          .filter(({ trends }) => trends.length > 0)
          .map(({ title, trends }) => (
            <tbody key={title}>
              <tr className="tn-fact-trends-way">
                <th scope="rowgroup" colSpan={periods.length + 1}>
                  {title}
                </th>
              </tr>
              {trends.map(({ hero, shares }) => (
                <tr key={hero.key}>
                  <th scope="row">
                    <Link to={statsHref(data.view.id, { hero })}>
                      <HeroPortrait hero={hero} />
                      <span>{hero.name}</span>
                    </Link>
                  </th>
                  {shares.map((share, at) => (
                    <td key={periods[at]!.key} style={{ "--share": share / most } as CSSProperties}>
                      {share > 0 ? (
                        <>
                          <span>{shareText(share, 1)}</span>
                          <i aria-hidden="true" />
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">–</span>
                          <span className="sr-only">{text("không có mặt", "not seen")}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
      </table>
    </Section>
  )
}
