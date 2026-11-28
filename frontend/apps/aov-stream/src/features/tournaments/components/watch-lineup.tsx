import { useMemo } from "react"
import type { GameSide, Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { ObjectiveMark } from "../../../components/objective-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { laneName } from "../../../lib/feed-words"
import { clock, LANE_NAMES } from "../../../lib/tournament-model"
import { countsAt } from "../../../lib/watch-place"
import type { Chapter, WatchMatch, WatchTeam } from "../../../lib/watch-types"
import { KIND_NAMES, shortName } from "../../../lib/watch-words"
import { nicknameOf } from "./loadout-names"
import { ReferenceArt } from "./reference-art"
import { BanFace, banPlace, Board, SideHead, useHeroNames } from "./watch-board"
import "./watch-lineup.css"

const LANES = Object.keys(LANE_NAMES) as Lane[]

const sideOf = ({ game, sides }: Chapter, team: WatchTeam): GameSide | undefined =>
  game.content.sides.find(({ side }) => side === sides[team])

/** How far the counts of a game go, where its record stops before the video does. */
export function useCountedTo({ upTo }: ReturnType<typeof countsAt>) {
  const { text } = useStreamLocale()
  return upTo == null ? null : text(`Số đếm tới ${clock(upTo)}.`, `Counted up to ${clock(upTo)}.`)
}

/** What a team has taken so far; paler where the record stops before the video does. */
function Counts({ counts, team }: { counts: ReturnType<typeof countsAt>; team: WatchTeam }) {
  const { text } = useStreamLocale()
  const behind = useCountedTo(counts)
  return (
    <div className="tn-room-counts" data-behind={behind != null || undefined}>
      {counts.kinds.map((kind) => {
        const count = counts[team][kind] ?? 0
        const name = text(...KIND_NAMES[kind])
        return (
          <span key={kind} title={behind ? `${name}. ${behind}` : name} data-none={count === 0 || undefined}>
            {kind === "KILL" || kind === "NOTE" ? (
              <StreamIcon name={kind === "KILL" ? "sword" : "flag"} size={17} />
            ) : (
              <ObjectiveMark objective={kind} size={17} />
            )}
            <span className="sr-only">{name}</span> {count}
          </span>
        )
      })}
    </div>
  )
}

function Bans({ chapter, team, name }: { chapter: Chapter; team: WatchTeam; name: string }) {
  const { text } = useStreamLocale()
  const heroes = useHeroNames(chapter.game)
  const bans = sideOf(chapter, team)?.bans ?? []
  if (!bans.length) return null
  return (
    <ol className="tn-room-bans" aria-label={text(`${name} cấm`, `Bans of ${name}`)}>
      {bans.map((hero, index) => (
        <li key={index}>
          <span {...banPlace(hero)} title={heroes.ban(hero)}>
            <BanFace game={chapter.game} hero={hero} />
          </span>
        </li>
      ))}
    </ol>
  )
}

function Seats({ chapter, team, name, names }: { chapter: Chapter; team: WatchTeam; name: string; names: boolean }) {
  const heroes = useHeroNames(chapter.game)
  const side = sideOf(chapter, team)
  return (
    <ul className="tn-room-seats" aria-label={name}>
      {LANES.map((lane) => {
        const seat = side?.participants.find((item) => item.lane === lane)
        const nickname = seat && nicknameOf(chapter.game, seat)
        return (
          <li key={lane}>
            <span className="tn-room-seat">
              {seat ? (
                <ReferenceArt catalog={chapter.game.catalog} kind="heroes" selection={seat.hero} />
              ) : (
                <span className="tn-room-blank" data-unknown="" />
              )}
              {names && <span data-hero={!nickname || undefined}>{nickname ?? (seat && heroes.pick(seat.hero))}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The line-ups of a game lane by lane, with who plays each hero. The heads count what each team has taken (`counted`),
 * or show its bans where nothing is counted.
 */
export function LineupBoard({
  match,
  chapter,
  counted = false,
  names,
}: {
  match: WatchMatch
  chapter: Chapter
  counted?: boolean
  names: boolean
}) {
  const { text } = useStreamLocale()
  const at = useWatch((view) => Math.floor(view.place?.clock ?? 0))
  const counts = useMemo(
    () => (counted && chapter.moments.length > 0 ? countsAt(chapter, at) : null),
    [counted, chapter, at],
  )
  const head = (team: WatchTeam) => (
    <SideHead match={match} chapter={chapter} team={team}>
      {counts?.kinds.length ? (
        <Counts counts={counts} team={team} />
      ) : (
        <Bans chapter={chapter} team={team} name={shortName(match, team)} />
      )}
    </SideHead>
  )
  const seated = chapter.game.content.sides.some(({ participants }) => participants.length > 0)
  const seats = (team: WatchTeam) => <Seats chapter={chapter} team={team} name={shortName(match, team)} names={names} />
  return (
    <Board
      heads={{ A: head("A"), B: head("B") }}
      seats={seated ? { A: seats("A"), B: seats("B") } : null}
      axis={
        names && (
          <div className="tn-room-lanes" aria-hidden="true">
            {LANES.map((lane) => (
              <span key={lane} title={laneName(lane, text)}>
                <HeroLaneIcon lane={lane} size={14} />
              </span>
            ))}
          </div>
        )
      }
    />
  )
}
