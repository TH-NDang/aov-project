import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"
import { orderedPatches } from "../hero/hero-version-diff"
import { subjectVideosQuery } from "./video-api"
import {
  byPurpose,
  formatDuration,
  providerName,
  purposeLabel,
  purposesIn,
  splitHeroVideos,
  videoPlayback,
  videosAtVersion,
  videoThumbnail,
  videoWatchUrl,
  type PublicVideo,
  type VideoPurpose,
  type VideoSubjectKind,
} from "./video-model"
import "./subject-videos.css"

/** Keeps only videos that apply at the version being read, and resolves the patch name for their label. */
function useVersionedVideos(videos: readonly PublicVideo[] | undefined, selectedId?: string | null) {
  const scope = useWikiContext()
  const options = scope.options
  return useMemo(() => {
    const timeline = orderedPatches(options?.patches ?? [], options?.seasons ?? [])
    const selected = selectedId || scope.patchVariantId || options?.patches.find((patch) => patch.isCurrent)?.id
    return {
      videos: videosAtVersion(videos ?? [], timeline, selected),
      patchCode: (video: PublicVideo) => timeline.find((patch) => patch.id === video.patchVariantId)?.code,
    }
  }, [options, scope.patchVariantId, selectedId, videos])
}

const canPlayHere = (video: PublicVideo) => !!videoPlayback(video, window.location.hostname)

