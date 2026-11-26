import type { ReactNode } from "react"
import { Link } from "react-router"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import type { FoundGame } from "../../../lib/finder-model"
import { GameOrders } from "./game-orders"
import "./game-bar.css"

/**
 * Over a list of games: a switch between parts of it (`children`), their order, and the way to the finder, where more
 * can be asked of them.
 */
export function GameBar({ found, finder, children }: { found: FoundGame[]; finder: string; children?: ReactNode }) {
  const { text } = useStreamLocale()
  return (
    <div className="tn-game-bar">
      {children}
      <GameOrders found={found} />
      <Link className="tn-game-bar-more" to={finder}>
        <StreamIcon name="filter" size={16} />
        {text("Lọc thêm", "Filter more")}
      </Link>
    </div>
  )
}
