import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { PublicDrawer, PublicDrawerContent } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { bracketTeams, journeyEnd, teamJourney, type JourneyStop } from "../../../lib/bracket-journey"
import {
  bracketRoundName,
  roundWeight,
  type BracketLayout,
  type BracketLink,
  type BracketNode,
} from "../../../lib/bracket-model"
import { stageDrawing } from "../../../lib/bracket-rounds"
import { matchWinner } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"
import type { CompetitionMatch } from "../../../lib/match-model"
import { placesBefore, type TablePlace } from "../../../lib/place-zones"
import { useEntryState } from "../../../lib/use-entry-state"
import { JourneyStrip, JourneyTrail, useCardWidth } from "./bracket-journey"
import { BracketMatch } from "./bracket-node"
import { MatchPeek } from "./match-peek"
import { roundAnchor, stageAnchor } from "./standings-anchors"
import { TeamFollow } from "./team-follow"
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
  return HEAD + node.row * ROW + lane + (node.lane === "place" ? HEAD : 0)
}

const left = (column: number) => `calc(${column} * (var(--bracket-card) + ${GAP}px))`

/** One heading per round: over the first card of its column, or over the final wherever it stands. */
function headings(layout: BracketLayout, laned: boolean) {
  const found = new Map<string, { node: BracketNode; top: number }>()
  for (const node of layout.nodes) {
    const key = `${node.lane}:${node.column}`
    const alone = node.lane === "final" || node.lane === "place"
    const start = layout.lanes.find((lane) => lane.key === node.lane)?.row ?? node.row
    const top = topOf(alone ? node : { ...node, row: start }, laned) - HEAD
    const known = found.get(key)
    if (!known) found.set(key, { node, top })
    else known.top = Math.min(known.top, top)
  }
  return [...found]
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

/** For each match the teams that play their first one in it, with the place they brought from the table before. */
function firstPlaces(layout: BracketLayout, teams: string[], places: Map<string, TablePlace>) {
  const first = new Map<BracketNode, Map<string, TablePlace>>()
  for (const team of teams) {
    const place = places.get(team)
    const node = place && teamJourney(layout, team)[0]?.node
    if (node) first.set(node, new Map([...(first.get(node) ?? []), [team, place]]))
  }
  return first
}

/**
 * A stage without a table read from left to right: every match level with those that feed it and tied to them, or one
 * round beside the other where none does. Pointing at a team lights its way through them, and following it keeps it lit
 * with the way in words below. On a narrow screen it scrolls sideways and opens at the round played now.
 */
export function Bracket({
  view,
  stage,
  followed,
  hinted = null,
}: {
  view: CompetitionView
  stage: CompetitionStage
  /** The team the page follows; left out, the bracket offers its own teams and keeps the one chosen. */
  followed?: string | null
  /** The team the page points at. */
  hinted?: string | null
}) {
  const { text, languageTag } = useStreamLocale()
  const layout = useMemo(() => stageDrawing(view, stage), [view, stage])
  const laned = layout.lanes.some((lane) => lane.key === "lower")
  const teams = useMemo(() => bracketTeams(layout), [layout])
  const first = useMemo(() => firstPlaces(layout, teams, placesBefore(view, stage.code)), [layout, teams, view, stage])
  const [pointed, setPointed] = useState<string | null>(null)
  const [kept, setKept] = useEntryState<string | null>(`bracket team:${stage.code}`, null)
  // The page may follow a team that does not play here.
  const known = (id: string | null) => (id && teams.includes(id) ? id : null)
  const chosen = followed === undefined ? kept : known(followed)
  const team = pointed ?? known(hinted) ?? chosen
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
      {followed === undefined && teams.length > 1 && (
        <div className="tn-bracket-teams">
          <TeamFollow view={view} teams={teams} followed={chosen} onFollow={setKept} onPoint={setPointed} />
        </div>
      )}
      <div
        ref={scroller}
        id={stageAnchor(stage.code)}
        className="tn-bracket"
        tabIndex={0}
        role="group"
        aria-label={layout.links.length ? text(`Nhánh đấu ${name}`, `${name} bracket`) : name}
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
              id={roundAnchor(stage.code, node.round)}
              tabIndex={-1}
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
            <BracketMatch
              key={node.entry.match.key}
              node={node}
              place={{ left: left(node.column), top: topOf(node, laned) }}
              team={team}
              stop={stopOf.get(node)}
              anchor={roundAnchor(stage.code, node.round)}
              places={first.get(node)}
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