/** The player is only created when the reader asks for it, so a page with many videos stays light. */
export function VideoPlayer({ video }: { video: PublicVideo }) {
  const playback = videoPlayback(video, window.location.hostname)
  if (!playback) return null
  if (playback.kind === "file")
    return <video className="wiki-video-frame" src={playback.src} title={video.title} controls autoPlay playsInline />
  return (
    <iframe
      className="wiki-video-frame"
      data-portrait={playback.portrait || undefined}
      src={playback.src}
      title={video.title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

function VideoThumbnail({ video, compact }: { video: PublicVideo; compact?: boolean }) {
  const thumbnail = videoThumbnail(video)
  const playable = canPlayHere(video)
  return (
    <span className="wiki-video-thumb" data-compact={compact || undefined}>
      {thumbnail ? (
        <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="wiki-video-thumb-provider">{providerName(video) || "Video"}</span>
      )}
      <span className="wiki-video-thumb-action" data-icon={playable ? "play" : "link"} aria-hidden="true">
        <WikiIcon name={playable ? "play" : "external"} size={compact ? 16 : 22} />
      </span>
      {!compact && video.durationSeconds && (
        <span className="wiki-video-duration">{formatDuration(video.durationSeconds)}</span>
      )}
    </span>
  )
}

function VideoCard({
  video,
  patchCode,
  playing,
  showPurpose,
  onToggle,
}: {
  video: PublicVideo
  patchCode?: string
  playing: boolean
  showPurpose: boolean
  onToggle: () => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const embeddable = canPlayHere(video)
  const provider = providerName(video)
  const meta = (
    <span className="wiki-video-meta">
      {showPurpose && <span>{purposeLabel(video.purpose, locale)}</span>}
      {patchCode && (
        <span className="wiki-video-patch">
          {text("Từ bản", "From")} {patchCode}
        </span>
      )}
      {video.channelName && <span>{video.channelName}</span>}
    </span>
  )

  if (playing)
    return (
      <li className="wiki-video-card" data-playing>
        <VideoPlayer video={video} />
        <div className="wiki-video-playing">
          <div>
            <h4 className="wiki-video-title">{video.title}</h4>
            {meta}
            {video.note && <p className="wiki-video-note">{video.note}</p>}
          </div>
          <div className="wiki-video-actions">
            <a href={videoWatchUrl(video)} target="_blank" rel="noreferrer">
              <WikiIcon name="external" size={14} />
              {provider ? `${text("Mở trên", "Open on")} ${provider}` : text("Mở liên kết gốc", "Open original link")}
            </a>
            <button type="button" onClick={onToggle}>
              {text("Đóng", "Close")}
            </button>
          </div>
        </div>
      </li>
    )

  const body = (
    <>
      <VideoThumbnail video={video} />
      <span className="wiki-video-title">{video.title}</span>
      {meta}
      {video.note && <span className="wiki-video-note">{video.note}</span>}
    </>
  )
  return (
    <li className="wiki-video-card">
      {embeddable ? (
        <button type="button" onClick={onToggle} aria-label={`${text("Phát", "Play")}: ${video.title}`}>
          {body}
        </button>
      ) : (
        <a
          href={videoWatchUrl(video)}
          target="_blank"
          rel="noreferrer"
          aria-label={`${text("Mở", "Open")}: ${video.title}${provider ? ` (${provider})` : ""}`}
        >
          {body}
        </a>
      )}
    </li>
  )
}

/**
 * A row of videos that opens each one in place. Filters appear only when the videos have more than one purpose, and a
 * long list stays short until the reader asks for the rest.
 */
export function VideoGallery({
  videos,
  heading,
  patchCode,
  limit = 6,
  filters = true,
  headingLevel = 2,
  id,
  purpose: chosenPurpose,
  onPurposeChange,
}: {
  videos: readonly PublicVideo[]
  heading: string
  patchCode?: (video: PublicVideo) => string | undefined
  limit?: number
  filters?: boolean
  headingLevel?: 2 | 3
  id?: string
  /** Lets the page choose a filter from elsewhere; the gallery keeps its own choice otherwise. */
  purpose?: VideoPurpose | null
  onPurposeChange?: (purpose: VideoPurpose | null) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [ownPurpose, setOwnPurpose] = useState<VideoPurpose | null>(null)
  const purpose = chosenPurpose === undefined ? ownPurpose : chosenPurpose
  const setPurpose = onPurposeChange ?? setOwnPurpose
  const [playing, setPlaying] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const Heading = headingLevel === 2 ? "h2" : "h3"

  const purposes = purposesIn(videos)
  const active = purpose && purposes.includes(purpose) ? purpose : null
  const matching = byPurpose(active ? videos.filter((video) => video.purpose === active) : videos)
  const shown = expanded ? matching : matching.slice(0, limit)
  if (!videos.length) return null

  return (
    <section className="wiki-videos" id={id} aria-label={heading}>
      <div className="wiki-videos-heading">
        <Heading>{heading}</Heading>
        <span className="wiki-videos-count">{videos.length}</span>
      </div>
      {filters && purposes.length > 1 && (
        <div className="wiki-videos-filters" role="group" aria-label={text("Lọc video", "Filter videos")}>
          <button type="button" aria-pressed={!active} onClick={() => setPurpose(null)}>
            {text("Tất cả", "All")}
          </button>
          {purposes.map((option) => (
            <button key={option} type="button" aria-pressed={active === option} onClick={() => setPurpose(option)}>
              {purposeLabel(option, locale)}
            </button>
          ))}
        </div>
      )}
      <ul className="wiki-video-list">
        {shown.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            patchCode={patchCode?.(video)}
            playing={playing === video.id}
            showPurpose={purposes.length > 1}
            onToggle={() => setPlaying((current) => (current === video.id ? null : video.id))}
          />
        ))}
      </ul>
      {matching.length > limit && (
        <button type="button" className="wiki-videos-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? text("Thu gọn", "Show less") : `${text("Xem thêm", "Show")} ${matching.length - limit} video`}
        </button>
      )}
    </section>
  )
}

/** Everything the hero page shows: its own videos, one list per skill, and lore videos. */
export function useHeroVideos(heroId: string, selectedId?: string | null) {
  const query = useQuery(subjectVideosQuery("HERO", heroId))
  const versioned = useVersionedVideos(query.data, selectedId)
  return useMemo(() => ({ ...splitHeroVideos(versioned.videos), patchCode: versioned.patchCode }), [versioned])
}

/** The block for one catalog entry; it renders nothing while the entry has no video. */
export function SubjectVideos({ kind, id, heading }: { kind: VideoSubjectKind; id: string; heading?: string }) {
  const { locale } = useWikiContext()
  const query = useQuery(subjectVideosQuery(kind, id))
  const { videos, patchCode } = useVersionedVideos(query.data)
  return (
    <VideoGallery
      videos={videos}
      heading={heading ?? wikiText(locale, "Video", "Videos")}
      patchCode={patchCode}
      headingLevel={3}
      limit={4}
    />
  )
}

/**
 * Videos of the skin open in the viewer's image area, so reading the skin and watching it share one place. The choice
 * belongs to one skin: moving to the next returns to its artwork.
 */
export function useSkinVideos(skin: { heroId: string; skinKey: string } | null) {
  const query = useQuery({
    ...subjectVideosQuery("SKIN", skin?.heroId ?? "", skin?.skinKey),
    enabled: !!skin,
  })
  const { videos } = useVersionedVideos(query.data)
  const current = skin ? `${skin.heroId}:${skin.skinKey}` : ""
  const [choice, setChoice] = useState<{ skin: string; video: string } | null>(null)
  const playing = choice?.skin === current ? (videos.find((video) => video.id === choice.video) ?? null) : null
  return {
    videos,
    playing,
    play: (video: PublicVideo) => setChoice({ skin: current, video: video.id }),
    stop: () => setChoice(null),
  }
}

export function SkinVideoList({
  videos,
  playing,
  onPlay,
  onStop,
}: {
  videos: readonly PublicVideo[]
  playing: PublicVideo | null
  onPlay: (video: PublicVideo) => void
  onStop: () => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  if (!videos.length) return null
  return (
    <section className="wiki-skin-videos" aria-label={text("Video trang phục", "Skin videos")}>
      <h3>
        {text("Video trang phục", "Skin videos")} <span>{videos.length}</span>
      </h3>
      <ul>
        {videos.map((video) => {
          const active = playing?.id === video.id
          const content = (
            <>
              <VideoThumbnail video={video} compact />
              <span className="wiki-skin-video-text">
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
                  aria-label={`${active ? text("Dừng", "Stop") : text("Phát", "Play")}: ${video.title}`}
                  onClick={() => (active ? onStop() : onPlay(video))}
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
    </section>
  )
}
