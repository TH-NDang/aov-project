import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { CompetitionClock, StatusBadge } from "../../../components/competition-card"
import { hueOf } from "../../../components/community-ui"
import { RegionMark } from "../../../components/region-mark"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { ThemedLogo } from "../../../components/themed-logo"
import { competitionChampion, type ChampionTeam } from "../../../lib/champion-model"
import { competitionStatus } from "../../../lib/competition-model"
import type { ChampionBanner } from "../../../lib/season-map"
import { seasonName } from "../../../lib/season-name"
import { Crest } from "../../../components/crest"
import "./champion-rafters.css"

/** Titles drawn as stars; more than these are a number beside one star. */
const STARS = 5

/**
 * The champions who hold their circuits now, as the banners an arena hangs from its roof: the team on a crest, a star
 * for each title it has won there, and the final it won. The roof is dark in both themes.
 */
export function ChampionRafters({ banners }: { banners: ChampionBanner[] }) {
  const { text } = useStreamLocale()
  if (!banners.length) return null
  return (
    <section className="tn-rafters" aria-labelledby="champions-now">
      <span className="tn-rafters-truss" aria-hidden="true" />
      <h2 id="champions-now">{text("Đương kim vô địch", "Reigning champions")}</h2>
      <ol className="tn-banners">
        {banners.map((banner, at) => (
          <Banner key={banner.key} banner={banner} at={at} />
        ))}
      </ol>
    </section>
  )
}

function Banner({ banner: { view, titles, next }, at }: { banner: ChampionBanner; at: number }) {
  const { text } = useStreamLocale()
  const { circuit, plan, tournament } = view.content
  const won = competitionChampion(view)
  if (!won) return null
  const { winner, runnerUp, score } = won
  const name = circuit?.name || plan.circuit || tournament.name
  return (
    <li className="tn-banner" style={{ "--banner-hue": hueOf(winner.name), "--banner-at": at } as CSSProperties}>
      <Cloth team={winner} />
      <p className="tn-banner-circuit">
        <span className="tn-banner-mark" aria-hidden="true">
          <ThemedLogo src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
        </span>
        {circuit?.published ? (
          <Link to={`/pages/${circuit.code}`} title={name}>
            {circuit.shortName || name}
          </Link>
        ) : (
          <span title={name}>{circuit?.shortName || name}</span>
        )}
        <RegionMark code={tournament.region} size={16} />
      </p>
      <Crest team={winner} />
      <Titles count={titles} />
      <h3>
        <Link to={`/competitions/${view.id}`}>{winner.name}</Link>
      </h3>
      <p className="tn-banner-season">{seasonName(tournament.name, name)}</p>
      {runnerUp && (
        <p className="tn-banner-final">
          {score ? <b>{score}</b> : text("Á quân", "Runner-up")}
          <StreamImage src={runnerUp.logoUrl} darkSrc={runnerUp.logoDarkUrl} logo name={runnerUp.name} />
          <span title={runnerUp.name}>{runnerUp.shortName || runnerUp.name}</span>
        </p>
      )}
      {next && <NextSeason view={next} />}
    </li>
  )
}

/** The cloth of a banner, dyed by the colours of the team's logo, or by a hue of its name when it has none. */
function Cloth({ team }: { team: ChampionTeam }) {
  const url = team.logoDarkUrl || team.logoUrl
  return (
    <span className="tn-banner-cloth" data-dyed={!!url || undefined} aria-hidden="true">
      <span>{url && <img src={url} alt="" decoding="async" loading="lazy" />}</span>
    </span>
  )
}

function Titles({ count }: { count: number }) {
  const { text } = useStreamLocale()
  // Only published seasons are known here, so a circuit that is published in part counts less than it was won.
  const told = text(
    `${count} lần vô địch trong các mùa đã công bố`,
    `${count} ${count === 1 ? "title" : "titles"} in the published seasons`,
  )
  return (
    <p className="tn-titles" title={told}>
      <span className="sr-only">{told}</span>
      <span aria-hidden="true">
        {Array.from({ length: count > STARS ? 1 : count }, (_, index) => (
          <svg key={index} viewBox="0 0 12 12" width="12" height="12">
            <path d="M6 .8 7.6 4.3l3.8.4-2.8 2.5.8 3.8L6 9.1 2.6 11l.8-3.8L.6 4.7l3.8-.4Z" fill="currentColor" />
          </svg>
        ))}
        {count > STARS && <b>×{count}</b>}
      </span>
    </p>
  )
}

/** The season that is on or next: whether the holder is defending the title, the line of a banner that changes. */
function NextSeason({ view }: { view: CompetitionView }) {
  return (
    <p className="tn-banner-next">
      <Link to={`/competitions/${view.id}`} title={view.content.tournament.name}>
        <StatusBadge status={competitionStatus(view.content)} size="small" />
        <CompetitionClock entry={view} />
      </Link>
    </p>
  )
}
