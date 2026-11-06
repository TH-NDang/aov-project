import type { CSSProperties } from "react"
import { infiniteQueryOptions, useQuery } from "@tanstack/react-query"
import type {
  CommunityProfile,
  CompetitionView,
  PageSlice,
  ProfileKind,
  TournamentContent,
} from "@aov/community-contracts"
import type { StreamIconName } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { nextPageOf } from "@aov/ui/lib/page-slice"

export const kindIcons: Record<ProfileKind, StreamIconName> = {
  CIRCUIT: "trophy",
  ORGANIZATION: "building",
  TEAM: "shield",
  PLAYER: "user",
  PERSON: "user",
}

/** A stable hue per name, so pages and competitions without artwork still get distinct covers. */
export function hueOf(text: string) {
  let hash = 0
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return Math.abs(hash) % 360
}

const dayFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
})

/** Formats an ISO calendar date (yyyy-mm-dd) without shifting it through the viewer's time zone. */
export function formatDay(value?: string | null) {
  if (!value) return ""
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : dayFormat.format(date)
}

export function dayRange(startsOn?: string | null, endsOn?: string | null, fallback = "Chưa xác định lịch") {
  const start = formatDay(startsOn)
  const end = formatDay(endsOn)
  if (!start && !end) return fallback
  return `${start || "Chưa rõ"} – ${end || "Chưa rõ"}`
}

export type CompetitionStatus = "ONGOING" | "UPCOMING" | "ANNOUNCED" | "FINISHED"
export const competitionStatusLabels: Record<CompetitionStatus, string> = {
  ONGOING: "Đang diễn ra",
  UPCOMING: "Sắp diễn ra",
  ANNOUNCED: "Đã công bố",
  FINISHED: "Đã kết thúc",
}

/** Uses the edited status when there is one; otherwise reads it from the published dates. */
export function competitionStatus(tournament: TournamentContent, today = new Date().toISOString().slice(0, 10)) {
  if (tournament.status && tournament.status !== "UNKNOWN") return tournament.status as CompetitionStatus
  const { startsOn, endsOn } = tournament
  if (endsOn && endsOn.slice(0, 10) < today) return "FINISHED"
  if (startsOn && startsOn.slice(0, 10) > today) return "UPCOMING"
  if (startsOn && (!endsOn || endsOn.slice(0, 10) >= today)) return "ONGOING"
  return null
}

export function competitionsQuery(filter: Record<string, string>, page: number, size = 12) {
  return {
    queryKey: ["published-competitions", filter, page, size],
    queryFn: () =>
      communityApi<PageSlice<CompetitionView>>(
        `/competitions?${new URLSearchParams({ ...filter, page: String(page), size: String(size) })}`,
      ),
    staleTime: 60_000,
  }
}

/** Published competitions for a list that keeps loading as the reader scrolls. */
export function competitionsFeedQuery(filter: Record<string, string>, size = 12) {
  return infiniteQueryOptions({
    queryKey: ["published-competitions", "feed", filter, size],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      communityApi<PageSlice<CompetitionView>>(
        `/competitions?${new URLSearchParams({ ...filter, page: String(pageParam), size: String(size) })}`,
      ),
    getNextPageParam: nextPageOf,
    staleTime: 60_000,
  })
}

/** The first published competitions, shared by the home banner, the home list and the side rail. */
export const useFeaturedCompetitions = () => useQuery(competitionsQuery({}, 0))

export function Avatar({ profile, className = "" }: { profile: CommunityProfile; className?: string }) {
  const name = profile.content?.name || profile.code
  return profile.content?.avatarUrl ? (
    <img className={`cp-avatar ${className}`} src={profile.content.avatarUrl} alt="" />
  ) : (
    <div
      className={`cp-avatar cp-initial ${className}`}
      style={{ "--hub-hue": hueOf(name) } as CSSProperties}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase() || "AH"}
    </div>
  )
}

export function followersLabel(count: number) {
  return `${count.toLocaleString("vi-VN")} người theo dõi`
}

/** A page's avatar from its feed card; pages without artwork get initials on a colour from their name. */
export function CardAvatar({ name, url, className = "" }: { name: string; url?: string | null; className?: string }) {
  return url ? (
    <img className={`cp-avatar ${className}`} src={url} alt="" />
  ) : (
    <span
      className={`cp-avatar cp-initial ${className}`}
      style={{ "--hub-hue": hueOf(name) } as CSSProperties}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase() || "AH"}
    </span>
  )
}

const relativeTime = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" })
const postDate = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })

/** Recent moments read as relative minutes, hours or days; anything older than a week shows its date. */
export function timeAgo(value: string, now = Date.now()) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  if (Number.isNaN(seconds)) return ""
  if (seconds > -60) return "Vừa xong"
  if (seconds > -3600) return relativeTime.format(Math.round(seconds / 60), "minute")
  if (seconds > -86400) return relativeTime.format(Math.round(seconds / 3600), "hour")
  if (seconds > -7 * 86400) return relativeTime.format(Math.round(seconds / 86400), "day")
  return postDate.format(new Date(value))
}
