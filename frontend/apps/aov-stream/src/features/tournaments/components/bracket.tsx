import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { MatchStatus } from "../../../components/match-card"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  bracketRoundName,
  stageBracket,
  type BracketLayout,
  type BracketLink,
  type BracketNode,
} from "../../../lib/bracket-model"
import { matchUnderway, matchWinner } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"
import { competitionMatchHref } from "../../../lib/match-model"
import { matchSides, type MatchSide } from "../../../lib/match-schedule"
import { useNow } from "../../../lib/use-now"
import "./bracket.css"

/** The measures of the drawing in pixels; the width of a card follows the room there is, so it lives in the sheet. */
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

function Node({ node, top, team }: { node: BracketNode; top: number; team: string | null }) {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const { entry } = node
  const sides = matchSides(entry, languageTag)
  return (
    <Link
      className="tn-node"
      to={competitionMatchHref(entry.competition.id, entry.match.key)}
      style={{ left: left(node.column), top }}
      data-live={matchUnderway(entry, now) || undefined}
      data-final={node.lane === "final" || undefined}
      data-on={(team != null && sides.some((side) => side.teamId === team)) || undefined}
    >
      <span className="tn-node-head">
        <MatchStatus entry={entry} />
        <span>BO{entry.match.bestOf}</span>
      </span>
      {sides.map((side) => (
        <Team key={side.side} team={side} active={team != null && side.teamId === team} />
      ))}
    </Link>
  )
}

/** The way from a match to the one its winner plays next: a straight run, then a turn in the gap before it. */
function Connector({ link, laned, team }: { link: BracketLink; laned: boolean; team: string | null }) {
  // A connector leaves the middle of the teams' rows and arrives level with the row of its side.
  const from = topOf(link.from, laned) + 24 + (CARD - 24) / 2
  const to = topOf(link.to, laned) + 24 + ((CARD - 24) / 4) * (link.side === "a" ? 1 : 3)
  const top = Math.min(from, to)
  const height = Math.abs(to - from)
  const winner = matchWinner(link.from.entry)
  const { match, result } = link.from.entry
  const winnerId = winner && ((winner === "a" ? result?.teamAId : result?.teamBId) || match[winner].teamId)
  const on = (team != null && winnerId === team) || undefined
  const turn = GAP / 2
  return (
    <>
      {link.to.column - link.from.column > 1 && (
        <span
          className="tn-link-run"
          data-on={on}
          style={{
            top: from,
            left: `calc(${left(link.from.column)} + var(--bracket-card))`,
            width: `calc(${link.to.column - link.from.column - 1} * (var(--bracket-card) + ${GAP}px))`,
          }}
        />
      )}
      <svg
        className="tn-link"
        data-on={on}
        data-done={winner != null || undefined}
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
 * at a team follows its way through the bracket. On a narrow screen it scrolls sideways and opens at the round played
 * now.
 */
export function Bracket({ view, stage }: { view: CompetitionView; stage: CompetitionStage }) {
  const { text, languageTag } = useStreamLocale()
  const layout = useMemo(() => stageBracket(view, stage.code), [view, stage.code])
  const laned = layout.lanes.some((lane) => lane.key === "lower")
  const [team, setTeam] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = scroller.current
    const column = currentColumn(layout)
    const inner = row?.firstElementChild
    if (row && inner && column > 0) row.scrollLeft = (inner.scrollWidth / layout.columns) * column - 24
  }, [layout])
  const follow = (target: EventTarget | null) =>
    setTeam(target instanceof Element ? (target.closest("[data-team]")?.getAttribute("data-team") ?? null) : null)
  const height = Math.max(...layout.nodes.map((node) => topOf(node, laned) + CARD))
  const name = stageName(stage.name)
  return (
    <div
      ref={scroller}
      className="tn-bracket"
      tabIndex={0}
      role="group"
      aria-label={text(`Nhánh đấu ${name}`, `${name} bracket`)}
    >
      <div
        className="tn-bracket-plan"
        data-follow={team != null || undefined}
        style={{ "--bracket-columns": layout.columns, height } as CSSProperties}
        onPointerOver={(event) => follow(event.target)}
        onPointerLeave={() => setTeam(null)}
      >
        {headings(layout, laned).map(([key, { node, top }]) => (
          <h3
            key={key}
            className="tn-bracket-title"
            data-final={node.lane === "final" || undefined}
            style={{ left: left(node.column), top }}
          >
            {bracketRoundName(node.round, languageTag)}
          </h3>
        ))}
        {layout.links.map((link) => (
          <Connector
            key={`${link.from.entry.match.key}:${link.to.entry.match.key}`}
            link={link}
            laned={laned}
            team={team}
          />
        ))}
        {layout.nodes.map((node) => (
          <Node key={node.entry.match.key} node={node} top={topOf(node, laned)} team={team} />
        ))}
      </div>
    </div>
  )
}
