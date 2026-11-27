import { useMemo, type ReactNode } from "react"
import { useWikiText } from "../../context/wiki-context"
import { WikiIcon } from "../wiki-icon"
import { useVideoParam } from "./subject-videos"
import { videoWatchUrl, type PublicVideo } from "./video-model"
import { canPlayHere, VideoThumbnail } from "./video-player"
import { VideoTheater } from "./video-theater"
import "./skill-videos.css"

export const SKILL_VIDEOS_ID = "wiki-skill-videos"

/**
 * The hero's skill videos in one strip under the abilities, whichever skill each shows. A card opens the theater on the
 * strip's list, so the next skill's video is one press away and the page underneath never moves.
 */
export function SkillVideoStrip({
  videos,
  patchName,
}: {
  videos: readonly PublicVideo[]
  patchName?: (video: PublicVideo) => ReactNode
}) {
  const text = useWikiText()
  const videoParam = useVideoParam()
  const playable = useMemo(() => videos.filter(canPlayHere), [videos])
  const playing = playable.find((video) => video.id === videoParam.id) ?? null
  const heading = text("Video kỹ năng", "Ability videos")
  if (!videos.length) return null

  return (
    <section className="wiki-skill-videos" id={SKILL_VIDEOS_ID} tabIndex={-1} aria-label={heading}>
      <h3>
        <WikiIcon name="play" size={14} />
        {heading}
        <small>{videos.length}</small>
      </h3>
      <ul className="wiki-skill-video-strip">
        {videos.map((video) => {
          const patch = patchName?.(video)
          const content = (
            <>
              <span className="wiki-skill-video-frame">
                <VideoThumbnail video={video} />
              </span>
              <span className="wiki-video-title">{video.title}</span>
              {(patch || video.channelName) && (
                <span className="wiki-video-meta">
                  {patch && (
                    <span className="wiki-video-patch">
                      {text("Từ bản", "From")} {patch}
                    </span>
                  )}
                  {video.channelName && <span>{video.channelName}</span>}
                </span>
              )}
            </>
          )
          return (
            <li key={video.id}>
              {canPlayHere(video) ? (
                <button
                  type="button"
                  data-video-card={video.id}
                  aria-label={`${text("Phát", "Play")}: ${video.title}`}
                  onClick={() => videoParam.open(video)}
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
      <VideoTheater
        video={playing}
        playlist={playable}
        heading={heading}
        patchName={patchName}
        onSelect={videoParam.select}
        onClose={videoParam.close}
      />
    </section>
  )
}

/**
 * The way to the skill videos from the head of the abilities, where a long ability text would otherwise keep the strip
 * out of sight. It plays the first one; when none plays here, it goes to the strip.
 */
export function SkillVideoShortcut({ videos }: { videos: readonly PublicVideo[] }) {
  const text = useWikiText()
  const videoParam = useVideoParam()
  if (!videos.length) return null
  const first = videos.find(canPlayHere)
  return (
    <button
      type="button"
      className="wiki-hero-section-more wiki-skill-video-shortcut"
      onClick={() => {
        if (first) return videoParam.open(first)
        const strip = document.getElementById(SKILL_VIDEOS_ID)
        strip?.scrollIntoView({ block: "start" })
        strip?.focus({ preventScroll: true })
      }}
    >
      <WikiIcon name="play" size={14} />
      {text("Video", "Videos")} · {videos.length}
    </button>
  )
}
