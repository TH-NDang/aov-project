import { GoLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { mvpOf, type NamedPlayer } from "../../../lib/crew-model"
import { referenceName, UNKNOWN_REFERENCE } from "../../../lib/tournament-model"
import type { Chapter } from "../../../lib/watch-types"
import { gameWords, videoClock } from "../../../lib/watch-words"
import { RoomGo, RoomPress } from "./watch-icon"
import "./watch-next.css"

/** Who played best in the match, or in one game of it (`chapter`), with the hero they played. */
export function RoomMvp({ player, chapter }: { player: NamedPlayer; chapter?: Chapter }) {
  const { text } = useStreamLocale()
  const seat = chapter?.game.content.sides
    .flatMap((side) => side.participants)
    .find((item) => item.playerId === player.id)
  const hero = seat && referenceName(chapter!.game.catalog, "heroes", seat.hero, text(...UNKNOWN_REFERENCE))
  return (
    <p className="tn-room-note">
      {chapter ? "MVP" : text("MVP trận", "Match MVP")}{" "}
      <GoLink to={`/players/${player.id}`} prose>
        {player.name}
      </GoLink>
      {hero && text(` chơi ${hero}`, ` on ${hero}`)}
    </p>
  )
}

/** Before the first game that is timed: how long until it, and the way to it. */
export function WatchBefore() {
  const { text } = useStreamLocale()
  const next = useWatch((view) => view.place?.next ?? null)
  const left = useWatch((view) => Math.ceil(view.place?.left ?? 0))
  if (!next) return null
  return (
    <div className="tn-room-next">
      <div>
        <p className="tn-room-coming">{gameWords(next.number, text)}</p>
        <p className="tn-room-note">
          {next.draftStart == null
            ? text(`vào trận sau ${videoClock(left)}`, `starts in ${videoClock(left)}`)
            : text(`cấm chọn sau ${videoClock(left)}`, `draft in ${videoClock(left)}`)}
        </p>
      </div>
      <RoomGo icon="skip" onClick={() => watch.skip()}>
        {text(`Tới ván ${next.number}`, `To game ${next.number}`)}
      </RoomGo>
    </div>
  )
}

/** The way to the next game, which comes by itself once it is counted down. */
function Onward({ next }: { next: Chapter }) {
  const { text } = useStreamLocale()
  const left = useWatch((view) => (view.place?.left == null ? null : Math.ceil(view.place.left)))
  const count = useWatch((view) => view.count)
  const rest = left == null ? null : text(`còn nghỉ ${videoClock(left)}`, `${videoClock(left)} of break left`)
  return (
    <div className="tn-room-onward">
      <RoomGo
        icon="skip"
        note={count ? text(`sau ${count.seconds} giây`, `in ${count.seconds} s`) : rest}
        // The line runs to the end of the second that is counted.
        done={count ? (count.of - count.seconds + 1) / count.of : undefined}
        onClick={() => watch.skip()}
      >
        {text(`Tới ván ${next.number}`, `To game ${next.number}`)}
      </RoomGo>
      {count && (
        <RoomPress kind="stay" onClick={() => watch.stay()}>
          {text("Xem phần nghỉ", "Watch the break")}
        </RoomPress>
      )}
    </div>
  )
}

/** Between two games: who played best, and what comes next. */
export function WatchBreak({ chapter }: { chapter: Chapter }) {
  const { text } = useStreamLocale()
  const next = useWatch((view) => view.place?.next ?? null)
  const mvp = mvpOf(chapter.game.content.mvpPlayerId, chapter.game.players)
  const untimed = chapter.number + 1
  return (
    <div className="tn-room-next">
      {mvp && <RoomMvp player={mvp} chapter={chapter} />}
      {next ? (
        <Onward next={next} />
      ) : (
        <p className="tn-room-note">
          {text(`Ván ${untimed} chưa có mốc trên video.`, `Game ${untimed} is not timed on the video.`)}
        </p>
      )}
    </div>
  )
}
