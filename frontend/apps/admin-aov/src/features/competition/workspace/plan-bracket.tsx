import type { PlannedMatch } from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import { cn } from "@aov/ui/lib/utils"
import { TeamLogo } from "@/features/esports/components/primitives"
import {
  BRACKET,
  hasScore,
  isThirdPlace,
  layoutBracket,
  matchLabel,
  slotText,
  type BracketLane,
  type BracketNode,
} from "./model"
import type { Workspace } from "./parts"

const LANE_NAMES = { upper: "Nhánh thắng", lower: "Nhánh thua", final: "Chung kết" } as const

/** An elimination stage drawn from the plan's own winner and loser slots, so unresolved sides stay readable. */
export function PlanBracket({
  ws,
  matches,
  selected,
  onSelect,
}: {
  ws: Workspace
  matches: PlannedMatch[]
  selected: string | null
  onSelect: (key: string) => void
}) {
  const layout = layoutBracket(matches)
  const { nodeWidth, nodeHeight, columnGap } = BRACKET
  // A lone match for third place is no lower bracket.
  const lower = layout.nodes.filter((node) => node.lane === "lower")
  const onlyThirdPlace = lower.length === 1 && isThirdPlace(lower[0]!.match, matches)
  const laneName = (lane: BracketLane) =>
    onlyThirdPlace ? (lane === "lower" ? "Tranh hạng ba" : "") : LANE_NAMES[lane]
  const byKey = new Map(layout.nodes.map((node) => [node.match.key, node]))
  const lines = layout.nodes.flatMap((node) =>
    node.feeds.flatMap((key) => {
      const from = byKey.get(key)
      if (!from) return []
      const startX = from.x + nodeWidth
      const startY = from.y + nodeHeight / 2
      const endY = node.y + nodeHeight / 2
      const turn = startX + columnGap / 2
      return [`M ${startX} ${startY} H ${turn} V ${endY} H ${node.x}`]
    }),
  )
  return (
    <div className="space-y-3">
      {!layout.linked && (
        <p className="type-meta">
          Các trận của giai đoạn này chưa nối suất thắng/thua với nhau, nên sơ đồ chỉ xếp trận theo vòng.
        </p>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            className="pointer-events-none absolute inset-0 text-[var(--input)]"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {lines.map((path) => (
              <path key={path} d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
            ))}
          </svg>
          {layout.lanes.map((lane) => (
            <p key={lane.lane} className="type-label absolute left-0 text-muted-foreground" style={{ top: lane.y }}>
              {laneName(lane.lane)}
            </p>
          ))}
          {layout.nodes.map((node) => (
            <BracketCard
              key={node.match.key}
              ws={ws}
              node={node}
              selected={selected === node.match.key}
              onSelect={() => onSelect(node.match.key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BracketCard({
  ws,
  node,
  selected,
  onSelect,
}: {
  ws: Workspace
  node: BracketNode
  selected: boolean
  onSelect: () => void
}) {
  const { match } = node
  const resolved = ws.resolved.get(match.key)
  const scored = hasScore(resolved)
  const side = (which: "a" | "b") => {
    const id = which === "a" ? resolved?.teamAId : resolved?.teamBId
    const own = which === "a" ? resolved?.scoreA : resolved?.scoreB
    const other = which === "a" ? resolved?.scoreB : resolved?.scoreA
    const won = scored && own! > other!
    return (
      <span className={cn("flex h-8 items-center gap-2 px-2.5", scored && !won && "text-muted-foreground")}>
        {id ? <TeamLogo team={ws.team(id)} size={20} /> : <span className="size-5 shrink-0 rounded bg-muted" />}
        <span
          className={cn("type-body min-w-0 flex-1 truncate", won && "font-semibold", !id && "text-muted-foreground")}
        >
          {id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)}
        </span>
        <span className={cn("type-body tabular-nums", won && "font-bold text-primary")}>{own ?? "–"}</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "absolute overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected && "border-primary",
        !match.seriesId && "border-dashed",
      )}
      style={{ left: node.x, top: node.y, width: BRACKET.nodeWidth, height: BRACKET.nodeHeight }}
    >
      <span className="type-meta flex h-7 items-center justify-between gap-2 border-b px-2.5">
        <span className={cn("truncate", selected && "text-primary")}>{matchLabel(match)}</span>
        <LocalTime
          className="shrink-0"
          value={match.scheduledAt}
          sourceTimeZone={ws.plan.timezone}
          format={{ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }}
          fallback="Chưa có lịch"
        />
      </span>
      {side("a")}
      <span className="block border-t" />
      {side("b")}
    </button>
  )
}
