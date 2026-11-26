import { useSearchParams } from "react-router"
import { gameOrder, type GameOrder } from "./finder-model"
import { withParam } from "./params"

/** The order of a list of games, which the address keeps; another one takes its place there. */
export function useGameOrder() {
  const [params, setParams] = useSearchParams()
  return {
    order: gameOrder(params.get("sort")),
    sortBy: (order: GameOrder) =>
      setParams((current) => withParam(current, "sort", order === "new" ? null : order), { replace: true }),
  }
}
