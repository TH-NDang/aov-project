import { useEffect, useState } from "react"
import type { GameContent } from "@aov/community-contracts"
import { ClipboardCopy, Undo2, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { LANE_LABELS } from "@/lib/lanes"
import {
  applyCarry,
  lineupPlan,
  loadoutPlan,
  revertCarry,
  seatChanges,
  type CarryChange,
  type CarryPart,
  type CarryPlan,
} from "../../model/carry-over"
import type { GameView } from "../../model/game-view"
import { fillFromRoster, type RosterOption } from "../../model/line-up"
import { TeamLogo } from "../primitives"

/** How long a fill can be taken back with one click. */
const UNDO_MS = 8000

const PART_LABELS: Record<CarryPart, string> = {
  playerId: "Tuyển thủ",
  spell: "Phụ trợ",
  enchantments: "Phù hiệu",
  arcana: "Bảng ngọc",
}

type ContentChange = (content: GameContent) => GameContent

/**
 * Fills both line-ups in one click, from the previous game of the match or from the registered rosters, and copies
 * the spells, emblems and arcana of players who play again. Only empty places are filled; when none is left, the same
 * button asks, with old and new values, before it replaces what differs. Every fill can be undone.
 */
export function CarryOverBar({
  content,
  previous,
  view,
  roster,
  loadouts = false,
  onChange,
}: {
  content: GameContent
  /** The game line-ups are taken from; absent in the first game of a match. */
  previous: GameContent | null
  view: GameView
  roster: (teamId: string) => RosterOption[]
  /** Also offers the spells, emblems and arcana of the previous game. */
  loadouts?: boolean
  onChange: (change: ContentChange) => void
}) {
  const [done, setDone] = useState<{ id: number; text: string; changes: CarryChange[] } | null>(null)
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(null), UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [done])

  const rosterFills = seatChanges(content, fillFromRoster(content, roster))
  const lineup = previous ? lineupPlan(content, previous) : null
  const copies = previous && loadouts ? loadoutPlan(content, previous) : null
  const waiting = (plan: CarryPlan | null) => !!plan && plan.fills.length + plan.conflicts.length > 0

  const nameOf = (change: CarryChange, value: CarryChange["before"]) => {
    if (change.part !== "playerId") return value ? "bản đã ghi" : "chưa ghi"
    const seat = Object.values(view.sides)
      .flatMap((side) => side.seats)
      .find((entry) => entry.playerId === value)
    return (
      roster(change.teamId).find((member) => member.id === value)?.name ??
      seat?.playerName ??
      "Tuyển thủ ngoài đội hình"
    )
  }
  const apply = (changes: CarryChange[], text: string) => {
    onChange((current) => applyCarry(current, changes))
    setDone({ id: Date.now(), text, changes })
  }
  const overwrite = async (changes: CarryChange[], title: string, text: string) => {
    const confirmed = await confirmAction({
      title,
      description: `${changes.length} chỗ đã ghi sẽ được thay.`,
      details: (
        <ul className="max-h-60 space-y-1.5 overflow-y-auto">
          {changes.map((change) => {
            const side = Object.values(view.sides).find((entry) => entry.team.id === change.teamId)
            return (
              <li key={`${change.teamId}-${change.lane}-${change.part}`} className="flex items-center gap-2">
                <TeamLogo team={side?.team} size={18} />
                <span className="text-muted-foreground">
                  {LANE_LABELS[change.lane].name} · {PART_LABELS[change.part]}:
                </span>
                {change.part === "playerId"
                  ? `${nameOf(change, change.before)} → ${nameOf(change, change.after)}`
                  : `bản đã ghi → bản của ván ${previous?.number}`}
              </li>
            )
          })}
        </ul>
      ),
      confirmLabel: "Thay bằng ván trước",
    })
    if (confirmed) apply(changes, text)
  }
  const take = (plan: CarryPlan, what: string) => {
    const kept = plan.conflicts.length ? ` · ${plan.conflicts.length} chỗ khác giữ nguyên` : ""
    if (plan.fills.length) apply(plan.fills, `Đã điền ${plan.fills.length} ${what} từ ván ${previous!.number}${kept}`)
    else
      void overwrite(
        plan.conflicts,
        `Thay ${what} bằng ván ${previous!.number}?`,
        `Đã thay ${plan.conflicts.length} ${what} bằng ván ${previous!.number}`,
      )
  }

  if (!done && !rosterFills.length && !waiting(lineup) && !waiting(copies)) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Điền nhanh hai đội">
      {waiting(lineup) && (
        <Button size="sm" variant="outline" onClick={() => take(lineup!, "tuyển thủ")}>
          <Users aria-hidden /> Đội hình như ván {previous!.number}
        </Button>
      )}
      {rosterFills.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          title="Điền các ghế trống bằng người đăng ký đúng vị trí, ưu tiên đội hình chính"
          onClick={() => apply(rosterFills, `Đã điền ${rosterFills.length} tuyển thủ theo đội hình đăng ký`)}
        >
          <Users aria-hidden /> Điền tuyển thủ theo đội hình
        </Button>
      )}
      {waiting(copies) && (
        <Button
          size="sm"
          variant="outline"
          title="Chép cho tuyển thủ chơi lại; không chép mốc video"
          onClick={() => take(copies!, "phụ trợ, phù hiệu, ngọc")}
        >
          <ClipboardCopy aria-hidden /> Phụ trợ, phù hiệu, ngọc như ván {previous!.number}
        </Button>
      )}
      {done && (
        <span key={done.id} role="status" className="type-meta flex items-center gap-2">
          {done.text}
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              onChange((current) => revertCarry(current, done.changes))
              setDone(null)
            }}
          >
            <Undo2 aria-hidden /> Hoàn tác
          </Button>
        </span>
      )}
    </div>
  )
}
