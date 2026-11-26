import { useState, type RefObject } from "react"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { writeSeriesVideo } from "../data/series-video"
import type { GameSavers } from "../data/use-game-saver"
import type { MatchRecording } from "../data/use-match-recording"
import { layoutChapters } from "../model/series-vod"
import { youtubeLinkTime, youtubeVideoId } from "../model/vod"
import type { GameActions } from "./game-desk"
import type { VideoScope } from "./tools/game-video-row"

/** What the foot says once a link is written, with the second the link pointed at. */
export type Arrival = { text: string; second: number | null }

/**
 * The video of the match or of one of its games. A link for the match goes through each game's own saver, so it waits
 * for what is still being saved and never meets the next change as a conflict; a link for one game is a change of that
 * game, told in its foot with the way back.
 */
export function useVideoLink({
  games,
  recording,
  savers,
  actions,
  onArrival,
}: {
  games: DocumentView<GameContent>[]
  recording: MatchRecording
  savers: GameSavers
  actions: RefObject<GameActions | null>
  onArrival: (arrival: Arrival | null) => void
}) {
  const { entry, videoId } = recording
  /** The link typed for a match without a video. */
  const [link, setLink] = useState("")
  const [attaching, setAttaching] = useState(false)

  /** `told` when the foot says it already; the second of the link is offered all the same. */
  const arrived = (url: string, text: string, told = false) => {
    setLink("")
    const second = youtubeLinkTime(url)
    // A second in the link says where the editor was looking, never where a game starts.
    if (!told || second !== null) onArrival({ text, second })
    const next = youtubeVideoId(url)
    if (!next || next === videoId) return
    const [place] = entry ? layoutChapters([{ ...entry, content: { ...entry.content, sourceUrl: url } }], next) : []
    recording.switchVideo(next, place?.synced ? place.from : 0)
  }

  const attachVideo = (url: string, scope: VideoScope) => {
    if (scope === "game" && entry) {
      const before = entry.content.sourceUrl
      const text = url ? `Đã đổi video của ván ${entry.content.number}` : `Đã bỏ video của ván ${entry.content.number}`
      void actions.current
        ?.record({
          text,
          apply: (content) => ({ ...content, sourceUrl: url }),
          revert: (content) => ({ ...content, sourceUrl: before }),
        })
        .then((saved) => saved && arrived(url, text, true))
      return
    }
    if (!games.length) {
      recording.setDraftLink(url)
      return arrived(url, url ? "Đã gắn video cho cả trận." : "Đã bỏ video của cả trận.")
    }
    setAttaching(true)
    void writeSeriesVideo(savers.of, games, url, url ? "gắn video cho cả trận" : "bỏ video của cả trận")
      .then(({ written, total }) => {
        if (written === total) arrived(url, url ? "Đã gắn video cho cả trận." : "Đã bỏ video của cả trận.")
        // A game that refused says so itself; what the others carry now is told here.
        else if (written > 0)
          onArrival({
            text: `Đã ghi video vào ${written} trên ${total} ván; các ván còn lại giữ liên kết cũ.`,
            second: null,
          })
      })
      .finally(() => setAttaching(false))
  }

  return { link: link.trim(), setLink, attaching, attachVideo }
}
