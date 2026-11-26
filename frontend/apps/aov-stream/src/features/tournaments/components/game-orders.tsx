import { useStreamLocale } from "../../../components/stream-locale"
import { GAME_ORDERS, ordersByLength, type FoundGame, type GameOrder } from "../../../lib/finder-model"
import { useGameOrder } from "../../../lib/use-game-order"
import { ChoiceWords } from "./choice-words"

/** The orders of a list of games, in Vietnamese and in English. */
const NAMES: Record<GameOrder, readonly [string, string]> = {
  new: ["Mới nhất", "Newest"],
  short: ["Ngắn nhất", "Shortest"],
  long: ["Dài nhất", "Longest"],
}

/** The order of a list of games; nothing to choose while the length of no two of them is known. */
export function GameOrders({ found }: { found: FoundGame[] }) {
  const { text } = useStreamLocale()
  const { order, sortBy } = useGameOrder()
  if (!ordersByLength(found)) return null
  return (
    <ChoiceWords
      label={text("Thứ tự các ván", "Order of the games")}
      value={order}
      choices={GAME_ORDERS.map((key) => ({ key, name: text(...NAMES[key]) }))}
      onChoose={sortBy}
    />
  )
}
