import { memo, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import { useSearchParams } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { GoLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { barAt, gameWords, seasonStages, seasonSteps } from "../../../lib/club-model"
import { stageName } from "../../../lib/match-labels"
import { withParam } from "../../../lib/params"
import { statsPlace } from "../../../lib/statistics-routes"
import type { TeamGame, TeamRecord } from "../../../lib/team-draft-model"
import "./club-season.css"

/** The width of a step of space between two bars, in pixels. */
const STEP = 3

/** A length along the season: so many bars and so many steps of space. */
const length = (bars: number, gaps: number) => ({ "--bars": bars, "--gaps": gaps }) as CSSProperties

const Bars = memo(function Bars({ games, steps }: { games: TeamGame[]; steps: number[] }) {
  return (
    <span className="tn-club-season-bars" aria-hidden="true">
      {games.map(({ game, won }, index) => (
        <i
          key={game.id}
          data-won={won === true || undefined}
          data-open={won === null || undefined}
          style={length(index, steps[index]!)}
        />
      ))}
    </span>
  )
})

/** The stages a season ran through, each named where its first game stands. */
function Stages({ view, record }: { view: CompetitionView; record: TeamRecord }) {
  const stages = seasonStages(record)
  if (stages.length < 2) return null
  return (
    <span className="tn-club-season-stages">
      {stages.map(({ code, games, steps }, index) => {
        const stage = view.content.plan.stages.find((item) => item.code === code)
        return (
          <span key={index} style={length(games, steps)}>
            {stage && stageName(stage.name)}
          </span>
        )
      })}
    </span>
  )
}

/**
 * The game of a season the address names, or its last one. Moving along the season is kept here alone and the address is
 * written once, when the game is chosen; what is kept here counts until the address has moved on.
 */
function useChosenGame({ games }: TeamRecord) {
  const [params, setParams] = useSearchParams()
  const [moved, setMoved] = useState<{ from: string | null; to: number } | null>(null)
  const asked = statsPlace(params).game ?? null
  if (moved && moved.from !== asked) setMoved(null)
  const last = games.length - 1
  const named = games.findIndex(({ game }) => game.id === asked)
  return {
    at: moved?.from === asked ? Math.min(moved.to, last) : named < 0 ? last : named,
    last,
    move: (to: number) => setMoved({ from: asked, to }),
    choose: (at: number) => {
      // A season opens on its last game, which the address need not say.
      const id = at === last ? null : games[at]!.game.id
      setMoved({ from: asked, to: at })
      if (id !== asked) setParams((current) => withParam(current, "game", id), { replace: true })
    },
  }
}

/**
 * The season of a team as one bar a game in the order they were played, with a line that names one of them: pressing,
 * dragging and the arrow keys move from game to game. The game chosen stands in the address, so that a link to the page
 * and coming back to it find the season as it was left.
 */
export function ClubSeason({ view, record }: { view: CompetitionView; record: TeamRecord }) {
  const { text, languageTag } = useStreamLocale()
  const { at, last, move, choose } = useChosenGame(record)
  /** The game chosen before a press, while a finger or the mouse is down. */
  const pressed = useRef<number | null>(null)
  const steps = useMemo(() => seasonSteps(record), [record])
  const { games } = record
  const { game } = games[at]!
  const words = gameWords(games[at]!, view, text, languageTag)

  const pointed = ({ currentTarget, clientX }: PointerEvent<HTMLInputElement>) => {
    const { left, width } = currentTarget.getBoundingClientRect()
    return barAt(steps, clientX - left, width, STEP)
  }
  const release = (event: PointerEvent<HTMLInputElement>) => {
    if (pressed.current == null) return
    pressed.current = null
    choose(pointed(event))
  }
  return (
    <div
      className="tn-club-season"
      style={{ "--games": games.length, "--steps": steps.at(-1), "--step": `${STEP}px` } as CSSProperties}
    >
      <div className="tn-club-season-track">
        <Bars games={games} steps={steps} />
        <span className="tn-club-season-at" style={length(at, steps[at]!)} aria-hidden="true" />
        {last > 0 && (
          <input
            type="range"
            min={0}
            max={last}
            value={at}
            aria-label={text("Chọn một ván của đội", "Choose a game of the team")}
            aria-valuetext={words}
            // A finger and a mouse choose the bar they are on; the control's even steps would miss it by the spaces.
            onPointerDown={(event) => {
              if (event.button !== 0) return
              pressed.current = at
              event.currentTarget.setPointerCapture(event.pointerId)
              move(pointed(event))
            }}
            onPointerMove={(event) => pressed.current != null && move(pointed(event))}
            onPointerUp={release}
            // The finger turned out to scroll the page.
            onPointerCancel={() => {
              if (pressed.current != null) move(pressed.current)
              pressed.current = null
            }}
            onChange={(event) => pressed.current == null && move(Number(event.target.value))}
            onKeyUp={() => choose(at)}
            onBlur={() => choose(at)}
          />
        )}
      </div>
      <Stages view={view} record={record} />
      <p className="tn-club-season-game">
        <span>{words}</span>
        <GoLink to={`/games/${game.id}`} aria-label={text(`Mở ván: ${words}`, `Open the game: ${words}`)}>
          {text("Mở ván", "Open the game")}
        </GoLink>
      </p>
    </div>
  )
}
