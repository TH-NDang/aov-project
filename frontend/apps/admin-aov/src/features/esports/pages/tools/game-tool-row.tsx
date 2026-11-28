import type { ReactNode } from "react"
import "./game-tool.css"

/** One row of the game tool: a name, what is recorded, what can be done, and what it opens under it. */
export function Row({
  label,
  value,
  acts,
  under,
}: {
  label: string
  value: ReactNode
  acts?: ReactNode
  under?: ReactNode
}) {
  return (
    <div className="esp-gt-row" role="group" aria-label={label}>
      <span>{label}</span>
      <span className="esp-gt-value">{value}</span>
      <span className="esp-gt-acts">{acts}</span>
      {under && <div className="esp-gt-under">{under}</div>}
    </div>
  )
}
