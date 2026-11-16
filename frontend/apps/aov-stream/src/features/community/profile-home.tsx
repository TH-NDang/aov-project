import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CommunityProfile, CompetitionView, PageLive } from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { matchStrip } from "../tournaments/competition-model"
import { MatchCard } from "../tournaments/match-card"
import { communityApi } from "./community-api"
import { timeAgo } from "./community-ui"
import { PostVideo } from "./post-media"
import { profileMatches } from "./public-competitions"

/** The broadcast at the top of a page while it is live. The page head carries the live mark. */
export function LiveBlock({ live, name }: { live: PageLive; name: string }) {
  const { text, languageTag } = useStreamLocale()
  return (
    <section className="pf-live" aria-labelledby="page-live">
      <h2 id="page-live">{live.title}</h2>
      <p>
        <span>
          {text("Bắt đầu", "Started")}{" "}
          <LocalTime
            value={live.startedAt}
            locale={languageTag}
            label={(zone) => timeAgo(live.startedAt, Date.now(), zone, languageTag).toLowerCase()}
          />
        </span>
      </p>
      <PostVideo url={live.url} title={`${name} · ${live.title}`} />
    </section>
  )
}

/**
 * The matches a page's reader wants first: what is on or ahead, then the latest results, as on the home page.
 * `views` are the page's newest competitions; `pending` holds the block's place while they load. `more` opens the
 * full list. Matches of one competition name it once in the heading instead of on every card.
 */
export function ProfileMatches({
  profile,
  views,
  pending,
  more,
}: {
  profile: CommunityProfile
  views: CompetitionView[]
  pending: boolean
  more: () => void
}) {
  const { text } = useStreamLocale()
  // A row of four on a wide layout; two on a compact one, where each match takes a row of its own.
  const compact = usePageLayout() === "compact"
  const count = compact ? 2 : 4
  if (pending)
    return (
      <div className="tn-match-grid" role="status" aria-label="Đang tải trận đấu">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="tn-match hub-skeleton pf-match-skeleton" />
        ))}
      </div>
    )
  const shown = matchStrip(profileMatches(profile, views), Date.now(), count, count).slice(0, count)
  if (!shown.length) return null
  const single = shown.every((entry) => entry.competition.id === shown[0]!.competition.id)
  const competition = single ? shown[0]!.competition.content.tournament.name : null
  return (
    <section aria-labelledby="profile-matches">
      <div className="tn-heading">
        <h2 id="profile-matches">
          {text("Trận đấu", "Matches")} {competition && !compact && <small>{competition}</small>}
        </h2>
        <button type="button" onClick={more}>
          {profile.kind === "ORGANIZATION"
            ? text("Giải đấu", "Tournaments")
            : text("Lịch & kết quả", "Schedule & results")}
          <StreamIcon name="arrow" size={15} />
        </button>
      </div>
      {/* Beside the title a long name would break in two on a narrow screen, so there it takes its own line. */}
      {competition && compact && <p className="pf-heading-note">{competition}</p>}
      <div className="tn-match-grid">
        {shown.map((entry) => (
          <MatchCard key={`${entry.competition.id}:${entry.match.key}`} entry={entry} context={!single} brief />
        ))}
      </div>
    </section>
  )
}

/** Lets a page's owner or editor announce, change or end a live broadcast. */
export function LiveControl({ profile }: { profile: CommunityProfile }) {
  const { text } = useStreamLocale()
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
        className={profile.live ? "cp-button pf-live-button" : "cp-button"}
        onClick={() => {
          setUrl(profile.live?.url || "")
          setTitle(profile.live?.title || "")
          setOpen(true)
        }}
      >
        <StreamIcon name="play" size={16} />
        {profile.live ? text("Đang phát", "Broadcasting") : text("Phát trực tiếp", "Go live")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="pf-live-dialog">
          <DialogTitle className="cp-dialog-title">
            {profile.live ? text("Đang phát trực tiếp", "Broadcasting live") : text("Phát trực tiếp", "Go live")}
          </DialogTitle>
          <DialogDescription className="cp-dialog-text">
            {text(
              "Dán link buổi phát trên YouTube, Facebook hoặc TikTok. Người theo dõi nhận thông báo khi bạn bật; trạng thái tự tắt sau 12 giờ.",
              "Paste the link to the broadcast on YouTube, Facebook or TikTok. Followers are notified when you turn it on; the status turns itself off after 12 hours.",
            )}
          </DialogDescription>
          <form
            className="pf-live-form"
            onSubmit={(event) => {
              event.preventDefault()
              start.mutate()
            }}
          >
            <label>
              {text("Link buổi phát", "Broadcast link")}
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
              {text("Tiêu đề", "Title")}
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={text("ĐTDV mùa Đông · Tuần 3", "AOG Winter · Week 3")}
              />
            </label>
            <div className="cp-dialog-actions">
              <button className="cp-button cp-primary" disabled={start.isPending}>
                {profile.live ? text("Cập nhật", "Update") : text("Bật trực tiếp", "Turn live on")}
              </button>
              {profile.live && (
                <button type="button" className="cp-button" disabled={end.isPending} onClick={() => end.mutate()}>
                  {text("Tắt trực tiếp", "Turn live off")}
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
