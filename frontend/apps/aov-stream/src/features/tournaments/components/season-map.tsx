import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { TierEmblem } from "@aov/ui/components/tier-emblem"
import { dayRange } from "../../../components/community-ui"
import { CompetitionClock, CompetitionLogo, StatusBadge } from "../../../components/competition-card"
import { GoLink } from "../../../components/go-link"
import { RegionMark } from "../../../components/region-mark"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionChampion } from "../../../lib/champion-model"
import { codeName, competitionStatus, TIER_NAMES } from "../../../lib/competition-model"
import { dayMonth } from "../../../lib/match-time"
import { seasonLanes, shareOfYear, topTier, type SeasonBar, type SeasonLane } from "../../../lib/season-map"
import { seasonName, seasonOfYear, shortCompetitionName } from "../../../lib/season-name"
import { useNow } from "../../../lib/use-now"
import { Crest } from "../../../components/crest"
import "./season-map.css"

/**
 * A year of competitions as lanes, one per circuit: each season is a line over the weeks it was played, under the crest
 * of its champion and its name. On phones a lane is a list, and the line is a small picture of its place in the year.
 */
export function SeasonMap({ views, year }: { views: CompetitionView[]; year: number }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const lanes = seasonLanes(views, year)
  const today = new Date(now).getUTCFullYear() === year ? shareOfYear(now, year) : null
  const months = Array.from({ length: 12 }, (_, month) => {
    const at = Date.UTC(year, month, 1)
    return {
      share: shareOfYear(at, year),
      name: new Intl.DateTimeFormat(languageTag, { month: "short", timeZone: "UTC" }).format(at).replace("tháng", "Th"),
    }
  })
  return (
    <div className="tn-map" style={{ "--today": today ?? -1 } as CSSProperties}>
      <div className="tn-map-months" aria-hidden="true">
        <span />
        <span className="tn-map-scale">
          {months.map(({ share, name }) => (
            <span key={share} style={{ "--at": share } as CSSProperties}>
              {name}
            </span>
          ))}
        </span>
      </div>
      <ol className="tn-map-lanes">
        {lanes.map((lane) => (
          <Lane key={lane.key} lane={lane} year={year} />
        ))}
      </ol>
      {today != null && (
        <div className="tn-map-today" aria-hidden="true">
          <span>{text("Hôm nay", "Today")}</span>
        </div>
      )}
    </div>
  )
}

function Lane({ lane, year }: { lane: SeasonLane; year: number }) {
  const { text } = useStreamLocale()
  const { views, other, bars, lines, tall, undated } = lane
  const { circuit, plan, tournament } = views[0]!.content
  const name = other ? text("Các giải khác", "Other tournaments") : circuit?.name || plan.circuit || tournament.name
  const drawn = views.map((view) => view.content.tournament).find((item) => item.logoUrl || item.logoDarkUrl)
  const regions = [...new Set(views.map((view) => view.content.tournament.region).filter((code) => !!code))]
  const top = topTier(views)
  const tier = codeName(TIER_NAMES, top, text)
  return (
    <li className="tn-map-lane" style={{ "--lines": lines, "--tall": tall } as CSSProperties}>
      <div className="tn-map-head">
        {!other && <CompetitionLogo name={name} url={drawn?.logoUrl} darkUrl={drawn?.logoDarkUrl} />}
        <div>
          <h3>{circuit?.published && !other ? <GoLink to={`/pages/${circuit.code}`}>{name}</GoLink> : name}</h3>
          <p>
            {!other && tier && <TierEmblem tier={top} size={18} label={tier} />}
            {regions.length > 3 ? (
              <RegionMark code="GLOBAL" size={16} />
            ) : (
              regions.map((code) => <RegionMark key={code} code={code} size={16} />)
            )}
            {circuit?.shortName && !other && <span>{circuit.shortName}</span>}
          </p>
        </div>
      </div>
      <ol className="tn-map-lane-track">
        {bars.map((bar) => (
          <Bar key={bar.view.id} bar={bar} circuit={other ? null : name} year={year} />
        ))}
        {undated.map((view) => (
          <li key={view.id} className="tn-map-bar" data-undated="">
            <Link to={`/competitions/${view.id}`}>{seasonName(view.content.tournament.name, other ? null : name)}</Link>
          </li>
        ))}
      </ol>
    </li>
  )
}

/** A competition in words for a title: its name, its days and its champion. */
function inWords(view: CompetitionView, champion: string) {
  const { tournament } = view.content
  const won = competitionStatus(view.content) === "FINISHED" ? competitionChampion(view) : null
  return [tournament.name, dayRange(tournament.startsOn, tournament.endsOn), won && `${champion}: ${won.winner.name}`]
    .filter(Boolean)
    .join("\n")
}

function Bar({ bar, circuit, year }: { bar: SeasonBar; circuit: string | null; year: number }) {
  const { view, from, to, left, right, line, above, parts, partsFrom, partsTo } = bar
  const { text, languageTag } = useStreamLocale()
  const { tournament } = view.content
  const champion = text("Vô địch", "Champion")
  const status = competitionStatus(view.content)
  const won = status === "FINISHED" ? competitionChampion(view) : null
  const season = seasonName(tournament.name, circuit)
  const days = [tournament.startsOn, tournament.endsOn].filter((day) => !!day).map((day) => dayMonth(day!, languageTag))
  return (
    <li
      className="tn-map-bar"
      data-status={status ?? undefined}
      data-won={won ? "" : undefined}
      style={
        {
          "--from": from,
          "--to": to,
          "--left": left,
          "--right": right,
          "--line": line,
          "--above": above,
          "--parts-from": partsFrom,
          "--parts-to": partsTo,
        } as CSSProperties
      }
    >
      <Link to={`/competitions/${view.id}`} title={inWords(view, champion)}>
        {won && <Crest team={won.winner} />}
        <span className="tn-map-bar-name">
          <strong>
            {seasonOfYear(season, year) || (view.content.circuit?.shortName ? shortCompetitionName(view) : season)}
          </strong>
          <span>
            {won && (
              <>
                <span className="sr-only">{champion}: </span>
                <b>{won.winner.shortName || won.winner.name}</b>
              </>
            )}
            {status === "ONGOING" ? (
              <StatusBadge status={status} size="small" />
            ) : status && status !== "FINISHED" ? (
              <CompetitionClock entry={view} />
            ) : null}
            {status !== "ONGOING" && <span className="tn-map-bar-days">{[...new Set(days)].join(" – ")}</span>}
          </span>
        </span>
        <span className="tn-map-bar-span" aria-hidden="true" />
      </Link>
      {parts.length > 0 && (
        <ul className="tn-map-parts">
          {parts.map((part) => (
            <li key={part.view.id}>
              <Link to={`/competitions/${part.view.id}`} title={inWords(part.view, champion)}>
                {part.name}
                {part.from != null && (
                  <span
                    className="tn-map-tick"
                    style={{ "--from": part.from, "--to": part.to } as CSSProperties}
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
