import type { GameContent } from "@aov/community-contracts"
import { ClipboardCopy, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  carryChange,
  lineupPlan,
  loadoutPlan,
  seatChanges,
  type CarryChange,
  type CarryPlan,
} from "../../model/carry-over"
import type { RecordedChange } from "../../model/desk"
import { fillFromRoster, type RosterOption } from "../../model/line-up"

/**
 * Fills both line-ups in one click, from the previous game of the match or from the registered rosters, and copies the
 * spells, emblems and arcana of players who play again. It only fills what is empty and stands there only while there is
 * something to fill; what differs is replaced from the menu of its team.
 */
export function CarryOverBar({
  content,
  previous,
  roster,
  onRecord,
}: {
  content: GameContent
  /** The game line-ups are taken from; absent in the first game of a match. */
  previous: GameContent | null
  roster: (teamId: string) => RosterOption[]
  onRecord: (change: RecordedChange) => void
}) {
  const registered = seatChanges(content, fillFromRoster(content, roster))
  const lineup = previous && lineupPlan(content, previous)
  const loadouts = previous && loadoutPlan(content, previous)
  const fill = (changes: CarryChange[], text: string) => onRecord(carryChange(changes, text))
  const take = ({ fills, conflicts }: CarryPlan, what: string) => {
    const kept = conflicts.length ? `, ${conflicts.length} chỗ khác giữ nguyên` : ""
    fill(fills, `Đã điền ${fills.length} ${what} từ ván ${previous!.number}${kept}`)
  }

  if (!registered.length && !lineup?.fills.length && !loadouts?.fills.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Điền nhanh hai đội">
      {lineup && lineup.fills.length > 0 && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          title="Điền các ghế trống bằng người chơi ván trước"
          onClick={() => take(lineup, "tuyển thủ")}
        >
          <Users aria-hidden /> Đội hình như ván {previous!.number}
        </Button>
      )}
      {registered.length > 0 && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          title="Điền các ghế trống bằng người đăng ký đúng vị trí, ưu tiên đội hình chính"
          onClick={() => fill(registered, `Đã điền ${registered.length} tuyển thủ theo đội hình đăng ký`)}
        >
          <Users aria-hidden /> Điền theo đội hình đăng ký
        </Button>
      )}
      {loadouts && loadouts.fills.length > 0 && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          title="Chép vào chỗ còn trống của tuyển thủ chơi lại; không chép mốc video"
          onClick={() => take(loadouts, "phụ trợ, phù hiệu, ngọc")}
        >
          <ClipboardCopy aria-hidden /> Phụ trợ, phù hiệu, ngọc như ván {previous!.number}
        </Button>
      )}
    </div>
  )
}
