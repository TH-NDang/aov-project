import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import { clubBans } from "../../../lib/club-model"
import { gamesText } from "../../../lib/feed-words"
import { ENOUGH_FOR_SHARE, shareWords } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { shownGames, type BanHabit, type TeamRecord } from "../../../lib/team-draft-model"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./club-bans.css"

type Whose = "own" | "against"

/** Heroes a list holds; the same on every screen, since a shorter list would start with another hero. */
const SHOWN = 6

function Ban({
  data,
  record,
  whose,
  ban,
  scale,
}: {
  data: StatsData
  record: TeamRecord
  whose: Whose
  ban: BanHabit
  /** The share the longest bar stands for. */
  scale: number
}) {
  const { text, languageTag } = useStreamLocale()
  const { hero, games, share, elsewhere } = ban
  const count = gamesText(games, text, languageTag)
  const rest = shareWords(elsewhere, text)
  const shares =
    shownGames(record) < ENOUGH_FOR_SHARE
      ? null
      : {
          here: shareWords(share, text),
          elsewhere:
            whose === "own"
              ? text(`đội khác ${rest}`, `others ${rest}`)
              : text(`gặp đội khác ${rest}`, `against others ${rest}`),
        }
  return (
    <Link
      className="tn-club-ban"
      data-counts={!shares || undefined}
      to={statsHref(data.view.id, {
        question: { team: record.teamId, [whose === "own" ? "banA" : "banB"]: [hero] },
        scope: data.period?.key,
      })}
      aria-label={[`${hero.name}: ${count}`, shares?.here, shares?.elsewhere].filter(Boolean).join(", ")}
    >
      <HeroPortrait hero={hero} banned />
      <strong>{hero.name}</strong>
      <i style={{ "--share": share / scale, "--elsewhere": elsewhere / scale } as CSSProperties} />
      <b>{count}</b>
      {shares && (
        <small>
          <span>{shares.here}</span>, {shares.elsewhere}
        </small>
      )}
    </Link>
  )
}

function Bans({
  data,
  record,
  whose,
  bans,
  scale,
}: {
  data: StatsData
  record: TeamRecord
  whose: Whose
  bans: BanHabit[]
  scale: number
}) {
  const { text } = useStreamLocale()
  const own = whose === "own"
  const shown = shownGames(record)
  const all = record.games.length
  const notes = [
    shown < all && text(`${shown} trong ${all} ván có ghi lượt cấm`, `${shown} of ${all} games record their bans`),
    bans.length > 0 &&
      (own
        ? text("vạch đứng là mức của các đội khác", "the upright line is what the others ban")
        : text("vạch đứng là mức khi gặp đội khác", "the upright line is what the others meet")),
  ]
  return (
    <Section
      title={own ? text("Hay cấm", "Usual bans") : text("Bị cấm khi gặp đội này", "Banned against this team")}
      note={notes.filter(Boolean).join(", ")}
    >
      {bans.length ? (
        <ol className="tn-club-bans">
          {bans.map((ban) => (
            <li key={ban.hero.key}>
              <Ban data={data} record={record} whose={whose} ban={ban} scale={scale} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="tn-quiet">
          {own
            ? text(
                "Không tướng nào bị đội này cấm nhiều hơn hẳn các đội khác.",
                "This team bans no hero much more than the others do.",
              )
            : text(
                "Không tướng nào bị cấm nhiều hơn hẳn khi gặp đội này.",
                "No hero is banned much more against this team than against the others.",
              )}
        </p>
      )}
    </Section>
  )
}

/**
 * The bans that tell a team from the others, and those others make against it: how often, and how often in the rest of
 * the competition. Both lists share one scale. A line leads to its games. Nothing shows while no game of the team says
 * who was banned.
 */
export function ClubBans({ data, record }: { data: StatsData; record: TeamRecord }) {
  const lists = (["own", "against"] as const).map((whose) => ({
    whose,
    bans: clubBans(data.feed, record, whose, SHOWN),
  }))
  if (!shownGames(record)) return null
  const scale = Math.max(...lists.flatMap(({ bans }) => bans.map(({ share }) => share)), 0.01)
  return (
    <div className="tn-club-ban-lists">
      {lists.map(({ whose, bans }) => (
        <Bans key={whose} data={data} record={record} whose={whose} bans={bans} scale={scale} />
      ))}
    </div>
  )
}
