import { useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { WikiIcon } from "../wiki-icon"
import { orderedPatches } from "../../lib/hero-patch-line"
import { PatchName } from "../hero-patch-name"
import { subjectVideosQuery } from "./video-api"
import {
  byPurpose,
  formatDuration,
  neighbours,
  providerName,
  purposeLabel,
  purposesIn,
  splitHeroVideos,
  videosAtVersion,
  videoWatchUrl,
  type PublicVideo,
  type VideoPurpose,
  type VideoSubjectKind,
} from "./video-model"
import { canPlayHere, VideoThumbnail } from "./video-player"
import { VideoTheater } from "./video-theater"
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
      patchName: (video: PublicVideo) => {
        const patch = timeline.find((item) => item.id === video.patchVariantId)
        return patch && <PatchName patch={patch} />
      },
    }
  }, [options, scope.patchVariantId, selectedId, videos])
}

/** Which videos play in turn when a shortcut on the page opens one, whatever the gallery's own filter shows. */
export type VideoPlaylist = VideoPurpose | "ALL"

type VideoEntry = { openedVideo?: boolean; playlist?: VideoPlaylist }

/**
 * Keeps the open video in the address so it can be shared and the Back button closes it. Opening adds one history entry
 * and moving between videos replaces it, so Back always returns to the page. The entry remembers the list it plays, which
 * therefore ends with it and leaves no filter behind on the page.
 */
export function useVideoParam() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const entry = location.state as VideoEntry | null
  const set = (video: PublicVideo | null, replace: boolean, state: unknown) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (video) next.set("video", video.id)
        else next.delete("video")
        return next
      },
      { replace, preventScrollReset: true, state },
    )
  return {
    id: params.get("video"),
    playlist: entry?.playlist ?? null,
    open: (video: PublicVideo, playlist?: VideoPlaylist) =>
      set(video, false, { ...(location.state as object | null), openedVideo: true, playlist }),
    select: (video: PublicVideo) => set(video, true, location.state),
    close: () => {
      if (entry?.openedVideo) navigate(-1)
      else set(null, true, location.state)
    },
  }
}

/** The first column count, in order of preference, whose last row does not hold a single card alone. */
function fillingColumns(count: number, preferred: readonly number[]) {
  return preferred.find((columns) => count <= columns || count % columns !== 1) ?? preferred[0]
}

/** Column counts for a medium and a wide place, so a row of cards never ends with one card alone. */
function videoColumns(count: number) {
  return {
    "--video-columns-medium": fillingColumns(count, [3, 2, 4]),
    "--video-columns-wide": fillingColumns(count, [3, 4, 5]),
  } as CSSProperties
}

