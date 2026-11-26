import type { MusicRepeat, MusicView } from "../lib/music-store"
import { videoPicture, watchOnYouTube } from "../lib/music-links"
import { music } from "./music-session"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { useMusic } from "./use-music"
import "./music-controls.css"

const heard = ({ player }: MusicView) => player === "PLAYING" || player === "WAITING" || player === "OPENING"

const REPEAT_WORDS: Record<MusicRepeat, [string, string]> = {
  ALL: ["Lặp cả danh sách", "Repeat the list"],
  ONE: ["Lặp một bài", "Repeat one track"],
  OFF: ["Không lặp", "No repeat"],
}

/** A round button of the player, named for whoever cannot see its icon. */
function Press({
  label,
  icon,
  onPress,
  on,
  big,
  solid,
}: {
  label: string
  icon: Parameters<typeof StreamIcon>[0]["name"]
  onPress: () => void
  on?: boolean
  big?: boolean
  /** Drawn filled: play, pause and the skips. */
  solid?: boolean
}) {
  return (
    <button
      type="button"
      className={big ? "hub-music-press hub-music-press-big" : "hub-music-press"}
      title={label}
      aria-label={label}
      aria-pressed={on}
      data-solid={solid || big || undefined}
      onClick={onPress}
    >
      <StreamIcon name={icon} size={big ? 22 : 18} />
    </button>
  )
}

