import { TriangleAlert, VideoOff } from "lucide-react"
import type { GameMark, GameTab } from "../../model/game-tabs"
import { TeamLogo } from "../primitives"

function Mark({ mark }: { mark: GameMark }) {
  if (mark === "attention") return <TriangleAlert size={10} className="esp-tab-icon" data-mark={mark} aria-hidden />
  if (mark === "unplaced") return <VideoOff size={12} className="esp-tab-icon" data-mark={mark} aria-hidden />
  return <span className="esp-tab-mark" data-mark={mark} aria-hidden />
}

/**
 * The games of the match in one row: the number, who won it and one mark for what it still asks for. While recording,
 * the numbers nobody recorded stand after them.
 */
export function GameTabs({
  tabs,
  missing,
  chosen,
  onGame,
  onMissing,
}: {
  tabs: readonly GameTab[]
  /** Numbers a new game can take. */
  missing: readonly number[]
  /** Id of the game on the desk, or the number that is. */
  chosen: string | number | null
  onGame: (gameId: string) => void
  onMissing: (number: number) => void
}) {
  return (
    <nav className="esp-games type-body" aria-label="Các ván">
      <span className="esp-games-label type-meta" aria-hidden>
        Ván
      </span>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="esp-tab esp-num"
          aria-current={tab.id === chosen}
          aria-label={tab.name}
          title={tab.name}
          onClick={() => onGame(tab.id)}
        >
          {tab.number}
          {tab.winner && <TeamLogo team={tab.winner} size={18} />}
          {tab.mark && <Mark mark={tab.mark} />}
        </button>
      ))}
      {missing.map((number) => (
        <button
          key={number}
          type="button"
          className="esp-tab esp-num"
          data-missing
          aria-current={number === chosen}
          aria-label={`Ván ${number}, chưa ghi`}
          title={`Ván ${number}, chưa ghi`}
          onClick={() => onMissing(number)}
        >
          +{number}
        </button>
      ))}
    </nav>
  )
}