function VideoCard({
  video,
  patchName,
  showPurpose,
  onOpen,
}: {
  video: PublicVideo
  patchName?: ReactNode
  showPurpose: boolean
  onOpen: () => void
}) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const provider = providerName(video)
  const body = (
    <>
      <VideoThumbnail video={video} />
      <span className="wiki-video-title">{video.title}</span>
      <span className="wiki-video-meta">
        {showPurpose && <span>{purposeLabel(video.purpose, locale)}</span>}
        {patchName && (
          <span className="wiki-video-patch">
            {text("Từ bản", "From")} {patchName}
          </span>
        )}
        {video.channelName && <span>{video.channelName}</span>}
      </span>
      {video.note && <span className="wiki-video-note">{video.note}</span>}
    </>
  )
  return (
    <li className="wiki-video-card">
      {canPlayHere(video) ? (
        <button
          type="button"
          data-video-card={video.id}
          onClick={onOpen}
          aria-label={`${text("Phát", "Play")}: ${video.title}`}
        >
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
 * A set of video cards that opens each one in the theater. Filters appear only when the videos have more than one
 * purpose, and a long list stays short until the reader asks for the rest.
 */
export function VideoGallery({
  videos,
  heading,
  patchName,
  limit: wideLimit = 6,
  filters = true,
  headingLevel = 2,
  id,
}: {
  videos: readonly PublicVideo[]
  heading: string
  patchName?: (video: PublicVideo) => ReactNode
  limit?: number
  filters?: boolean
  headingLevel?: 2 | 3
  id?: string
}) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  // Rows take more height than cards, so a phone starts from fewer of them.
  const limit = usePageLayout() === "compact" ? Math.min(wideLimit, 3) : wideLimit
  const [purpose, setPurpose] = useState<VideoPurpose | null>(null)
  const [expanded, setExpanded] = useState(false)
  const videoParam = useVideoParam()
  const Heading = headingLevel === 2 ? "h2" : "h3"

  const purposes = purposesIn(videos)
  const active = purpose && purposes.includes(purpose) ? purpose : null
  const matching = byPurpose(active ? videos.filter((video) => video.purpose === active) : videos)
  const shown = expanded ? matching : matching.slice(0, limit)
  if (!videos.length) return null

  const playing = videos.find((video) => video.id === videoParam.id && canPlayHere(video)) ?? null
  // A card plays what the filter shows, and a shortcut on the page plays the list it names.
  const listed = videoParam.playlist ? (videoParam.playlist === "ALL" ? null : videoParam.playlist) : active
  const inList = byPurpose(listed ? videos.filter((video) => video.purpose === listed) : videos)
  // A shared link can name a video the list leaves out, and then the whole list plays.
  const filtered = !playing || inList.some((video) => video.id === playing.id)
  const playlist = (filtered ? inList : byPurpose(videos)).filter(canPlayHere)

  return (
    <section className="wiki-videos" id={id} aria-label={heading}>
      <div className="wiki-videos-heading">
        <Heading>
          {heading}
          <small>{videos.length}</small>
        </Heading>
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
      <ul className="wiki-video-list" style={videoColumns(shown.length)}>
        {shown.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            patchName={patchName?.(video)}
            showPurpose={purposes.length > 1}
            onOpen={() => videoParam.open(video)}
          />
        ))}
      </ul>
      {matching.length > limit && (
        <button
          type="button"
          className="wiki-videos-more"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <WikiIcon name="chevron" size={16} />
          {expanded ? text("Thu gọn", "Show less") : `${text("Xem thêm", "Show")} ${matching.length - limit} video`}
        </button>
      )}
      <VideoTheater
        video={playing}
        playlist={playlist}
        heading={filtered && listed ? purposeLabel(listed, locale) : heading}
        patchName={patchName}
        onSelect={videoParam.select}
        onClose={videoParam.close}
      />
    </section>
  )
}

/** Everything the hero page shows: its own videos, one list per skill, and lore videos. */
export function useHeroVideos(heroId: string, selectedId?: string | null) {
  const query = useQuery(subjectVideosQuery("HERO", heroId))
  const versioned = useVersionedVideos(query.data, selectedId)
  return useMemo(() => {
    const split = splitHeroVideos(versioned.videos)
    const playable = byPurpose(split.general).filter(canPlayHere)
    return {
      ...split,
      firstVideo: playable[0] ?? null,
      firstLore: playable.find((video) => video.purpose === "LORE") ?? null,
      patchName: versioned.patchName,
    }
  }, [versioned])
}

/**
 * A shortcut in the hero banner: it plays the hero's videos where the reader is, because the gallery sits below the
 * skills. The gallery is the place to go only when none of them can play here.
 */
export function HeroVideoButton({ heroId }: { heroId: string }) {
  const { locale } = useWikiContext()
  const { general, firstVideo } = useHeroVideos(heroId)
  const videoParam = useVideoParam()
  if (!general.length) return null
  return (
    <button
      type="button"
      className="wiki-hero-video-button"
      onClick={() => {
        if (firstVideo) videoParam.open(firstVideo, "ALL")
        else document.getElementById("hero-videos")?.scrollIntoView({ block: "start" })
      }}
    >
      <WikiIcon name="play" size={14} />
      {wikiText(locale, "Video", "Videos")} · {general.length}
    </button>
  )
}

/** The block for one catalog entry; it renders nothing while the entry has no video. */
export function SubjectVideos({ kind, id, heading }: { kind: VideoSubjectKind; id: string; heading?: string }) {
  const { locale } = useWikiContext()
  const query = useQuery(subjectVideosQuery(kind, id))
  const { videos, patchName } = useVersionedVideos(query.data)
  return (
    <VideoGallery
      videos={videos}
      heading={heading ?? wikiText(locale, "Video", "Videos")}
      patchName={patchName}
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
  const { next } = neighbours(videos.filter(canPlayHere), playing?.id)
  return {
    videos,
    playing,
    play: (video: PublicVideo) => setChoice({ skin: current, video: video.id }),
    stop: () => setChoice(null),
    // The last video returns to the artwork rather than leaving a finished player on screen.
    onEnded: () => setChoice(next ? { skin: current, video: next.id } : null),
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
  const text = useWikiText()
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
