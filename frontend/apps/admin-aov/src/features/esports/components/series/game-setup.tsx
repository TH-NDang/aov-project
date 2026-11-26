import type { SeriesContent } from "@aov/community-contracts"
import { LoaderCircle, Plus, Zap } from "lucide-react"
import { Button } from "@aov/ui/components/button"

/** What the dock shows in the place of a game nobody recorded: what is known about it, and how it starts. */
export function GameSetup({
  number,
  empty,
  result,
  hasVideo,
  recording,
  missing,
  adding,
  onAdd,
  onQuick,
}: {
  /** The number on the desk; null when the match needs no further game. */
  number: number | null
  /** The match has no recorded game at all. */
  empty: boolean
  result: SeriesContent["result"]
  hasVideo: boolean
  recording: boolean
  /** Games the score says were played and nobody recorded. */
  missing: number
  adding: boolean
  onAdd: (number: number) => void
  onQuick: () => void
}) {
  const played = result ? result.scoreA + result.scoreB : 0
  return (
    <div className="esp-setup type-body">
      <p className="text-muted-foreground">{empty ? "Trận chưa ghi ván nào." : `Ván ${number} chưa ghi.`}</p>
      {recording && result && missing > 0 && (
        <p>
          Tỷ số {result.scoreA} – {result.scoreB} cho biết trận có {played} ván.
        </p>
      )}
      {recording && hasVideo && number !== null && <p>Tua tới màn cấm chọn của ván {number}.</p>}
      {recording && number === null && <p>Trận đã đủ số ván.</p>}
      {recording && (missing > 0 || (empty && !hasVideo)) && (
        <span className="flex flex-wrap gap-2">
          {empty && !hasVideo && number !== null && (
            <Button size="sm" variant="outline" disabled={adding} onClick={() => onAdd(number)}>
              {adding ? <LoaderCircle className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Thêm ván {number}
            </Button>
          )}
          {missing > 0 && (
            <Button size="sm" variant="outline" onClick={onQuick}>
              <Zap aria-hidden /> Ghi nhanh {missing} ván thiếu
            </Button>
          )}
        </span>
      )}
    </div>
  )
}
