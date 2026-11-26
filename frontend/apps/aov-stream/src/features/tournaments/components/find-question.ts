import { useEffect, useMemo, useRef, type MouseEvent, type RefObject } from "react"
import { useSearchParams } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  asksSame,
  findGames,
  gameOrder,
  QUESTION_KEYS,
  readQuestion,
  settled,
  writeQuestion,
  type FoundGame,
  type GameOrder,
  type HeroRole,
  type Question,
} from "../../../lib/finder-model"
import { namesOf, type Names } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import type { StatsData } from "./stats-data"

/** Where the focus goes on after a question changed: the answer, or the next empty seat of a role. */
export type Spot = "answer" | `add-${HeroRole}`

/** The question of the address, the games that answer it, and the ways to ask another. */
export type Finder = {
  data: StatsData
  question: Question
  found: FoundGame[]
  order: GameOrder
  names: Names
  /** Asks another question, which the browser's back button takes back. `spot` takes the focus. */
  ask: (next: Question, spot?: Spot) => void
  /** The address of another question, for a link to it. */
  href: (next: Question) => string
  /** What a link to another question does when it is followed here: the focus goes to the answer. */
  follow: (event: MouseEvent) => void
  /** Moves the focus to a place of the finder. */
  land: (spot: Spot) => void
}

/** Moves the focus to a spot; a seat that is not there, because no hero would fit it, gives way to the answer. */
function landIn(root: RefObject<HTMLElement | null>, spot: Spot) {
  const at = (name: Spot) => root.current?.querySelector<HTMLElement>(`[data-spot="${name}"]`)
  const target = at(spot) ?? at("answer")
  target?.focus({ preventScroll: true })
}

/** The finder of the address; `root` is the box its spots stand in. */
export function useFinder(data: StatsData) {
  const { text } = useStreamLocale()
  const [params, setParams] = useSearchParams()
  const root = useRef<HTMLDivElement>(null)
  const waiting = useRef<Spot | null>(null)
  const question = useMemo(() => settled(readQuestion(data.whole, params)), [data.whole, params])
  const found = useMemo(() => findGames(data.feed.games, question), [data.feed.games, question])
  const order = gameOrder(params.get("sort"))
  // The focus moves once the page shows the new answer: what was pressed may be gone by then.
  useEffect(() => {
    const spot = waiting.current
    waiting.current = null
    if (spot) landIn(root, spot)
  }, [params])
  const finder: Finder = {
    data,
    question,
    found,
    order,
    names: namesOf(data.view, text),
    ask: (asked, spot) => {
      const next = settled(asked)
      // The question that is asked already makes no new entry of the history.
      if (asksSame(next, question)) return
      const target = new URLSearchParams(params)
      for (const key of QUESTION_KEYS) target.delete(key)
      for (const [key, value] of writeQuestion(next)) target.set(key, value)
      waiting.current = spot ?? null
      setParams(target)
    },
    href: (next) => statsHref(data.view.id, { question: settled(next), sort: order, scope: data.period?.key }),
    follow: ({ metaKey, ctrlKey, shiftKey }) => {
      if (!metaKey && !ctrlKey && !shiftKey) waiting.current = "answer"
    },
    land: (spot) => landIn(root, spot),
  }
  return { finder, root }
}
