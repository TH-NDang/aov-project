import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CommunityProfile } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { communityKeys } from "./community-keys"
import { Avatar, TimeAgo } from "./community-ui"
import { videoEmbed, videoPoster } from "./post-media-model"
import "./community-live.css"

/** Pages broadcasting now; refreshed every minute so ended broadcasts drop out. */
export function useLivePages(size = 6) {
  return useQuery({
    queryKey: communityKeys.livePages(size),
    queryFn: () => communityApi.livePages(size),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** The 16:9 picture YouTube keeps for a video link. Other platforms offer none without asking them. */
export function videoThumbnail(url?: string | null) {
  const embed = url ? videoEmbed(url) : null
  return embed ? videoPoster(embed, "mqdefault") : null
}

/** Each broadcast as a card: its picture, the live mark, the title and the page it is on. */
export function LiveCards({ pages }: { pages: CommunityProfile[] }) {
  const { text } = useStreamLocale()
  return (
    <div className="lv-cards">
      {pages.map((page) => {
        const live = page.live!
        const picture = videoThumbnail(live.url) || page.content?.coverUrl
        return (
          <Link key={page.id} to={`/pages/${page.code}`} className="lv-card">
            <div className="lv-thumb">
              {picture ? <img src={picture} alt="" loading="lazy" /> : <StreamIcon name="play" size={24} />}
            </div>
            <div className="lv-body">
              <span className="tn-live">{text("Trực tiếp", "Live")}</span>
              <strong>{live.title}</strong>
              <div className="lv-page">
                <Avatar profile={page} />
                <span>{page.content?.name || page.code}</span>
                <span className="lv-since">
                  <TimeAgo value={live.startedAt} />
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

/** The broadcasts above the home feed; nothing is rendered while nobody is live. */
export function LiveRow() {
  const { text } = useStreamLocale()
  const live = useLivePages()
  const items = (live.data?.items || []).filter((page) => page.live)
  if (!items.length) return null
  return (
    <section className="lv-row" aria-labelledby="live-row">
      <h2 id="live-row" className="hub-card-title">
        {text("Đang trực tiếp", "Live now")}{" "}
        <span className="cp-meta">
          {text(`· ${items.length} kênh`, `· ${items.length} ${items.length === 1 ? "channel" : "channels"}`)}
        </span>
      </h2>
      <LiveCards pages={items} />
    </section>
  )
}
