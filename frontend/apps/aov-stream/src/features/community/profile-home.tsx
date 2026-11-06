import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityProfile, PageLive } from "@aov/community-contracts"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { competitionsQuery, timeAgo } from "./community-ui"
import { LocalTime } from "@aov/ui/components/local-time"
import { PostVideo } from "./post-media"
import { MATCH_WINDOW, scheduledMatches } from "./schedule-model"
import { competitionMatchHref } from "../tournaments/match-model"

/** The broadcast pinned to the top of a page while it is live. */
export function LiveBlock({ live, name }: { live: PageLive; name: string }) {
  return (
    <section className="cp-panel cp-live-block" aria-labelledby="page-live">
      <div className="cp-live-heading">
        <span className="cp-live-badge">Trực tiếp</span>
        <h2 id="page-live">{live.title}</h2>
        <span className="cp-meta">
          Bắt đầu{" "}
          <LocalTime value={live.startedAt} label={(zone) => timeAgo(live.startedAt, Date.now(), zone).toLowerCase()} />
        </span>
      </div>
      <PostVideo url={live.url} title={`${name} · ${live.title}`} />
    </section>
  )
}

/** The competitions a page takes part in or organizes, as filters for the published competition list. */
function competitionFilter(profile: CommunityProfile): Record<string, string> | null {
  if (profile.kind === "ORGANIZATION") return { organizerPageId: profile.id }
  if (profile.kind === "TEAM" && profile.entityId) return { teamId: profile.entityId }
  if (profile.kind === "PLAYER" && profile.entityId) return { playerId: profile.entityId }
  return null
}

/** The page's next matches; teams only see the matches they play. */
export function PageUpcoming({ profile }: { profile: CommunityProfile }) {
  const filter = competitionFilter(profile)
  const competitions = useQuery({ ...competitionsQuery(filter || {}, 0, 24), enabled: !!filter })
  const now = Date.now()
  const team = profile.kind === "TEAM" ? profile.entityId : null
  const upcoming = scheduledMatches(competitions.data?.items || [])
    .filter((match) => match.at + MATCH_WINDOW > now)
    .filter((match) => !team || match.teamAId === team || match.teamBId === team)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
  if (!upcoming.length) return null
  const format: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }
  return (
    <section className="cp-panel" aria-labelledby="page-upcoming">
      <h2 id="page-upcoming">Sắp diễn ra</h2>
      <ul className="cp-schedule">
        {upcoming.map((match) => {
          const scored = match.scoreA != null && match.scoreB != null
          return (
            <li key={match.key}>
              <Link to={competitionMatchHref(match.competitionId, match.matchKey)}>
                <span className="cp-schedule-time">
                  {!scored && match.at <= now ? (
                    <span className="cp-live-badge">Đang diễn ra</span>
                  ) : (
                    <LocalTime value={match.at} sourceTimeZone={match.timeZone} format={format} />
                  )}
                </span>
                <span className="cp-schedule-match">
                  <strong>
                    {match.teamA} {scored ? `${match.scoreA} – ${match.scoreB}` : "vs"} {match.teamB}
                  </strong>
                  <small>{match.tournament}</small>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Three numbers under the header of team and player pages. */
export function ProfileStats({ profile }: { profile: CommunityProfile }) {
  const filter = competitionFilter(profile)
  const competitions = useQuery({ ...competitionsQuery(filter || {}, 0, 1), enabled: !!filter })
  const content = profile.content!
  if (profile.kind !== "TEAM" && profile.kind !== "PLAYER") return null
  const stats: [string, number | string][] = [
    ["Giải đã tham gia", competitions.data?.totalElements ?? "—"],
    ["Thành tích", content.achievements.length],
    profile.kind === "TEAM" ? ["Thành viên", content.roster.length] : ["Mốc sự nghiệp", content.history.length],
  ]
  return (
    <dl className="cp-profile-stats">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Lets a page's owner or editor announce, change or end a live broadcast. */
export function LiveControl({ profile }: { profile: CommunityProfile }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["public-page"] })
    await client.invalidateQueries({ queryKey: ["live-pages"] })
  }
  const start = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/live`, { url, title }, "PUT"),
    onSuccess: async () => {
      setOpen(false)
      await refresh()
    },
  })
  const end = useMutation({
    mutationFn: () => communityApi(`/me/pages/${profile.id}/live/end`, {}),
    onSuccess: async () => {
      setOpen(false)
      await refresh()
    },
  })
  const failure = start.error || end.error
  return (
    <>
      <button
        type="button"
        className={profile.live ? "cp-button cp-live-button" : "cp-button"}
        onClick={() => {
          setUrl(profile.live?.url || "")
          setTitle(profile.live?.title || "")
          setOpen(true)
        }}
      >
        <StreamIcon name="play" size={16} />
        {profile.live ? "Đang phát" : "Phát trực tiếp"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="cp-live-dialog">
          <DialogTitle className="cp-dialog-title">
            {profile.live ? "Đang phát trực tiếp" : "Phát trực tiếp"}
          </DialogTitle>
          <DialogDescription className="cp-dialog-text">
            Dán link buổi phát trên YouTube, Facebook hoặc TikTok. Người theo dõi nhận thông báo khi bạn bật; trạng thái
            tự tắt sau 12 giờ.
          </DialogDescription>
          <form
            className="cp-live-form"
            onSubmit={(event) => {
              event.preventDefault()
              start.mutate()
            }}
          >
            <label>
              Link buổi phát
              <input
                required
                type="url"
                maxLength={2000}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/live/…"
              />
            </label>
            <label>
              Tiêu đề
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="ĐTDV mùa Đông · Tuần 3"
              />
            </label>
            <div className="cp-dialog-actions">
              <button className="cp-button cp-primary" disabled={start.isPending}>
                {profile.live ? "Cập nhật" : "Bật trực tiếp"}
              </button>
              {profile.live && (
                <button type="button" className="cp-button" disabled={end.isPending} onClick={() => end.mutate()}>
                  Tắt trực tiếp
                </button>
              )}
            </div>
            {failure && (
              <p className="cp-error" role="alert">
                {failure.message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
