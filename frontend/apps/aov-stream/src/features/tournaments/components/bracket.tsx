import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react"
import { Link } from "react-router"
import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { PublicDrawer, PublicDrawerContent } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { MatchStatus } from "../../../components/match-card"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { bracketTeams, journeyEnd, teamJourney, type JourneyStop } from "../../../lib/bracket-journey"
import {
  bracketRoundName,
  roundWeight,
  stageBracket,
  type BracketLayout,
  type BracketLink,
  type BracketNode,
} from "../../../lib/bracket-model"
import { matchUnderway, matchWinner } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"
import { competitionMatchHref, type CompetitionMatch } from "../../../lib/match-model"
import { matchSides, type MatchSide } from "../../../lib/match-schedule"
import { useNow } from "../../../lib/use-now"
import { BracketTeams, JourneyStrip, JourneyTrail, useCardWidth } from "./bracket-journey"
import { MatchPeek } from "./match-peek"
import "./bracket.css"

/** The measures of the drawing in pixels; the width of a card follows the room there is, so it lives in the sheet. */
const TOP = 24
const CARD = 94
const ROW = CARD + 18
const HEAD = 28
const LANE = 34
const GAP = 36

/** The top edge of a card. A lane starts lower by the room its heading takes; the final stands between two lanes. */
function topOf(node: BracketNode, laned: boolean) {
  const lane = !laned ? 0 : node.lane === "lower" ? LANE + HEAD : node.lane === "final" ? (LANE + HEAD) / 2 : 0
  return HEAD + node.row * ROW + lane + (node.lane === "third" ? HEAD : 0)
}

const left = (column: number) => `calc(${column} * (var(--bracket-card) + ${GAP}px))`

/** One heading per round: over the first card of its column, or over the final wherever it stands. */
function headings(layout: BracketLayout, laned: boolean) {
  const found = new Map<string, { node: BracketNode; top: number }>()
  for (const node of layout.nodes) {
    const key = `${node.lane}:${node.column}`
    const alone = node.lane === "final" || node.lane === "third"
    const start = layout.lanes.find((lane) => lane.key === node.lane)?.row ?? node.row
    const top = topOf(alone ? node : { ...node, row: start }, laned) - HEAD
    const known = found.get(key)
    if (!known) found.set(key, { node, top })
    else known.top = Math.min(known.top, top)
  }
  return [...found]
}

function Team({ team, active }: { team: MatchSide; active: boolean }) {
  return (
    <span
      className="tn-node-team"
      data-team={team.teamId ?? undefined}
      data-active={active || undefined}
      data-won={team.won || undefined}
      data-lost={team.lost || undefined}
      data-open={!team.known || undefined}
    >
      {team.known ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
      ) : (
        <span className="tn-node-blank" aria-hidden="true" />
      )}
      <span title={team.fullName}>{team.brief}</span>
      {team.score != null && <b>{team.score}</b>}
    </span>
  )
}

/**
 * A match of the bracket. Pointing at it shows the match at a glance beside it; on a phone a tap opens that in a
 * sheet (`onPeek`), where the way on to the match's page is.
 */
