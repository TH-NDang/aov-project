import type { ObjectiveKind, Side } from "@aov/community-contracts"
import { Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { GameView } from "../../model/game-view"
import { OBJECTIVE_NAMES, PAD_OBJECTIVES } from "../../model/quick-moment"
import { ObjectiveIcon } from "./objective-icon"
import "./moments.css"

export type ObjectiveCounts = Record<Side, Partial<Record<ObjectiveKind, number>>>

/** The key of each objective, in the order of the pad: blue under the left hand, red under the right. */
const KEYS: Record<Side, readonly string[]> = { BLUE: ["1", "2", "3"], RED: ["7", "8", "9"] }

/**
 * The objectives of both teams with how many each has at the playhead. Recording, every count is a key that records one
 * more there; viewing, the same figures stand as a table with nothing to press.
 */
export function ObjectivePad({
  game,
  counts,
  refusal = null,
  keycaps = false,
  onRecord,
  onOther,
}: {
  game: GameView
  counts: ObjectiveCounts
  /** Why nothing can be recorded where the video is; a press is still passed on, so the caller can say it. */
  refusal?: string | null
  keycaps?: boolean
  /** Absent while viewing. */
  onRecord?: (side: Side, objective: ObjectiveKind) => void
  onOther?: () => void
}) {
  const head = (
    <div className="esp-pad-head">
      <span>{game.sides.BLUE.team.shortName}</span>
      {onOther ? (
        <Button type="button" size="xs" variant="ghost" aria-keyshortcuts="E" onClick={onOther}>
          <Plus aria-hidden /> Diễn biến khác
        </Button>
      ) : (
        <span />
      )}
      <span>{game.sides.RED.team.shortName}</span>
    </div>
  )
  if (!onRecord)
    return (
      <div className="esp-pad" data-viewing>
        {head}
        <table className="esp-pad-table" aria-label="Mục tiêu của hai đội">
          <tbody>
            {PAD_OBJECTIVES.map((objective) => (
              <tr key={objective} data-objective={objective}>
                <td data-side="BLUE">{counts.BLUE[objective] ?? 0}</td>
                <th scope="row">
                  <span className="esp-pad-name">
                    <ObjectiveIcon objective={objective} size={20} /> {OBJECTIVE_NAMES[objective]}
                  </span>
                </th>
                <td data-side="RED">{counts.RED[objective] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  const key = (side: Side, objective: ObjectiveKind, index: number) => {
    const count = counts[side][objective] ?? 0
    const cap = KEYS[side][index]!
    return (
      <button
        type="button"
        className="esp-pad-key"
        data-side={side}
        data-objective={objective}
        aria-label={`Ghi ${OBJECTIVE_NAMES[objective]} của ${game.sides[side].team.shortName}, đang có ${count}`}
        aria-keyshortcuts={cap}
        aria-disabled={refusal ? true : undefined}
        title={refusal ?? undefined}
        onClick={() => onRecord(side, objective)}
      >
        {keycaps && <kbd className="esp-pad-cap">{cap}</kbd>}
        <b>{count}</b>
      </button>
    )
  }
  return (
    <div className="esp-pad" role="group" aria-label="Ghi mục tiêu">
      {head}
      {PAD_OBJECTIVES.map((objective, index) => (
        <div key={objective} className="esp-pad-row">
          {key("BLUE", objective, index)}
          <span className="esp-pad-name">
            <ObjectiveIcon objective={objective} size={22} /> {OBJECTIVE_NAMES[objective]}
          </span>
          {key("RED", objective, index)}
        </div>
      ))}
    </div>
  )
}
