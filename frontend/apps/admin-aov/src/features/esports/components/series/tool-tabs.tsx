import { DESK_TOOLS, type DeskTool } from "../../model/desk"
import type { ToolMark } from "../../model/tool-state"

const TOOL_NAMES: Record<DeskTool, string> = {
  draft: "Cấm chọn",
  lineup: "Đội hình",
  moments: "Diễn biến",
  game: "Ván đấu",
}

/** The four parts of a game, one on screen at a time. Without a game on the desk there is nothing to choose. */
export function ToolTabs({
  open,
  marks,
  onOpen,
}: {
  /** The tool on screen; null while a panel takes its place. */
  open: DeskTool | null
  marks: Record<DeskTool, ToolMark> | null
  onOpen: (tool: DeskTool) => void
}) {
  return (
    <nav className="esp-tools type-body" aria-label="Phần của ván">
      {DESK_TOOLS.map((tool) => {
        const mark = marks?.[tool]
        const name = [TOOL_NAMES[tool], mark?.count, mark?.lacks].filter(Boolean).join(", ")
        return (
          <button
            key={tool}
            type="button"
            className="esp-tab"
            aria-pressed={open === tool}
            aria-label={name}
            title={mark?.lacks ? name : undefined}
            disabled={!marks}
            onClick={() => onOpen(tool)}
          >
            {TOOL_NAMES[tool]}
            {mark?.count && <span className="esp-tab-count type-meta esp-num">{mark.count}</span>}
            {mark?.lacks && <span className="esp-tab-mark" data-mark="lacks" aria-hidden />}
          </button>
        )
      })}
    </nav>
  )
}
