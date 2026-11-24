import { TierEmblem } from "@aov/ui/components/tier-emblem"
import type { CompetitionView } from "@aov/community-contracts"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { dayRange } from "../../../components/community-ui"
import { CompetitionClock, CompetitionLogo, StatusBadge } from "../../../components/competition-card"
import { EntityPageLink, GoLink } from "../../../components/go-link"
import { RegionMark } from "../../../components/region-mark"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionChampion, type Champion } from "../../../lib/champion-model"
import { competitionRegionName } from "../../../lib/competition-filters"
import { codeName, competitionStatus, TIER_NAMES } from "../../../lib/competition-model"
import { competitionProgress } from "../../../lib/stage-phases"
import { useNow } from "../../../lib/use-now"
import { StageRail } from "./stage-rail"
import "./competition-head.css"

/** The champion at the far end of the head, under the light of its own logo. */
function ChampionMark({ won }: { won: Champion }) {
  const { text } = useStreamLocale()
  const { winner, runnerUp, score } = won
  return (
    <div className="tn-head-champion">
      <StreamImage src={winner.logoUrl} darkSrc={winner.logoDarkUrl} logo name={winner.name} />
      <div>
        <span>
          <StreamIcon name="trophy" size={15} />
          {text("Nhà vô địch", "Champion")}
        </span>
        <strong>{winner.id ? <EntityPageLink kind="TEAM" id={winner.id} name={winner.name} /> : winner.name}</strong>
        {runnerUp && (
          <small>
            {score
              ? text(`Thắng ${score} trước ${runnerUp.name}`, `Beat ${runnerUp.name} ${score}`)
              : text(`Á quân: ${runnerUp.name}`, `Runner-up: ${runnerUp.name}`)}
          </small>
        )}
      </div>
    </div>
  )
}

/** How far a competition that has no champion yet has come. */
function ClockMark({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const now = useNow()
  const ongoing = competitionStatus(view.content, now) === "ONGOING"
  const { played, total } = competitionProgress(view)
  return (
    <div className="tn-head-clock">
      <strong>
        <CompetitionClock entry={view} />
      </strong>
      {ongoing && total > 0 && (
        <progress value={played} max={total} aria-label={text("Tiến độ giải", "Tournament progress")} />
      )}
    </div>
  )
}

/** The head of a competition: its logo, what it is and when, its champion or its clock, and its stages in order. */
export function CompetitionHead({ view, openStages }: { view: CompetitionView; openStages: () => void }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament, plan, circuit } = view.content
  const won = competitionChampion(view)
  const status = competitionStatus(view.content)
  const tier = codeName(TIER_NAMES, tournament.tier, text)
  return (
    <Stage
      tint={tournament.name}
      lights={[
        { src: tournament.logoUrl, darkSrc: tournament.logoDarkUrl, at: "left" },
        ...(won ? [{ src: won.winner.logoUrl, darkSrc: won.winner.logoDarkUrl, at: "right" as const }] : []),
      ]}
      className="tn-head"
    >
      <header className="tn-head-main">
        <CompetitionLogo name={tournament.name} url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} size="head" />
        <div className="tn-head-title">
          <p className="tn-head-place">
            {circuit ? (
              <GoLink className="hub-go-pill" to={`/pages/${circuit.code}`}>
                {circuit.shortName && <abbr className="tn-head-short">{circuit.shortName}</abbr>}
                {circuit.name}
              </GoLink>
            ) : (
              plan.circuit && <span>{plan.circuit}</span>
            )}
            {tournament.region && (
              <span className="tn-head-tier">
                <RegionMark code={tournament.region} />
                {competitionRegionName(tournament.region, languageTag)}
              </span>
            )}
            {tier && (
              <span className="tn-head-tier">
                <TierEmblem tier={tournament.tier} size={20} label={tier} />
                <span aria-hidden="true">{tier}</span>
              </span>
            )}
          </p>
          <h1>{tournament.name}</h1>
          <div className="tn-head-facts">
            <StatusBadge status={status} tone="banner" />
            <span>
              <StreamIcon name="calendar" size={15} />
              {dayRange(tournament.startsOn, tournament.endsOn)}
            </span>
            {plan.entrants.length > 0 && (
              <span>
                <StreamIcon name="users" size={15} />
                {text(
                  `${plan.entrants.length} đội`,
                  `${plan.entrants.length} ${plan.entrants.length === 1 ? "team" : "teams"}`,
                )}
              </span>
            )}
            {plan.prizePool && (
              <span>
                <StreamIcon name="trophy" size={15} />
                <LocalPrizeText
                  text={plan.prizePool}
                  currency={plan.currency}
                  on={tournament.endsOn ?? tournament.startsOn}
                  locale={languageTag}
                />
              </span>
            )}
          </div>
        </div>
        {won ? <ChampionMark won={won} /> : status !== "FINISHED" && <ClockMark view={view} />}
      </header>
      <StageRail view={view} open={openStages} />
    </Stage>
  )
}
