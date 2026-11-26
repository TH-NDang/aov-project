import type { MouseEvent } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { stageName } from "../../../lib/match-labels"
import { dayMonth } from "../../../lib/match-time"
import { stagePhases } from "../../../lib/stage-phases"
import { useNow } from "../../../lib/use-now"
import "./stage-rail.css"

/** Stages more than this are not drawn as one rail: the standings tab lists them. */
const MOST = 5

/** Where the stages lead: the standings tab, and what opens one stage there. */
export type StageDoor = { href: string; open: (stage: string) => void }

/** A press that asks for another tab or window is left to the browser. */
const plain = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/**
 * The stages of a competition in the order they are played: when each runs and how far it has come. Pressing one
 * opens its table or its bracket.
 */
export function StageRail({ view, door }: { view: CompetitionView; door: StageDoor }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const phases = stagePhases(view, now)
  if (phases.length < 2 || phases.length > MOST) return null
  const day = (value: string) => dayMonth(value, languageTag)
  return (
    <ol className="tn-rail" aria-label={text("Các giai đoạn", "Stages")}>
      {phases.map(({ stage, startsOn, endsOn, matches, played, state }) => (
        <li key={stage.code} data-state={state} aria-current={state === "NOW" ? "step" : undefined}>
          <Link
            to={door.href}
            onClick={(event) => {
              if (!plain(event)) return
              event.preventDefault()
              door.open(stage.code)
            }}
          >
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
          </Link>
        </li>
      ))}
    </ol>
  )
}
