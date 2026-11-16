import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CommunityProfile, PageSlice } from "@aov/community-contracts"
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { Avatar, hueOf, TimeAgo } from "./community-ui"

/** Pages broadcasting now; refreshed every minute so ended broadcasts drop out. */
export function useLivePages(size = 6) {
  return useQuery({
    queryKey: ["live-pages", size],
    queryFn: () => communityApi<PageSlice<CommunityProfile>>(`/live?size=${size}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/** A row of live pages; nothing is rendered while nobody is live. */
export function LiveRow({ title }: { title?: string }) {
  const { text } = useStreamLocale()
  const live = useLivePages()
  const items = (live.data?.items || []).filter((page) => page.live)
  if (!items.length) return null
  return (
    <section className="cp-live-row" aria-labelledby="live-row">
      <div className="hub-card-heading">
        <h2 id="live-row" className="hub-card-title">
          {title ?? text("Đang trực tiếp", "Live now")}{" "}
          <span className="cp-meta">
            {text(`· ${items.length} kênh`, `· ${items.length} ${items.length === 1 ? "channel" : "channels"}`)}
          </span>
        </h2>
      </div>
      <div className="cp-live-cards">
        {items.map((page) => {
          const name = page.content?.name || page.code
          const cover = page.content?.coverUrl
          return (
            <Link key={page.id} to={`/pages/${page.code}`} className="cp-live-card">
              <span
                className="cp-live-thumb hub-art"
                style={
                  {
                    "--hub-hue": hueOf(name),
                    ...(cover ? { backgroundImage: `url(${JSON.stringify(cover)})` } : {}),
                  } as CSSProperties
                }
              >
                <span className="cp-live-badge">{text("Trực tiếp", "Live")}</span>
              </span>
              <span className="cp-live-meta">
                <Avatar profile={page} />
                <span>
                  <strong>{page.live!.title}</strong>
                  <small>
                    {name} · <TimeAgo value={page.live!.startedAt} />
                  </small>
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
