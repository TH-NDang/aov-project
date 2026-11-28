import { useState } from "react"
import { GameIcon, type GameIconName } from "@aov/ui/components/game-icons"
import { lengthWords, MUSIC_LISTS, tracksOf, type MusicListCode, type MusicTrack } from "../lib/music-catalog"
import { videoPicture } from "../lib/music-links"
import { MusicModes } from "./music-controls"
import { MusicPaste } from "./music-paste"
import { music } from "./music-session"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { useMusic } from "./use-music"
import "./music-shelf.css"

const LIST_WORDS: Record<MusicListCode, { vi: string; en: string; icon: GameIconName }> = {
  SONGS: { vi: "Ca khúc", en: "Songs", icon: "microphone" },
  ARENA: { vi: "Giải đấu", en: "Esports", icon: "trophy-cup" },
  HEROES: { vi: "Tướng", en: "Heroes", icon: "samurai-helmet" },
  GAMING: { vi: "Game", en: "Gaming", icon: "gamepad" },
  MINE: { vi: "Của tôi", en: "Mine", icon: "person" },
}
const CODES: readonly MusicListCode[] = [...MUSIC_LISTS.map(({ code }) => code), "MINE"]

/** Plays a track; on a phone the list folds away so the video is seen. */
function pick(list: MusicListCode, index: number, compact: boolean) {
  music.play(list, index)
  if (compact) music.setShelf(false)
}

/**
 * One track of a list: picture, title, singer, what it belongs to and whether it has no words; the one that plays is
 * marked.
 */
function TrackRow({
  list,
  index,
  track,
  mine,
  compact,
}: {
  list: MusicListCode
  index: number
  track: MusicTrack
  mine: boolean
  /** A phone closes the list once a track is picked, so the video it plays comes into sight. */
  compact: boolean
}) {
  const { text } = useStreamLocale()
  const current = useMusic((view) => view.list === list && view.track?.video === track.video)
  return (
    <li className="hub-music-track" data-current={current || undefined} data-list={list}>
      <button type="button" className="hub-music-track-play" onClick={() => pick(list, index, compact)}>
        <span className="hub-music-track-art">
          <img src={videoPicture(track.video)} alt="" loading="lazy" />
          {track.seconds != null && <small>{lengthWords(track.seconds)}</small>}
        </span>
        <span className="hub-music-track-words">
          <b>{track.title}</b>
          <span>{track.artist}</span>
        </span>
        {(track.instrumental || track.tag) && (
          <span className="hub-music-tags">
            {track.instrumental && (
              <span className="hub-music-tag hub-music-bare">{text("Không lời", "Instrumental")}</span>
            )}
            {track.tag && <span className="hub-music-tag">{track.tag}</span>}
          </span>
        )}
      </button>
      {mine && (
        <button
          type="button"
          className="hub-music-track-drop"
          title={text("Bỏ khỏi danh sách", "Remove")}
          aria-label={text(`Bỏ ${track.title} khỏi danh sách`, `Remove ${track.title}`)}
          onClick={() => music.remove(track.video)}
        >
          <StreamIcon name="close" size={16} />
        </button>
      )}
    </li>
  )
}

/**
 * The lists to choose from, opened over the player: the site's lists of official songs and the reader's own
 * links. It opens on the list that plays.
 */
export function MusicShelf({ compact }: { compact: boolean }) {
  const { text } = useStreamLocale()
  const playing = useMusic((view) => view.list)
  const mine = useMusic((view) => view.mine)
  const [shown, setShown] = useState<MusicListCode>(playing)
  const tracks = tracksOf(shown, mine)
  return (
    <div className="hub-music-shelf" role="region" aria-label={text("Danh sách bài", "Track list")}>
      <div className="hub-music-shelf-head">
        <div className="hub-music-lists" role="tablist" aria-label={text("Chọn danh sách", "Choose a list")}>
          {CODES.map((code) => (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={code === shown}
              className="hub-music-list"
              onClick={() => setShown(code)}
            >
              <GameIcon name={LIST_WORDS[code].icon} size={20} />
              <span>{text(LIST_WORDS[code].vi, LIST_WORDS[code].en)}</span>
            </button>
          ))}
        </div>
        {compact && <MusicModes labelled />}
      </div>
      <div className="hub-music-shelf-body" role="tabpanel">
        {shown === "MINE" && <MusicPaste />}
        {tracks.length > 0 ? (
          <ol className="hub-music-tracks">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.video}
                list={shown}
                index={index}
                track={track}
                mine={shown === "MINE"}
                compact={compact}
              />
            ))}
          </ol>
        ) : (
          <p className="hub-music-empty">
            {text("Dán link YouTube để thêm bài của bạn.", "Paste a YouTube link to add your own.")}
          </p>
        )}
      </div>
    </div>
  )
}
