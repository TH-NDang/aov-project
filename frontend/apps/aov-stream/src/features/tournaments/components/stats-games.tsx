import { useMemo } from "react"
import { asksAnything, asksSides, sortFound, writeQuestion } from "../../../lib/finder-model"
import { inMatchOrder } from "../../../lib/found-model"
import { FindAnswer } from "./find-answer"
import { FindBoard } from "./find-board"
import { FindExamples } from "./find-examples"
import { FindChips } from "./find-filters"
import { FindNothing } from "./find-nothing"
import { useFinder } from "./find-question"
import { FindSuggestions } from "./find-suggestions"
import { GameList } from "./game-list"
import { GameOrders } from "./game-orders"
import type { StatsData } from "./stats-data"
import "./stats-games.css"

/**
 * Games found by what was on the draft board. The question stands in the address, so it can be shared and taken back;
 * its answer is a sentence, the score of the side asked about, what would narrow it, and the games.
 */
export function StatsGames({ data }: { data: StatsData }) {
  const { finder, root } = useFinder(data)
  const { question, found, order } = finder
  // A list about neither side shows the teams as their match does, not the blue side first.
  const listed = useMemo(
    () => sortFound(asksSides(question) ? found : found.map(inMatchOrder), order),
    [question, found, order],
  )
  const asked = asksAnything(question)
  return (
    <div ref={root} className="tn-find">
      <FindBoard finder={finder} />
      <div className="tn-find-head">
        <FindAnswer finder={finder} />
        <GameOrders found={found} />
      </div>
      {!found.length ? (
        <FindNothing finder={finder} />
      ) : (
        <>
          <FindChips finder={finder} />
          {asked ? <FindSuggestions finder={finder} /> : <FindExamples finder={finder} />}
          <GameList
            view={data.view}
            found={listed}
            asked={question}
            name={[data.period?.key, order, ...writeQuestion(question).flat()].join("|")}
          />
        </>
      )}
    </div>
  )
}
