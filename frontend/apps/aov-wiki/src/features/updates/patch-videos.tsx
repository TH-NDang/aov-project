import { Fragment, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { WikiIcon } from "../../components/wiki-icon"
import { useVideoParam } from "../../components/videos/subject-videos"
import { subjectVideosQuery } from "../../components/videos/video-api"
import { purposeLabel, videoWatchUrl, type PublicVideo } from "../../components/videos/video-model"
import { canPlayHere, VideoThumbnail } from "../../components/videos/video-player"
import { VideoTheater } from "../../components/videos/video-theater"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import type { PatchMarketRelease } from "../../lib/updates-api"
import { releaseMoment, splitAtRelease, videoMoment } from "../../lib/patch-video-timeline"
import "./patch-videos.css"

export const PATCH_VIDEOS_ID = "wiki-patch-videos"

export function usePatchVideos(variantId: string) {
  return useQuery(subjectVideosQuery("PATCH", variantId))
}

/**
 * The patch's videos on one track, oldest first, with the release as a gate between what was said before it and what
 * was played after (ADR-037). A hero's video carries the hero's name; the theater plays the track in order.
 */
export function PatchVideoTimeline({
  variantId,
  release,
  heroName,
}: {
  variantId: string
  release: PatchMarketRelease | undefined
  heroName: (heroId: string) => string | undefined
}) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const videoParam = useVideoParam()
  const query = usePatchVideos(variantId)
  const releaseAt = releaseMoment(release)
  const { ordered, firstAfter } = useMemo(() => splitAtRelease(query.data ?? [], releaseAt), [query.data, releaseAt])
  const playable = useMemo(() => ordered.filter(canPlayHere), [ordered])
  const playing = playable.find((video) => video.id === videoParam.id) ?? null
  const heading = text("Video về bản cập nhật", "Videos about this update")
  if (!ordered.length) return null

  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" })
  const tag = (video: PublicVideo) =>
    video.subjectKind === "HERO"
      ? (heroName(video.subjectId) ?? purposeLabel(video.purpose, locale))
      : purposeLabel(video.purpose, locale)
  const gate = releaseAt !== null && (
    <li className="wiki-patch-video-gate" aria-label={text("Phát hành", "Release")}>
      <span>{text("Phát hành", "Release")}</span>
      <time dateTime={new Date(releaseAt).toISOString()}>{day.format(releaseAt)}</time>
    </li>
  )

  return (
    <section className="wiki-patch-videos" id={PATCH_VIDEOS_ID} tabIndex={-1} aria-label={heading}>
      <h2>
        <WikiIcon name="play" size={14} />
        {heading}
        <small>{ordered.length}</small>
      </h2>
      <ol className="wiki-patch-video-track">
        {firstAfter === 0 && gate}
        {ordered.map((video, index) => {
          const moment = videoMoment(video)
          const content = (
            <>
              <span className="wiki-patch-video-frame">
                <VideoThumbnail video={video} />
              </span>
              <span className="wiki-patch-video-tag" data-hero={video.subjectKind === "HERO" ? "" : undefined}>
                {tag(video)}
              </span>
              <span className="wiki-video-title">{video.title}</span>
              <span className="wiki-video-meta">
                {moment !== null && <time dateTime={new Date(moment).toISOString()}>{day.format(moment)}</time>}
                {video.channelName && <span>{video.channelName}</span>}
              </span>
            </>
          )
          return (
            <Fragment key={video.id}>
              <li
                className="wiki-patch-video"
                data-side={firstAfter !== -1 && index >= firstAfter ? "after" : "before"}
              >
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
                  <a href={videoWatchUrl(video)} target="_blank" rel="noreferrer">
                    {content}
                  </a>
                )}
              </li>
              {index + 1 === firstAfter && index + 1 < ordered.length && gate}
            </Fragment>
          )
        })}
        {firstAfter === ordered.length && gate}
      </ol>
      <VideoTheater
        video={playing}
        playlist={playable}
        heading={heading}
        onSelect={videoParam.select}
        onClose={videoParam.close}
      />
    </section>
  )
}

/** A hero's videos of this patch, from its change card: plays the first, the rest follow on the track. */
export function HeroPatchVideoButton({ variantId, heroId }: { variantId: string; heroId: string | undefined }) {
  const text = useWikiText()
  const videoParam = useVideoParam()
  const query = usePatchVideos(variantId)
  const own = (query.data ?? []).filter((video) => video.subjectKind === "HERO" && video.subjectId === heroId)
  const first = own.find(canPlayHere)
  if (!heroId || !own.length) return null
  return (
    <button
      type="button"
      className="wiki-patch-hero-video"
      onClick={() => {
        if (first) return videoParam.open(first)
        const track = document.getElementById(PATCH_VIDEOS_ID)
        track?.scrollIntoView({ block: "start" })
        track?.focus({ preventScroll: true })
      }}
    >
      <WikiIcon name="play" size={12} />
      {text("Video", "Video")}
      {own.length > 1 && <b>{own.length}</b>}
    </button>
  )
}
