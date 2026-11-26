import { useMemo, type ReactNode } from "react"
import { Link } from "react-router"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText, score } from "../../../lib/feed-words"
import { namesSide } from "../../../lib/finder-model"
import { hasScore, suggestions, type Suggestion } from "../../../lib/found-model"
import type { Finder } from "./find-question"
import { HeroPortrait } from "./hero-portrait"
import "./find-suggestions.css"

/** A choice that narrows the games found: whom it adds, how many games it leaves and what side A won of them. */
function Choice({ finder, item, name, mark }: { finder: Finder; item: Suggestion; name: string; mark: ReactNode }) {
  const { text, languageTag } = useStreamLocale()
  const games = gamesText(item.games, text, languageTag)
  const scored = hasScore(item.question)
  const said = scored
    ? text(
        `${name}, ${games}, thắng ${item.wins}, thua ${item.losses}`,
        `${name}, ${games}, won ${item.wins}, lost ${item.losses}`,
      )
    : `${name}, ${games}`
  return (
    <li>
      <Link className="tn-find-tip" to={finder.href(item.question)} onClick={finder.follow} aria-label={said}>
        {mark}
        <b>{name}</b>
        <span>{item.games.toLocaleString(languageTag)}</span>
        {scored && <small>{score(item)}</small>}
      </Link>
    </li>
  )
}

/**
 * What would narrow the games found in one press, with how many each leaves: a team of this side, a hero on its team, a
 * hero it met. A row with nothing to narrow by is not there.
 */
export function FindSuggestions({ finder }: { finder: Finder }) {
  const { text } = useStreamLocale()
  const { data, question, found, names } = finder
  const list = useMemo(() => suggestions(data.feed, question, found.length), [data.feed, question, found.length])
  const { teams } = data.view.content
  const rows: { key: string; label: string; items: ReactNode[] }[] = [
    {
      key: "team",
      label: text("Đội", "Team"),
      items: list.teams.map((item) => (
        <Choice
          key={item.teamId}
          finder={finder}
          item={item}
          name={names.team(item.teamId)}
          mark={
            <StreamImage
              src={teams[item.teamId]?.logoUrl}
              darkSrc={teams[item.teamId]?.logoDarkUrl}
              logo
              name={names.team(item.teamId)}
            />
          }
        />
      )),
    },
    {
      key: "pick",
      label:
        question.player && !question.pick.length
          ? text("Đã chơi", "Played")
          : namesSide(question)
            ? text("Cùng đội", "Same team")
            : text("Được chọn", "Picked"),
      items: list.mates.map((item) => (
        <Choice
          key={item.hero.key}
          finder={finder}
          item={item}
          name={item.hero.name}
          mark={<HeroPortrait hero={item.hero} />}
        />
      )),
    },
    {
      key: "vs",
      label: text("Đối thủ", "Opponent"),
      items: list.rivals.map((item) => (
        <Choice
          key={item.hero.key}
          finder={finder}
          item={item}
          name={item.hero.name}
          mark={<HeroPortrait hero={item.hero} />}
        />
      )),
    },
  ]
  const shown = rows.filter(({ items }) => items.length > 0)
  if (!shown.length) return null
  return (
    <div className="tn-find-tips" role="group" aria-label={text("Thu hẹp thêm", "Narrow further")}>
      {shown.map(({ key, label, items }) => (
        <div key={key} className="tn-find-tips-row">
          <span id={`find-tips-${key}`}>{label}</span>
          <ul aria-labelledby={`find-tips-${key}`}>{items}</ul>
        </div>
      ))}
    </div>
  )
}
