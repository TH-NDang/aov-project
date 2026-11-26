import { useMemo } from "react"
import { Link } from "react-router"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import type { Question } from "../../../lib/finder-model"
import { examples } from "../../../lib/found-model"
import { questionWords } from "../../../lib/question-words"
import type { Finder } from "./find-question"
import { HeroPortrait } from "./hero-portrait"
import "./find-examples.css"

/** Whom a question is about, in pictures; a question without anyone wears a clock. */
function Pictures({ finder, question }: { finder: Finder; question: Question }) {
  const { teams } = finder.data.view.content
  const { team, pick, vs, banA } = question
  const heroes = [...pick, ...vs, ...banA]
  const mark = team ? teams[team] : undefined
  if (!heroes.length && !mark) return <StreamIcon name="clock" size={20} />
  return (
    <span className="tn-find-example-faces" aria-hidden="true">
      {team && <StreamImage src={mark?.logoUrl} darkSrc={mark?.logoDarkUrl} logo name={finder.names.team(team)} />}
      {heroes.map((hero) => (
        <HeroPortrait key={hero.key} hero={hero} banned={banA.includes(hero)} />
      ))}
    </span>
  )
}

/** Questions worth asking of this competition, for a reader who has asked nothing yet. */
export function FindExamples({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const { data, names } = finder
  const list = useMemo(() => examples(data.feed.games), [data.feed.games])
  if (!list.length) return null
  return (
    <ul className="tn-find-examples" aria-label={text("Ví dụ", "Examples")}>
      {list.map(({ question, games }) => {
        const words = questionWords(question, names, text, languageTag)
        return (
          <li key={words}>
            <Link to={finder.href(question)} onClick={finder.follow}>
              <Pictures finder={finder} question={question} />
              <span>
                <b>{words}</b>
                <small>{gamesText(games, text, languageTag)}</small>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
