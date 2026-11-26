import { useEffect, useRef, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { ProfileLink, YouTubeChannel, YouTubeVideo } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { Sheet, SheetContent, SheetTitle } from "@aov/ui/components/sheet"
import { SocialPlatformIcon } from "@aov/ui/components/social-platform-icon"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { watch } from "../../../components/watch-session"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { channelVideos, compactCount, playerUrl, splitShorts, subscribeUrl, watchUrl } from "../model/channel-model"
import { ChannelVideoCard, ShortCard } from "./channel-video-card"
import "./channel-viewer.css"

/**
 * A page's YouTube channel inside the site: a panel from the right on wide screens, a screen of its own on phones. It
 * shows the channel's banner, name and counts, its newest videos and shorts, and loads older ones as the reader
 * scrolls. A pressed video plays at the top of the panel; subscribing is only possible on YouTube, so that button
 * opens YouTube.
 */
export function ChannelViewer({
  pageId,
  link,
  open,
  onOpenChange,
}: {
  pageId: string
  link: ProfileLink
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="pf-channel" aria-describedby={undefined}>
        {open && <ChannelBody pageId={pageId} link={link} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ChannelBody({ pageId, link, onClose }: { pageId: string; link: ProfileLink; onClose: () => void }) {
  const { text } = useStreamLocale()
  const scroller = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState<YouTubeVideo | null>(null)
  const [olderWanted, setOlderWanted] = useState(false)
  const channel = useQuery({
    queryKey: communityKeys.youtubeChannel(pageId, link.url),
    queryFn: () => communityApi.youtubeChannel(pageId, link.url),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const older = useInfiniteQuery({
    queryKey: communityKeys.youtubeVideos(pageId, link.url),
    queryFn: ({ pageParam }) => communityApi.youtubeVideos(pageId, link.url, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
    enabled: olderWanted,
    staleTime: 5 * 60_000,
    retry: false,
  })

  function play(video: YouTubeVideo) {
    watch.pause()
    setPlaying(video)
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const data = channel.data
  // Older uploads are asked for only once the reader reaches the end of the newest ones.
  const loader = {
    hasNextPage: !!data?.more && (!older.data || older.hasNextPage),
    isFetching: older.isFetching,
    isError: older.isError,
    fetchNextPage: () => (older.data ? older.fetchNextPage() : Promise.resolve(setOlderWanted(true))),
  }
  const all = data ? channelVideos(data.videos, older.data?.pages ?? []) : []
  const { videos, shorts } = splitShorts(all)
  const [feature, ...rest] = videos

  return (
    <div className="pf-channel-scroll" ref={scroller}>
      <ChannelHead channel={data} link={link} pending={channel.isPending} onClose={onClose} />
      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
      {channel.isError ? (
        <div className="pf-channel-state" role="alert">
          <p>{text("Chưa tải được kênh này.", "This channel could not be loaded.")}</p>
          <a className="cp-button" href={link.url} target="_blank" rel="noreferrer">
            {text("Xem trên YouTube", "Watch on YouTube")}
            <StreamIcon name="external" size={14} />
          </a>
        </div>
      ) : channel.isPending ? (
        <div className="pf-channel-skeleton" role="status" aria-label={text("Đang tải kênh", "Loading the channel")}>
          <span data-feature />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : !all.length ? (
        <p className="pf-channel-state">{text("Kênh chưa có video.", "No videos yet.")}</p>
      ) : (
        <>
          {feature && <ChannelVideoCard video={feature} feature playing={playing?.id === feature.id} onPlay={play} />}
          {shorts.length > 0 && (
            <section className="pf-channel-shelf" aria-label="Shorts">
              <h3>Shorts</h3>
              <div className="pf-channel-shorts">
                {shorts.map((short) => (
                  <ShortCard key={short.id} video={short} playing={playing?.id === short.id} onPlay={play} />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="pf-channel-shelf" aria-label={text("Video", "Videos")}>
              <h3>{text("Video", "Videos")}</h3>
              <div className="pf-channel-grid">
                {rest.map((video) => (
                  <ChannelVideoCard key={video.id} video={video} playing={playing?.id === video.id} onPlay={play} />
                ))}
              </div>
            </section>
          )}
          <InfiniteScroll
            query={loader}
            rootRef={scroller}
            label={text("Đang tải thêm video", "Loading more videos")}
            retryLabel={text("Tải lại", "Try again")}
          />
        </>
      )}
    </div>
  )
}

/** The banner with the channel's picture, name and counts, and the ways to YouTube. */
function ChannelHead({
  channel,
  link,
  pending,
  onClose,
}: {
  channel: YouTubeChannel | undefined
  link: ProfileLink
  pending: boolean
  onClose: () => void
}) {
  const { text, languageTag } = useStreamLocale()
  const mobile = usePageLayout() === "compact"
  const title = channel?.title || link.label
  const figures = [
    channel?.handle,
    channel?.subscriberCount != null &&
      text(
        `${compactCount(channel.subscriberCount, languageTag)} người đăng ký`,
        `${compactCount(channel.subscriberCount, languageTag)} subscribers`,
      ),
    channel?.videoCount != null &&
      text(
        `${compactCount(channel.videoCount, languageTag)} video`,
        `${compactCount(channel.videoCount, languageTag)} videos`,
      ),
  ].filter(Boolean)
  return (
    <header className="pf-channel-head" data-pending={pending || undefined}>
      <div className="pf-channel-banner">{channel?.bannerUrl && <img src={channel.bannerUrl} alt="" />}</div>
      <div className="pf-channel-bar">
        <button
          type="button"
          className="pf-channel-close"
          data-back={mobile || undefined}
          aria-label={mobile ? text("Quay lại", "Back") : text("Đóng", "Close")}
          onClick={onClose}
        >
          <StreamIcon name={mobile ? "arrow" : "close"} size={18} />
        </button>
      </div>
      <div className="pf-channel-who">
        <StreamImage src={channel?.avatarUrl} name={title} className="pf-channel-avatar" />
        <div>
          <SheetTitle className="pf-channel-title">
            <span>{title}</span>
            {link.official && <OfficialBadge label={text("Kênh chính thức", "Official channel")} />}
          </SheetTitle>
          {figures.length > 0 && <p className="pf-channel-figures">{figures.join(" · ")}</p>}
        </div>
      </div>
      {channel?.description && <p className="pf-channel-about">{channel.description}</p>}
      <div className="pf-channel-actions">
        <a
          className="pf-channel-subscribe"
          href={channel ? subscribeUrl(channel.id) : link.url}
          target="_blank"
          rel="noreferrer"
        >
          <SocialPlatformIcon url="https://www.youtube.com/" size={16} />
          {text("Đăng ký", "Subscribe")}
        </a>
        <a className="cp-button" href={channel?.url ?? link.url} target="_blank" rel="noreferrer">
          {text("Mở YouTube", "Open YouTube")}
          <StreamIcon name="external" size={14} />
        </a>
      </div>
    </header>
  )
}

/** The pressed video, playing above the list; it stays at the top while the reader looks for the next one. */
function Player({ video, onClose }: { video: YouTubeVideo; onClose: () => void }) {
  const { text } = useStreamLocale()
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => frame.current?.focus(), [video.id])
  return (
    <div className="pf-channel-player" data-short={video.shortForm || undefined}>
      <div className="pf-channel-frame">
        <iframe
          ref={frame}
          key={video.id}
          src={playerUrl(video.id)}
          title={video.title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <div className="pf-channel-playing">
        <strong>{video.title}</strong>
        <a
          className="hub-icon-button"
          href={watchUrl(video.id)}
          target="_blank"
          rel="noreferrer"
          aria-label={text("Xem trên YouTube", "Watch on YouTube")}
        >
          <StreamIcon name="external" size={14} />
        </a>
        <button
          type="button"
          className="hub-icon-button"
          aria-label={text("Tắt video", "Close video")}
          onClick={onClose}
        >
          <StreamIcon name="close" size={14} />
        </button>
      </div>
    </div>
  )
}
