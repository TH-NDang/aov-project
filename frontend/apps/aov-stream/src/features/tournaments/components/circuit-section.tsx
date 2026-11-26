import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Link } from "react-router"
import { TierEmblem } from "@aov/ui/components/tier-emblem"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { dayRange } from "../../../components/community-ui"
import { CompetitionClock, CompetitionLogo, StatusBadge } from "../../../components/competition-card"
import { FoldButton } from "../../../components/fold-button"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionChampion, mostTitles } from "../../../lib/champion-model"
import { codeName, competitionStatus, TIER_NAMES } from "../../../lib/competition-model"
import type { CircuitGroup, SeasonRow } from "../../../lib/directory-model"
import { seasonName } from "../../../lib/season-name"
import "./circuit-section.css"

/** Seasons a circuit shows before the rest fold away. */
const PREVIEW = { wide: 6, compact: 4 }

/** One season on a line: what it was, who won it and against whom; a season not over yet says where it stands. */
function Season({ row, within }: { row: SeasonRow; within: string | null }) {
  const { text } = useStreamLocale()
  const { view, part } = row
  const { tournament, plan } = view.content
  const won = competitionChampion(view)
  const status = competitionStatus(view.content)
  const tier = codeName(TIER_NAMES, tournament.tier, text)
  return (
    <Link className="tn-season" to={`/competitions/${view.id}`} data-part={part || undefined}>
      <CompetitionLogo name={tournament.name} url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} />
      <span className="tn-season-name">
        <strong title={tournament.name}>
          {seasonName(tournament.name, within)}
          {tier && <TierEmblem tier={tournament.tier} size={18} label={tier} />}
        </strong>
        <span>{dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}</span>
      </span>
      {won ? (
        <span className="tn-season-champion">
          <StreamImage src={won.winner.logoUrl} darkSrc={won.winner.logoDarkUrl} logo name={won.winner.name} />
          <span>
            <span className="sr-only">{text("Nhà vô địch:", "Champion:")} </span>
            <b>{won.winner.name}</b>
            {won.runnerUp && (
              <small>
                {won.score
                  ? text(`thắng ${won.score} ${won.runnerUp.name}`, `beat ${won.runnerUp.name} ${won.score}`)
                  : text(`á quân ${won.runnerUp.name}`, `runner-up ${won.runnerUp.name}`)}
              </small>
            )}
          </span>
        </span>
      ) : status && status !== "FINISHED" ? (
        <span className="tn-season-state">
          <StatusBadge status={status} size="small" />
          <CompetitionClock entry={view} />
        </span>
      ) : null}
      <span className="tn-season-size">
        {plan.entrants.length > 1 && text(`${plan.entrants.length} đội`, `${plan.entrants.length} teams`)}
      </span>
      <StreamIcon name="chevronRight" size={16} />
    </Link>
  )
}

/**
 * A circuit as its roll of honour: one line for each season, newest first, with the parts of a season under it. Older
 * seasons fold away until asked for; a filtered list (`open`) shows them all.
 */
export function CircuitSection({ group, open }: { group: CircuitGroup; open: boolean }) {
  const { text } = useStreamLocale()
  const [expanded, setExpanded] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const preview = PREVIEW[usePageLayout()]
  const { rows, other } = group
  const { circuit, plan } = rows[0]!.view.content
  const name = other ? text("Các giải đấu khác", "Other tournaments") : circuit?.name || plan.circuit
  const views = rows.map((row) => row.view)
  const leader = other ? null : mostTitles(rows.filter((row) => !row.part).map((row) => row.view))
  const shown = open || expanded ? rows : rows.slice(0, preview)
  const hidden = rows.length - shown.length
  // Folding keeps the button where the reader pressed it.
  const fold = () => {
    const before = toggle.current?.getBoundingClientRect().top ?? 0
    flushSync(() => setExpanded(!expanded))
    const after = toggle.current?.getBoundingClientRect().top ?? before
    if (expanded) window.scrollBy({ top: after - before, behavior: "instant" })
  }
  return (
    <section className="tn-circuit">
      <div className="tn-heading">
        <h2>
          {!other && circuit?.published ? (
            <Link className="tn-circuit-name" to={`/pages/${circuit.code}`}>
              {name}
              <StreamIcon name="chevronRight" size={18} />
            </Link>
          ) : (
            name
          )}{" "}
          <small>
            {other
              ? text(`${views.length} giải`, `${views.length} ${views.length === 1 ? "tournament" : "tournaments"}`)
              : text(`${views.length} mùa giải`, `${views.length} ${views.length === 1 ? "season" : "seasons"}`)}
            {leader && (
              <>
                {", "}
                {text(
                  `${leader.team.name} vô địch nhiều nhất (${leader.count})`,
                  `most titles: ${leader.team.name} (${leader.count})`,
                )}
              </>
            )}
          </small>
        </h2>
      </div>
      <div className="tn-seasons">
        {shown.map((row) => (
          <Season key={row.view.id} row={row} within={other ? null : name} />
        ))}
      </div>
      <FoldButton
        ref={toggle}
        fold={{ folds: !open && rows.length > preview, open: expanded, toggle: fold }}
        more={text(
          `Xem thêm ${hidden} ${other ? "giải" : "mùa giải"}`,
          `Show ${hidden} more ${other ? (hidden === 1 ? "tournament" : "tournaments") : hidden === 1 ? "season" : "seasons"}`,
        )}
      />
    </section>
  )
}
