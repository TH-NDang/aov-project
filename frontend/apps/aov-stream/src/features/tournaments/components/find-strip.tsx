import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { questionWords } from "../../../lib/question-words"
import type { Finder } from "./find-question"
import { HeroPortrait } from "./hero-portrait"
import "./find-strip.css"

/** A question in one line of faces and crests, which unfolds into the board it was asked on. */
export function FindStrip({ finder, onEdit }: { finder: Finder; onEdit: () => void }) {
  const { text, languageTag } = useStreamLocale()
  const { question, names, data } = finder
  const { team, opp, pick, vs, ban, banA, banB } = question
  const { teams } = data.view.content
  const crest = (id: string | null) =>
    id && <StreamImage key={id} src={teams[id]?.logoUrl} darkSrc={teams[id]?.logoDarkUrl} logo name={names.team(id)} />
  const faces = (heroes: typeof pick, banned = false) =>
    heroes.map((hero) => <HeroPortrait key={hero.key} hero={hero} banned={banned} />)
  const own = !!team || pick.length > 0
  const met = !!opp || vs.length > 0
  const bans = [...banA, ...ban, ...banB]
  return (
    <div className="tn-find-strip">
      <span aria-hidden="true">
        {!own && !met && !bans.length && <b>{questionWords(question, names, text, languageTag)}</b>}
        {crest(team)}
        {faces(pick)}
        {met && <small>{text("gặp", "against")}</small>}
        {crest(opp)}
        {faces(vs)}
        {bans.length > 0 && <small>{text("cấm", "banned")}</small>}
        {faces(bans, true)}
      </span>
      <button type="button" onClick={onEdit} aria-label={text("Sửa điều kiện tìm ván", "Change what to find")}>
        {text("Sửa", "Edit")}
      </button>
    </div>
  )
}
