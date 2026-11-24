import { useStreamLocale } from "../../../components/stream-locale"
import { matchSides } from "../../../lib/match-schedule"
import type { FormMark } from "../../../lib/standings-model"
import "./form-marks.css"

/** The last results of a team, oldest first: a tall green bar is a win, a short red one a loss. */
export function FormMarks({ marks }: { marks: FormMark[] }) {
  const { text, languageTag } = useStreamLocale()
  return (
    <span className="tn-form">
      {marks.map(({ entry, won }) => {
        const [a, b] = matchSides(entry, languageTag)
        const result = won ? text("Thắng", "Win") : text("Thua", "Loss")
        return (
          <i
            key={entry.match.key}
            data-won={won || undefined}
            title={`${result}: ${a.name} ${a.score}–${b.score} ${b.name}`}
          >
            <span className="sr-only">{result}</span>
          </i>
        )
      })}
    </span>
  )
}