/** Three bars that dance while a track is heard, and stand still otherwise. */
function Bars() {
  const playing = useMusic(heard)
  return (
    <span className="hub-music-bars" data-playing={playing || undefined} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

/** What plays: its title and singer, or why it does not. */
function NowPlaying() {
  const { text } = useStreamLocale()
  const track = useMusic((view) => view.track)
  const failure = useMusic((view) => view.failure)
  const skipped = useMusic((view) => view.skipped)
  if (!track) return <p className="hub-music-title">{text("Chọn một bài", "Pick a track")}</p>
  const note = failure
    ? text("Bài này không phát được ngoài YouTube", "This track only plays on YouTube")
    : skipped
      ? text(`Đã bỏ qua “${skipped.title}”`, `Skipped “${skipped.title}”`)
      : track.artist
  return (
    <div className="hub-music-now-words">
      <p className="hub-music-title">{track.title}</p>
      <p className="hub-music-artist" data-warn={failure || skipped ? true : undefined}>
        {note}
      </p>
    </div>
  )
}

/** The play button, which pauses while a track is heard. */
function PlayPress({ big }: { big?: boolean }) {
  const { text } = useStreamLocale()
  const playing = useMusic(heard)
  return (
    <Press
      big={big}
      solid
      label={playing ? text("Tạm dừng", "Pause") : text("Phát", "Play")}
      icon={playing ? "pause" : "play"}
      onPress={() => music.toggle()}
    />
  )
}

/** Loudness: the button mutes, the slider sets it. Phones set it with their own keys. */
function Loudness() {
  const { text } = useStreamLocale()
  const volume = useMusic((view) => view.volume)
  const muted = useMusic((view) => view.muted)
  return (
    <div className="hub-music-loudness">
      <Press
        label={muted ? text("Bật tiếng", "Unmute") : text("Tắt tiếng", "Mute")}
        icon={muted || volume === 0 ? "volumeOff" : "volume"}
        onPress={() => music.toggleMute()}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={muted ? 0 : volume}
        aria-label={text("Âm lượng", "Volume")}
        style={{ "--music-level": `${muted ? 0 : volume}%` } as React.CSSProperties}
        onChange={(event) => music.setVolume(Number(event.currentTarget.value))}
      />
    </div>
  )
}

/** Shuffle and repeat, which the phone keeps on the shelf. */
export function MusicModes({ labelled }: { labelled?: boolean }) {
  const { text } = useStreamLocale()
  const shuffle = useMusic((view) => view.shuffle)
  const repeat = useMusic((view) => view.repeat)
  const [vi, en] = REPEAT_WORDS[repeat]
  if (labelled)
    return (
      <div className="hub-music-modes">
        <button
          type="button"
          className="hub-music-mode"
          aria-pressed={shuffle}
          onClick={() => music.setShuffle(!shuffle)}
        >
          <StreamIcon name="shuffle" size={16} />
          {text("Trộn bài", "Shuffle")}
        </button>
        <button
          type="button"
          className="hub-music-mode"
          aria-pressed={repeat !== "OFF"}
          onClick={() => music.cycleRepeat()}
        >
          <StreamIcon name={repeat === "ONE" ? "repeatOne" : "repeat"} size={16} />
          {text(vi, en)}
        </button>
      </div>
    )
  return (
    <>
      <Press
        label={text("Trộn bài", "Shuffle")}
        icon="shuffle"
        on={shuffle}
        onPress={() => music.setShuffle(!shuffle)}
      />
      <Press
        label={text(vi, en)}
        icon={repeat === "ONE" ? "repeatOne" : "repeat"}
        on={repeat !== "OFF"}
        onPress={() => music.cycleRepeat()}
      />
    </>
  )
}

/** The controls under the video. Wide, two rows; a phone keeps one, with the modes on the shelf. */
export function MusicControls({ compact }: { compact: boolean }) {
  const { text } = useStreamLocale()
  const shelf = useMusic((view) => view.shelf)
  const video = useMusic((view) => view.track?.video)
  const list = (
    <Press
      label={shelf ? text("Đóng danh sách", "Close the list") : text("Danh sách bài", "Track list")}
      icon="list"
      on={shelf}
      onPress={() => music.setShelf(!shelf)}
    />
  )
  const fold = <Press label={text("Thu gọn", "Fold")} icon="chevronDown" onPress={() => music.fold()} />
  if (compact)
    return (
      <div className="hub-music-row">
        <Bars />
        <NowPlaying />
        <Press label={text("Bài trước", "Previous")} icon="skipBack" solid onPress={() => music.previous()} />
        <PlayPress big />
        <Press label={text("Bài sau", "Next")} icon="skip" solid onPress={() => music.next()} />
        {list}
        {fold}
      </div>
    )
  return (
    <>
      <div className="hub-music-row">
        <Bars />
        <NowPlaying />
        {video && (
          <a
            className="hub-music-press"
            href={watchOnYouTube(video)}
            target="_blank"
            rel="noreferrer"
            title={text("Mở trên YouTube", "Open on YouTube")}
            aria-label={text("Mở trên YouTube", "Open on YouTube")}
          >
            <StreamIcon name="external" size={16} />
          </a>
        )}
        {list}
        {fold}
        <Press label={text("Tắt nhạc", "Stop the music")} icon="close" onPress={() => music.close()} />
      </div>
      <div className="hub-music-row hub-music-deckbar">
        <MusicModes />
        <span className="hub-music-gap" />
        <Press label={text("Bài trước", "Previous")} icon="skipBack" solid onPress={() => music.previous()} />
        <PlayPress big />
        <Press label={text("Bài sau", "Next")} icon="skip" solid onPress={() => music.next()} />
        <span className="hub-music-gap" />
        <Loudness />
      </div>
    </>
  )
}

/** The bar the player folds into: nothing is heard, the track waits with its picture. */
export function MusicFolded() {
  const { text } = useStreamLocale()
  const track = useMusic((view) => view.track)
  return (
    <div className="hub-music-row hub-music-bar">
      {track && <img className="hub-music-thumb" src={videoPicture(track.video)} alt="" />}
      <NowPlaying />
      <PlayPress big />
      <Press label={text("Mở trình phát", "Open the player")} icon="chevronUp" onPress={() => music.show()} />
      <Press label={text("Tắt nhạc", "Stop the music")} icon="close" onPress={() => music.close()} />
    </div>
  )
}
