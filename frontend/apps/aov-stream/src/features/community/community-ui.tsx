import type { CSSProperties } from "react"
import { infiniteQueryOptions, useQuery } from "@tanstack/react-query"
import type { CommunityProfile, CompetitionView, PageSlice, PersonRole, ProfileKind } from "@aov/community-contracts"
import { streamLanguageTag, streamText, useStreamLocale } from "../../components/stream-locale"
import type { CompetitionStatus } from "../tournaments/competition-model"
import { communityApi } from "./community-api"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { LocalTime } from "@aov/ui/components/local-time"
import { knownCountryName } from "@aov/ui/lib/country-references"
import { currentTimeZone, formatCalendarDate, formatInZone } from "@aov/ui/lib/time-zone"

/** The English name of each page kind; `profileKindLabels` in the shared contracts holds the Vietnamese one. */
export const profileKindEnglish: Record<ProfileKind, string> = {
  CIRCUIT: "Tournament circuit",
  ORGANIZATION: "Organization",
  TEAM: "Team",
  PLAYER: "Player",
  PERSON: "Staff",
}

/** English names of the staff roles: `personRoleLabels` in the shared contracts carries the Vietnamese ones only. */
export const personRoleEnglish: Record<PersonRole, string> = {
  COACH: "Coach",
  TEAM_ANALYST: "Team analyst",
  HOST: "Host",
  INTERVIEWER: "Interviewer",
  CASTER: "Caster",
  GUEST_ANALYST: "Guest analyst",
}

const regionCode = /^[A-Z]{2}$/
const regionNamesByLocale = new Map<string, Intl.DisplayNames>()
function regionNamesIn(locale: string) {
  let names = regionNamesByLocale.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region", style: "short" })
    regionNamesByLocale.set(locale, names)
  }
  return names
}

/**
 * The name of a two-letter country code in the reader's language. A country written out in words is kept as written,
 * except that English readers get the countries this app knows in English.
 */
export function regionName(country?: string | null, locale: string = streamLanguageTag()) {
  const value = country?.trim()
  if (!value) return null
  if (regionCode.test(value)) return regionNamesIn(locale).of(value) || value
  // Editors also type the name in Vietnamese; English readers get the countries this app knows in English.
  return locale.startsWith("en") ? (knownCountryName(value, locale) ?? value) : value
}

/**
 * Countries some pages spell out instead of giving their code, so both spellings count as one region. Pages store the
 * Vietnamese spelling, so the names are matched in Vietnamese whatever the reader's language.
 */
const regionCodesByName = new Map(
  ["VN", "TH", "TW", "HK", "MO", "ID", "SG", "MY", "PH", "JP", "KR", "CN", "LA", "KH", "MM", "IN", "US", "GB"].map(
    (code) => [regionNamesIn("vi").of(code)!.toLowerCase(), code],
  ),
)

/** What a page's country is filed under: its code when it has one, the written name otherwise, "" when unrecorded. */
export function regionKey(country?: string | null) {
  const value = country?.trim()
  if (!value) return ""
  return regionCode.test(value) ? value : (regionCodesByName.get(value.toLowerCase()) ?? value)
}

/** How the competition list is narrowed to one page: its seasons, what it organizes or what it took part in. */
export function profileCompetitionFilter(profile: CommunityProfile): Record<string, string> | null {
  if (profile.kind === "CIRCUIT") return { circuitPageId: profile.id }
  if (profile.kind === "ORGANIZATION") return { organizerPageId: profile.id }
  if (profile.kind === "TEAM" && profile.entityId) return { teamId: profile.entityId }
  if (profile.kind === "PLAYER" && profile.entityId) return { playerId: profile.entityId }
  return null
}

/** A stable hue per name, so pages and competitions without artwork still get distinct covers. */
export function hueOf(text: string) {
  let hash = 0
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return Math.abs(hash) % 360
}

/** Formats an ISO calendar date (yyyy-mm-dd) without shifting it through the viewer's time zone. */
export function formatDay(value?: string | null) {
  if (!value) return ""
  return formatCalendarDate(value.slice(0, 10), undefined, streamLanguageTag())
}

export function dayRange(
  startsOn?: string | null,
  endsOn?: string | null,
  fallback = streamText("Chưa xác định lịch", "Schedule to be announced"),
) {
  const start = formatDay(startsOn)
  const end = formatDay(endsOn)
  if (!start && !end) return fallback
  if (start === end) return start
  const unknown = streamText("Chưa rõ", "Unknown")
  return `${start || unknown} – ${end || unknown}`
}

const COMPETITION_STATUS_NAMES: Record<CompetitionStatus, readonly [string, string]> = {
  ONGOING: ["Đang diễn ra", "Ongoing"],
  UPCOMING: ["Sắp diễn ra", "Upcoming"],
  ANNOUNCED: ["Đã công bố", "Announced"],
  FINISHED: ["Đã kết thúc", "Finished"],
}

/** The status names in the reader's language. Call it while rendering so a language change shows at once. */
export function competitionStatusLabels() {
  return Object.fromEntries(
    Object.entries(COMPETITION_STATUS_NAMES).map(([status, names]) => [status, streamText(...names)]),
  ) as Record<CompetitionStatus, string>
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
  const value = count.toLocaleString(streamLanguageTag())
  return streamText(`${value} người theo dõi`, `${value} ${count === 1 ? "follower" : "followers"}`)
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

const relativeTimes = new Map<string, Intl.RelativeTimeFormat>()
function relativeTimeIn(locale: string) {
  let format = relativeTimes.get(locale)
  if (!format) relativeTimes.set(locale, (format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })))
  return format
}

/** Recent moments read as relative minutes, hours or days; anything older than a week shows its date. */
export function timeAgo(
  value: string,
  now = Date.now(),
  timeZone = currentTimeZone(),
  locale: string = streamLanguageTag(),
) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  if (Number.isNaN(seconds)) return ""
  const relativeTime = relativeTimeIn(locale)
  if (seconds > -60) return locale.startsWith("en") ? "Just now" : "Vừa xong"
  if (seconds > -3600) return relativeTime.format(Math.round(seconds / 60), "minute")
  if (seconds > -86400) return relativeTime.format(Math.round(seconds / 3600), "hour")
  if (seconds > -7 * 86400) return relativeTime.format(Math.round(seconds / 86400), "day")
  return formatInZone(value, timeZone, { day: "2-digit", month: "2-digit", year: "numeric" }, locale)
}

/** The relative time of a post or notification, which opens its exact time. These moments have no zone of their own. */
export function TimeAgo({ value, className }: { value: string; className?: string }) {
  const { languageTag } = useStreamLocale()
  return (
    <LocalTime
      value={value}
      className={className}
      locale={languageTag}
      label={(zone) => timeAgo(value, Date.now(), zone, languageTag)}
    />
  )
}