function Node({
  node,
  top,
  team,
  stop,
  onPeek,
}: {
  node: BracketNode
  top: number
  team: string | null
  /** Which match of the followed team's way this is, from 1. */
  stop?: number
  onPeek?: (entry: CompetitionMatch) => void
}) {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const { entry } = node
  const sides = matchSides(entry, languageTag)
  const peek = (event: MouseEvent) => {
    if (!onPeek || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    onPeek(entry)
  }
  const card = (
    <Link
      onClick={peek}
      className="tn-node"
      to={competitionMatchHref(entry.competition.id, entry.match.key)}
      style={{ left: left(node.column), top }}
      data-live={matchUnderway(entry, now) || undefined}
      data-weight={roundWeight(node.round) ?? undefined}
      data-on={(team != null && sides.some((side) => side.teamId === team)) || undefined}
    >
      <span className="tn-node-head">
        <MatchStatus entry={entry} />
        <span>BO{entry.match.bestOf}</span>
      </span>
      {sides.map((side) => (
        <Team key={side.side} team={side} active={team != null && side.teamId === team} />
      ))}
      {stop != null && (
        <span className="tn-node-stop" aria-hidden="true">
          {stop}
        </span>
      )}
    </Link>
  )
  if (onPeek) return card
  return (
    <HoverCard openDelay={280} closeDelay={120}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={14} collisionPadding={12} className="tn-peek-card">
        <MatchPeek entry={entry} />
      </HoverCardContent>
    </HoverCard>
  )
}

/** The way from a match to the one its winner plays next: a straight run, then a turn in the gap before it. */
function Connector({ link, laned }: { link: BracketLink; laned: boolean }) {
  // A connector leaves the middle of the teams' rows and arrives level with the row of its side.
  const from = topOf(link.from, laned) + TOP + (CARD - TOP) / 2
  const to = topOf(link.to, laned) + TOP + ((CARD - TOP) / 4) * (link.side === "a" ? 1 : 3)
  const top = Math.min(from, to)
  const height = Math.abs(to - from)
  const turn = GAP / 2
  return (
    <>
      {link.to.column - link.from.column > 1 && (
        <span
          className="tn-link-run"
          style={{
            top: from,
            left: `calc(${left(link.from.column)} + var(--bracket-card))`,
            width: `calc(${link.to.column - link.from.column - 1} * (var(--bracket-card) + ${GAP}px))`,
          }}
        />
      )}
      <svg
        className="tn-link"
        width={GAP}
        height={height + 2}
        style={{ top: top - 1, left: `calc(${left(link.to.column)} - ${GAP}px)` }}
        aria-hidden="true"
      >
        <path d={`M0 ${from - top + 1}H${turn}V${to - top + 1}H${GAP}`} />
      </svg>
    </>
  )
}

/** The first column with a match still to be decided; a bracket that is over starts at its first round. */
function currentColumn(layout: BracketLayout) {
  const open = layout.nodes.filter((node) => matchWinner(node.entry) == null)
  return open.length && open.length < layout.nodes.length ? Math.min(...open.map((node) => node.column)) : 0
}

/**
 * An elimination stage read from left to right, every match level with those that feed it and tied to them. Pointing
 * at a team lights its way through the bracket, and choosing its crest keeps it lit with the way in words below. On a
 * narrow screen it scrolls sideways and opens at the round played now.
 */
export function Bracket({ view, stage }: { view: CompetitionView; stage: CompetitionStage }) {
  const { text, languageTag } = useStreamLocale()
  const layout = useMemo(() => stageBracket(view, stage.code), [view, stage.code])
  const laned = layout.lanes.some((lane) => lane.key === "lower")
  const teams = useMemo(() => bracketTeams(layout), [layout])
  const [pointed, setPointed] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const team = pointed ?? chosen
  const stops = useMemo(() => (team ? teamJourney(layout, team) : []), [layout, team])
  const stopOf = new Map<BracketNode, number>(stops.map((stop, index) => [stop.node, index + 1]))
  const [peek, setPeek] = useState<CompetitionMatch | null>(null)
  const compact = usePageLayout() === "compact"
  const { plan, card } = useCardWidth(layout.columns, GAP)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = scroller.current
    const column = currentColumn(layout)
    const inner = row?.firstElementChild
    if (row && inner && column > 0) row.scrollLeft = (inner.scrollWidth / layout.columns) * column - 24
  }, [layout])
  const follow = (target: EventTarget | null) =>
    setPointed(target instanceof Element ? (target.closest("[data-team]")?.getAttribute("data-team") ?? null) : null)
  const height = Math.max(...layout.nodes.map((node) => topOf(node, laned) + CARD))
  const name = stageName(stage.name)
  return (
    <>
      <BracketTeams view={view} teams={teams} chosen={chosen} onChoose={setChosen} onPoint={setPointed} />
      <div
        ref={scroller}
        className="tn-bracket"
        tabIndex={0}
        role="group"
        aria-label={text(`Nhánh đấu ${name}`, `${name} bracket`)}
      >
        <div
          ref={plan}
          className="tn-bracket-plan"
          data-follow={team != null || undefined}
          style={{ "--bracket-columns": layout.columns, height } as CSSProperties}
          onPointerOver={(event) => event.pointerType === "mouse" && follow(event.target)}
          onPointerLeave={() => setPointed(null)}
        >
          {headings(layout, laned).map(([key, { node, top }]) => (
            <h3
              key={key}
              className="tn-bracket-title"
              data-weight={roundWeight(node.round) ?? undefined}
              style={{ left: left(node.column), top }}
            >
              {roundWeight(node.round) === "final" && <StreamIcon name="trophy" size={15} />}
              {bracketRoundName(node.round, languageTag)}
            </h3>
          ))}
          {layout.links.map((link) => (
            <Connector key={`${link.from.entry.match.key}:${link.to.entry.match.key}`} link={link} laned={laned} />
          ))}
          {team && (
            <JourneyTrail
              key={team}
              stops={stops}
              end={journeyEnd(layout, stops)}
              measures={{
                card,
                gap: GAP,
                height: CARD,
                head: TOP,
                top: (stop: JourneyStop) => topOf(stop.node, laned),
              }}
            />
          )}
          {layout.nodes.map((node) => (
            <Node
              key={node.entry.match.key}
              node={node}
              top={topOf(node, laned)}
              team={team}
              stop={stopOf.get(node)}
              onPeek={compact ? setPeek : undefined}
            />
          ))}
        </div>
      </div>
      {chosen && <JourneyStrip view={view} layout={layout} teamId={chosen} stops={teamJourney(layout, chosen)} />}
      {compact && (
        <PublicDrawer open={peek != null} onOpenChange={(open) => !open && setPeek(null)}>
          <PublicDrawerContent title={text("Xem nhanh trận đấu", "Match at a glance")}>
            {peek && <MatchPeek entry={peek} />}
          </PublicDrawerContent>
        </PublicDrawer>
      )}
    </>
  )
}
