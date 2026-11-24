import type { CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { stageName } from "../../../lib/match-labels"
import { dayMonth } from "../../../lib/match-time"
import { stagePhases } from "../../../lib/stage-phases"
import { useNow } from "../../../lib/use-now"
import "./stage-rail.css"

/** Stages more than this are not drawn as one rail: the standings tab lists them. */
const MOST = 5

/**
 * The stages of a competition in the order they are played: when each runs and how far it has come. Pressing one
 * opens its table or its bracket.
 */
export function StageRail({ view, open }: { view: CompetitionView; open: () => void }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const phases = stagePhases(view, now)
  if (phases.length < 2 || phases.length > MOST) return null
  const day = (value: string) => dayMonth(value, languageTag)
  return (
    <ol className="tn-rail" aria-label={text("Các giai đoạn", "Stages")}>
      {phases.map(({ stage, startsOn, endsOn, matches, played, state }) => (
        <li key={stage.code} data-state={state} aria-current={state === "NOW" ? "step" : undefined}>
          <button type="button" onClick={open}>
            <strong>{stageName(stage.name)}</strong>
            <span>
              {startsOn && endsOn && (
                <span>{startsOn === endsOn ? day(startsOn) : `${day(startsOn)} – ${day(endsOn)}`}</span>
              )}
              <span>
                {state === "DONE"
                  ? text(`${matches} trận`, `${matches} ${matches === 1 ? "match" : "matches"}`)
                  : text(`${played}/${matches} trận`, `${played}/${matches} matches`)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
