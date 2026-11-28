import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { present } from "../../../lib/tournament-model"
import { draftAt } from "../../../lib/watch-place"
import { turnStart } from "../../../lib/watch-rows"
import type { Chapter, WatchMatch, WatchTeam, WatchTurn } from "../../../lib/watch-types"
import { shortName } from "../../../lib/watch-words"
import { ReferenceArt } from "./reference-art"
import { BanFace, banPlace, Board, SEATS, SideHead, useHeroNames } from "./watch-board"

type Turn = ReturnType<typeof draftAt>[number] & { source: WatchTurn }

/**
 * The draft as it is made: bans at the head of their side, picks in the order they come, what is being decided ringed. A
 * turn that has been made plays again from a little before it.
 */
export function DraftBoard({ match, chapter, names }: { match: WatchMatch; chapter: Chapter; names: boolean }) {
  const { text } = useStreamLocale()
  const second = useWatch((view) => view.second)
  const heroes = useHeroNames(chapter.game)
  const turns: Turn[] = draftAt(chapter, second).map((turn, index) => ({ ...turn, source: chapter.turns[index]! }))
  const made = turns.filter((turn) => turn.made).length
  const replay = ({ source }: Turn) => {
    const from = turnStart(chapter, source)
    if (chapter.video && from != null) watch.go({ video: chapter.video, second: from })
  }
  const label = ({ kind, team, hero }: Turn) => {
    const name = shortName(match, team)
    if (kind === "BAN")
      return present(hero)
        ? text(`Phát lại: ${name} cấm ${heroes.ban(hero)}`, `Replay: ${name} banned ${heroes.ban(hero)}`)
        : text(`Phát lại: lượt cấm của ${name}`, `Replay: a ban of ${name}`)
    return present(hero)
      ? text(`Phát lại: ${name} chọn ${heroes.pick(hero)}`, `Replay: ${name} picked ${heroes.pick(hero)}`)
      : text(`Phát lại: lượt chọn của ${name}`, `Replay: a pick of ${name}`)
  }

  const head = (team: WatchTeam) => {
    const name = shortName(match, team)
    const bans = turns.filter((turn) => turn.team === team && turn.kind === "BAN")
    const open = turns.find((turn) => turn.team === team && turn.open)
    const busy = open && (open.kind === "BAN" ? text("đang cấm", "banning") : text("đang chọn", "picking"))
    return (
      <SideHead match={match} chapter={chapter} team={team} busy={busy}>
        {bans.length > 0 && (
          <ol className="tn-room-bans" aria-label={text(`${name} cấm`, `Bans of ${name}`)}>
            {bans.map((turn) => (
              <li key={turn.order}>
                {turn.made ? (
                  <button
                    type="button"
                    {...banPlace(turn.hero)}
                    title={heroes.ban(turn.hero)}
                    aria-label={label(turn)}
                    onClick={() => replay(turn)}
                  >
                    <BanFace game={chapter.game} hero={turn.hero} />
                  </button>
                ) : (
                  <span className="tn-room-blank" data-open={turn.open || undefined} />
                )}
              </li>
            ))}
          </ol>
        )}
      </SideHead>
    )
  }
  const seats = (team: WatchTeam) => {
    const name = shortName(match, team)
    const picks = turns.filter((turn) => turn.team === team && turn.kind === "PICK")
    const blank = Math.max(0, SEATS - picks.length)
    return (
      <ol className="tn-room-seats" aria-label={text(`${name} chọn`, `Picks of ${name}`)}>
        {picks.map((turn) => (
          <li key={turn.order}>
            {turn.made ? (
              <button type="button" className="tn-room-seat" aria-label={label(turn)} onClick={() => replay(turn)}>
                <ReferenceArt catalog={chapter.game.catalog} kind="heroes" selection={turn.hero} />
                {names && <span>{heroes.pick(turn.hero)}</span>}
              </button>
            ) : (
              <span className="tn-room-seat">
                <span className="tn-room-blank" data-open={turn.open || undefined} />
                {names && <span />}
              </span>
            )}
          </li>
        ))}
        {Array.from({ length: blank }, (_, index) => (
          <li key={`blank-${index}`}>
            <span className="tn-room-seat">
              <span className="tn-room-blank" />
              {names && <span />}
            </span>
          </li>
        ))}
      </ol>
    )
  }
  const turn = Math.min(made + 1, turns.length)
  return (
    <Board
      heads={{ A: head("A"), B: head("B") }}
      seats={{ A: seats("A"), B: seats("B") }}
      axis={
        names && (
          <p className="tn-room-turn">
            {turns.length > 0 && text(`lượt ${turn} trong ${turns.length}`, `turn ${turn} of ${turns.length}`)}
          </p>
        )
      }
    />
  )
}
