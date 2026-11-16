import { useMemo, useState, type ReactNode } from "react"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"
import { useVideoParam } from "./subject-videos"
import { byPurpose, formatDuration, neighbours, purposeLabel, videoWatchUrl, type PublicVideo } from "./video-model"
import { canPlayHere, VideoPlayer, VideoThumbnail } from "./video-player"
import { VideoTheater } from "./video-theater"
import "./skill-videos.css"

/**
 * Videos of the skill being read, played right beside its text. Once a reader starts watching, choosing another skill
 * plays that skill's video in the same place, so comparing skills takes one tap each and no window to open or close.
 */
export function SkillVideos({
  skillKey,
  videos,
  patchName,
}: {
  skillKey: string
  videos: readonly PublicVideo[]
  patchName?: (video: PublicVideo) => ReactNode
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const videoParam = useVideoParam()
  const [watching, setWatching] = useState(false)
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const ordered = useMemo(() => byPurpose(videos), [videos])
  const playable = useMemo(() => ordered.filter(canPlayHere), [ordered])
  const current = playable.find((video) => video.id === chosen[skillKey]) ?? playable[0] ?? null
  const enlarged = playable.find((video) => video.id === videoParam.id) ?? null
  const showPlayer = watching && !!current && !enlarged

  if (!ordered.length)
    return watching ? (
      <p className="wiki-skill-video-none" role="status">
        {text("Kỹ năng này chưa có video.", "This ability has no video yet.")}
      </p>
    ) : null

  const play = (video: PublicVideo) => {
    setChosen((previous) => ({ ...previous, [skillKey]: video.id }))
    setWatching(true)
  }
  const playNext = () => {
    const { next } = neighbours(playable, current?.id)
    if (next) play(next)
    else setWatching(false)
  }

  return (
    <section className="wiki-skill-videos" aria-label={text("Video kỹ năng", "Ability videos")}>
      {showPlayer && (
        <div className="wiki-skill-video-stage">
          <VideoPlayer key={current.id} video={current} onEnded={playNext} />
          <div className="wiki-skill-video-bar">
            <strong>{current.title}</strong>
            <button type="button" onClick={() => videoParam.open(current)}>
              <WikiIcon name="expand" size={14} />
              {text("Xem lớn", "Enlarge")}
            </button>
            <button type="button" onClick={() => setWatching(false)}>
              <WikiIcon name="close" size={14} />
              {text("Ẩn video", "Hide video")}
            </button>
          </div>
        </div>
      )}
      {(!showPlayer || ordered.length > 1) && (
        <ul className="wiki-skill-video-list">
          {ordered.map((video) => {
            const active = showPlayer && video.id === current.id
            const content = (
              <>
                <VideoThumbnail video={video} compact />
                <span className="wiki-skill-video-text">
                  <span className="wiki-video-title">{video.title}</span>
                  <span className="wiki-video-meta">
                    <span>{active ? text("Đang phát", "Playing") : purposeLabel(video.purpose, locale)}</span>
                    {video.durationSeconds && <span>{formatDuration(video.durationSeconds)}</span>}
                  </span>
                </span>
              </>
            )
            return (
              <li key={video.id}>
                {canPlayHere(video) ? (
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${text("Phát", "Play")}: ${video.title}`}
                    onClick={() => play(video)}
                  >
                    {content}
                  </button>
                ) : (
                  <a
                    href={videoWatchUrl(video)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${text("Mở", "Open")}: ${video.title}`}
                  >
                    {content}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <VideoTheater
        video={enlarged}
        playlist={playable}
        heading={text("Video kỹ năng", "Ability videos")}
        patchName={patchName}
        onSelect={videoParam.select}
        onClose={videoParam.close}
      />
    </section>
  )
}
