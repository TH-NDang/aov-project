import type { CompetitionView } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useStreamLocale } from "../../../components/stream-locale"
import type { FoundGame, Question } from "../../../lib/finder-model"
import { useKeptRows } from "../../../lib/use-kept-rows"
import { GameLine } from "./game-line"

/** Games listed before the reader scrolls for more. */
const GAMES = 20

/**
 * Games of a competition, one a line, more of them as the reader scrolls. `asked` are the heroes that stand out of their
 * lines; `name` tells one list of a page from another, so that a new list starts from its top.
 */
export function GameList({
  view,
  found,
  asked,
  name,
}: {
  view: CompetitionView
  found: FoundGame[]
  asked?: Partial<Question>
  name: string
}) {
  const { text } = useStreamLocale()
  const { rows, loader } = useKeptRows(found, name, GAMES)
  return (
    <>
      <ul className="tn-lines">
        {rows.map((item, index) => (
          <li key={item.game.id}>
            <GameLine
              view={view}
              found={item}
              asked={asked}
              follows={rows[index - 1]?.game.seriesId === item.game.seriesId}
            />
          </li>
        ))}
      </ul>
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm ván", "Loading more games")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </>
  )
}
