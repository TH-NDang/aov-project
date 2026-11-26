import { videoWatchUrl } from "@aov/ui/lib/video-playback"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { startOf } from "../../../lib/watch-follow"
import type { WatchFailure as Failure } from "../../../lib/watch-store"
import type { WatchMatch } from "../../../lib/watch-types"
import { failureWords } from "../../../lib/watch-words"
import { RoomGo, RoomPress } from "./watch-icon"
import "./watch-failure.css"

/** In the place of the video, where it can not be played here: what happened, and the two ways on. */
export function WatchFailure({ match, failure }: { match: WatchMatch; failure: Failure }) {
  const { text } = useStreamLocale()
  const chosen = useWatch((view) => view.chosen)
  const length = useWatch((view) => view.length)
  const open = useWatch((view) => view.video)
  const { story, cuts } = match
  const chapter = story.chapters[chosen]
  const video = chapter?.video ?? open ?? story.videos[0]
  const second = chapter && Math.floor(startOf(chapter, cuts, length) ?? chapter.link)
  const { title, retry, link } = failureWords(failure, text)
  const address =
    video &&
    videoWatchUrl({
      url: `https://www.youtube.com/watch?v=${video}`,
      providerVideoId: video,
      startSeconds: second ?? 0,
    })
  return (
    <div className="tn-room-failure">
      <p>{title}</p>
      {link && address && (
        <RoomGo icon="play" href={address}>
          {chapter && second
            ? text(`Mở ván ${chapter.number} trên YouTube`, `Open game ${chapter.number} on YouTube`)
            : text("Xem trên YouTube", "Watch on YouTube")}
        </RoomGo>
      )}
      {retry && <RoomPress onClick={() => watch.retry()}>{text("Thử lại", "Retry")}</RoomPress>}
    </div>
  )
}
