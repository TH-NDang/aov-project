import { useRef } from "react"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { choices } from "../../../lib/finder-model"
import { ChoiceMenu } from "./choice-menu"
import type { Finder } from "./find-question"
import "./find-team.css"

/** The words for the two sides of a question. */
export const SIDE_NAMES: Record<"a" | "b", readonly [string, string]> = {
  a: ["Đội này", "This side"],
  b: ["Đối thủ", "Opponent"],
}

/** The team of one side of the board, in plain text that opens the choice of another. */
export function FindTeam({ finder, slot }: { finder: Finder; slot: "a" | "b" }) {
  const { text, languageTag } = useStreamLocale()
  const { data, question, names, ask, land } = finder
  const chosen = useRef(false)
  const key = slot === "a" ? "team" : "opp"
  const current = question[key]
  const side = text(...SIDE_NAMES[slot])
  const any = text("Đội bất kỳ", "Any team")
  const { teams } = data.view.content
  const rows = [...choices(data.feed.games, question, key)]
    .map(([id, games]) => ({ id, games, name: names.team(id) }))
    .sort((x, y) => y.games - x.games || x.name.localeCompare(y.name, "vi"))
  const choose = (id: string | null) => {
    chosen.current = id != null
    ask({ ...question, [key]: id })
  }
  const crest = (id: string) => (
    <StreamImage src={teams[id]?.logoUrl} darkSrc={teams[id]?.logoDarkUrl} logo name={names.team(id)} />
  )
  return (
    <ChoiceMenu
      title={side}
      align={slot === "a" ? "end" : "start"}
      value={current}
      choices={[
        { key: null, name: any, mark: <span className="tn-find-any" /> },
        ...rows.map(({ id, games, name }) => ({
          key: id,
          name,
          mark: crest(id),
          note: gamesText(games, text, languageTag),
        })),
      ]}
      onChoose={choose}
      onCloseAutoFocus={(event) => {
        if (!chosen.current) return
        chosen.current = false
        event.preventDefault()
        land("answer")
      }}
    >
      <button
        type="button"
        className="tn-find-team"
        data-slot={slot}
        data-chosen={current ? "" : undefined}
        aria-label={`${side}: ${current ? names.team(current) : any}`}
      >
        {current && crest(current)}
        <span>{current ? names.team(current) : any}</span>
        <StreamIcon name="chevronRight" size={16} />
      </button>
    </ChoiceMenu>
  )
}
