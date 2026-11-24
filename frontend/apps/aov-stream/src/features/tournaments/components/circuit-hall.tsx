import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { TierEmblem } from "@aov/ui/components/tier-emblem"
import { CompetitionClock, CompetitionLogo, StatusBadge } from "../../../components/competition-card"
import { GoLink } from "../../../components/go-link"
import { RegionMark } from "../../../components/region-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionChampion, mostTitles } from "../../../lib/champion-model"
import { codeName, competitionStatus, TIER_NAMES } from "../../../lib/competition-model"
import { aheadCompetitions, circuitChampions, circuitYears, type CircuitGroup } from "../../../lib/directory-model"
import { seasonName } from "../../../lib/season-name"
import { Season } from "./circuit-section"
import "./circuit-hall.css"

/** Earlier champions a card has room for. */
const ROLL = 6
/** Up to this many, each has a line of its own with its name and its season. */
const FEW = 2

/**
 * A circuit as a hall of champions: who holds the title, who held it before, and the season on now or next. Its whole
 * list of seasons opens below, over the full width of the grid.
 */
export function CircuitHall({ group }: { group: CircuitGroup }) {
  const { text } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const card = useRef<HTMLElement>(null)
  const views = group.rows.map((row) => row.view)
  const { circuit, plan } = views[0]!.content
  const name = circuit?.name || plan.circuit || ""
  const [holder, ...before] = circuitChampions(group)
  const leader = mostTitles(group.rows.filter((row) => !row.part).map((row) => row.view))
  const next = aheadCompetitions(views)[0]
  const seasons = group.rows.filter((row) => !row.part).length
  const years = circuitYears(views)
  const toggle = () => {
    flushSync(() => setOpen(!open))
    // The card moves to a line of its own when it opens, and back when it folds.
    card.current?.scrollIntoView({ block: "nearest", behavior: "instant" })
  }
  return (
    <section ref={card} className="tn-hall" data-open={open || undefined} aria-label={name}>
      <header className="tn-hall-head">
        <CircuitMark views={views} name={name} />
        <div>
          <h3>
            {circuit?.published ? <GoLink to={`/pages/${circuit.code}`}>{name}</GoLink> : name}
            {circuit?.shortName && <abbr className="tn-hall-short">{circuit.shortName}</abbr>}
          </h3>
          <p>
            <CircuitMarks views={views} />
            {text(`${seasons} mùa giải`, `${seasons} ${seasons === 1 ? "season" : "seasons"}`)}
            {years && <span>{years}</span>}
          </p>
          {circuit?.introduction && <p className="tn-hall-about">{circuit.introduction}</p>}
          {next && <NextSeason view={next} circuit={name} />}
        </div>
      </header>
      {holder && <Holder view={holder} circuit={name} />}
      {before.length > 0 && (
        <ol
          className="tn-hall-roll"
          data-few={before.length <= FEW || undefined}
          aria-label={text("Các nhà vô địch trước", "Earlier champions")}
        >
          {before.slice(0, ROLL).map((view) => (
            <PastChampion key={view.id} view={view} circuit={before.length <= FEW ? name : undefined} />
          ))}
        </ol>
      )}
      <footer className="tn-hall-foot">
        {leader && (
          <span title={text("Nhiều danh hiệu nhất", "Most titles")}>
            <StreamIcon name="trophy" size={14} />
            <span className="sr-only">{text("Nhiều danh hiệu nhất: ", "Most titles: ")}</span>
            <span className="tn-hall-leader">
              <b>{leader.team.name}</b> {text(`${leader.count} lần`, `${leader.count} times`)}
            </span>
          </span>
        )}
        <button type="button" className="tn-hall-toggle" aria-expanded={open} onClick={toggle}>
          {open ? text("Thu gọn", "Show less") : text("Mọi mùa giải", "All seasons")}
          <StreamIcon name={open ? "chevronLeft" : "chevronRight"} size={14} />
        </button>
      </footer>
      {open && (
        <div className="tn-hall-seasons">
          <div className="tn-seasons">
            {group.rows.map((row) => (
              <Season key={row.view.id} row={row} within={name} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** Where the circuit is played and its tier now; one played all over the world shows its globe alone. */
function CircuitMarks({ views }: { views: CompetitionView[] }) {
  const { text } = useStreamLocale()
  const regions = [...new Set(views.map((view) => view.content.tournament.region).filter((code) => !!code))]
  const tier = views[0]!.content.tournament.tier
  const name = codeName(TIER_NAMES, tier, text)
  return (
    <span className="tn-hall-marks">
      {name && <TierEmblem tier={tier} size={18} label={name} />}
      {regions.length > 3 ? (
        <RegionMark code="GLOBAL" size={16} />
      ) : (
        regions.map((code) => <RegionMark key={code} code={code} />)
      )}
    </span>
  )
}

/** The newest logo a season of the circuit has. */
function CircuitMark({ views, name }: { views: CompetitionView[]; name: string }) {
  const drawn = views.map((view) => view.content.tournament).find((item) => item.logoUrl || item.logoDarkUrl)
  return <CompetitionLogo name={name} url={drawn?.logoUrl} darkUrl={drawn?.logoDarkUrl} size="card" />
}

function NextSeason({ view, circuit }: { view: CompetitionView; circuit: string }) {
  const { tournament } = view.content
  return (
    <Link className="tn-hall-next" to={`/competitions/${view.id}`}>
      <StatusBadge status={competitionStatus(view.content)} size="small" />
      <b>{seasonName(tournament.name, circuit)}</b>
      <span>
        <CompetitionClock entry={view} />
      </span>
    </Link>
  )
}

function Holder({ view, circuit }: { view: CompetitionView; circuit: string }) {
  const { text } = useStreamLocale()
  const won = competitionChampion(view)
  if (!won) return null
  const { winner, runnerUp, score } = won
  return (
    <Link className="tn-hall-holder" to={`/competitions/${view.id}`}>
      <StreamImage src={winner.logoUrl} darkSrc={winner.logoDarkUrl} logo name={winner.shortName || winner.name} />
      <span>
        <small>
          <StreamIcon name="trophy" size={14} />
          {text("Vô địch gần nhất", "Latest champion")}
        </small>
        <b>{winner.name}</b>
        <span>
          {seasonName(view.content.tournament.name, circuit)}
          {runnerUp &&
            (score
              ? text(`, thắng ${score} ${runnerUp.name}`, `, beat ${runnerUp.name} ${score}`)
              : text(`, á quân ${runnerUp.name}`, `, runner-up ${runnerUp.name}`))}
        </span>
      </span>
    </Link>
  )
}

/** An earlier champion: its logo over the year, or with the circuit's name at hand a line with its name and season. */
function PastChampion({ view, circuit }: { view: CompetitionView; circuit?: string }) {
  const won = competitionChampion(view)
  if (!won) return null
  const { tournament } = view.content
  return (
    <li>
      <Link to={`/competitions/${view.id}`} title={`${won.winner.name} · ${tournament.name}`}>
        <StreamImage
          src={won.winner.logoUrl}
          darkSrc={won.winner.logoDarkUrl}
          logo
          name={won.winner.shortName || won.winner.name}
        />
        {circuit ? (
          <>
            <b>{won.winner.name}</b>
            <span>{seasonName(tournament.name, circuit)}</span>
          </>
        ) : (
          <>
            <span className="sr-only">{won.winner.name}, </span>
            <span>{tournament.year ?? tournament.startsOn?.slice(0, 4)}</span>
          </>
        )}
      </Link>
    </li>
  )
}
