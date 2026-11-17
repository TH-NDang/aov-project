import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { wikiAccessToken } from "../auth/wiki-auth"
import type { GuideContent, LineupUnit, ModeImage, RuleSection } from "./auto-chess-model"
import { WikiApiError, wikiGet, wikiRequest, type WikiRequest } from "../../lib/wiki-api"

export interface ModeAvailability {
  status: "ALWAYS_OPEN" | "LIMITED" | "SPECIAL" | "CLOSED" | "LOCKED" | "UNKNOWN"
  gameLabel?: string | null
  startsOn?: string | null
  endsOn?: string | null
  observedOn?: string | null
  note?: string | null
}

export interface ModeDuration {
  minMinutes?: number | null
  maxMinutes?: number | null
}

export interface ModeCard {
  code: string
  name: string
  group: "PVP" | "ENTERTAINMENT"
  order?: number | null
  summary?: string | null
  playersLabel?: string | null
  duration?: ModeDuration | null
  availability?: ModeAvailability | null
  guideKind: "NONE" | "AUTO_CHESS"
  hasGuide: boolean
  art?: ModeImage | null
  publishedAt: string
}

export interface ModeContent {
  name: string
  group: "PVP" | "ENTERTAINMENT"
  order?: number | null
  summary?: string | null
  playersLabel?: string | null
  duration?: ModeDuration | null
  availability?: ModeAvailability | null
  artAssetId?: string | null
  guideKind: "NONE" | "AUTO_CHESS"
  rules: RuleSection[]
  heroes: { heroCode?: string | null; name: string; note?: string | null }[]
  specialItems: { name: string; description?: string | null; iconAssetId?: string | null }[]
  sources: { label: string; url?: string | null; observedOn?: string | null }[]
}

export interface PublicMode {
  code: string
  contentLocale: string
  publishedAt: string
  hasGuide: boolean
  content: ModeContent
  images: Record<string, ModeImage>
}

export interface LikeCount {
  likes: number
  recentLikes: number
}

export interface PublicGuide {
  modeCode: string
  modeName: string
  contentLocale: string
  revisionId: string
  publishedAt: string
  content: GuideContent
  images: Record<string, ModeImage>
  lineupLikes: Record<string, LikeCount>
}

export interface CommunityLineup {
  id: string
  name: string
  note?: string | null
  units: LineupUnit[]
  emblems: string[]
  likes: number
  recentLikes: number
  createdAt: string
  updatedAt: string
}

export interface OwnLineup extends Omit<CommunityLineup, "recentLikes"> {
  status: "VISIBLE" | "HIDDEN"
  version: number
}

export interface MyState {
  likedLineupIds: string[]
  lineups: OwnLineup[]
}

export interface PageSlice<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
}

export interface Insights {
  lineupCount: number
  communityLineupCount: number
  units: { code: string; appearances: number; weighted: number; carryCount: number }[]
  traits: { code: string; activations: number; topTierReached: number }[]
  costs: { cost: number; count: number }[]
}

export type LineupSort = "popular" | "trending" | "recent"

const BASE = "/game-modes"
/** The signed-in reader's routes live under `/users/me`, like the rest of what belongs to a reader. */
const READER_BASE = "/users/me/game-modes"

/**
 * Every query key of game modes; reads and invalidation both use these. A mode's key starts all of its other keys, so
 * invalidating it refreshes the guide, the lineups, the statistics and the reader's own state together.
 */
export const modeKeys = {
  cards: ["wiki", "game-modes"] as const,
  mode: (code: string) => ["wiki", "game-mode", code] as const,
  guide: (code: string) => [...modeKeys.mode(code), "auto-chess"] as const,
  community: (code: string, sort: string, unit: string | null | undefined) =>
    [...modeKeys.mode(code), "community", sort, unit] as const,
  insights: (code: string) => [...modeKeys.mode(code), "insights"] as const,
  mine: (code: string, revision: number) => [...modeKeys.mode(code), "me", revision] as const,
}

const readPublic = <T>(path: string, signal?: AbortSignal) => wikiGet<T>(`${BASE}${path}`, signal)

/** Requests of the signed-in reader; the token never goes to public reads, so those stay cacheable. */
async function readPersonal<T>(path: string, request: Pick<WikiRequest, "method" | "body"> = {}): Promise<T> {
  const token = await wikiAccessToken()
  if (!token) throw new WikiApiError(401, undefined, "Sign in first.")
  return wikiRequest<T>(`${READER_BASE}${path}`, { ...request, token })
}

export const modeCardsQuery = () =>
  queryOptions({
    queryKey: modeKeys.cards,
    queryFn: ({ signal }) => readPublic<{ items: ModeCard[] }>("", signal),
    staleTime: 60_000,
  })

export const modeQuery = (code: string) =>
  queryOptions({
    queryKey: modeKeys.mode(code),
    queryFn: ({ signal }) => readPublic<PublicMode>(`/${encodeURIComponent(code)}`, signal),
    staleTime: 60_000,
    retry: (count, error) => !(error instanceof WikiApiError && error.status === 404) && count < 1,
  })

export const guideQuery = (code: string) =>
  queryOptions({
    queryKey: modeKeys.guide(code),
    queryFn: ({ signal }) => readPublic<PublicGuide>(`/${encodeURIComponent(code)}/auto-chess`, signal),
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof WikiApiError && error.status === 404) && count < 1,
  })

/** Community lineups load page by page as the reader scrolls. */
export const communityLineupsQuery = (code: string, sort: LineupSort, unit: string | null) =>
  infiniteQueryOptions({
    queryKey: modeKeys.community(code, sort, unit),
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams({ sort, page: String(pageParam), size: "12" })
      if (unit) params.set("unit", unit)
      return readPublic<PageSlice<CommunityLineup>>(`/${encodeURIComponent(code)}/auto-chess/lineups?${params}`, signal)
    },
    initialPageParam: 0,
    getNextPageParam: nextPageOf,
    staleTime: 15_000,
  })

export const insightsQuery = (code: string) =>
  queryOptions({
    queryKey: modeKeys.insights(code),
    queryFn: ({ signal }) => readPublic<Insights>(`/${encodeURIComponent(code)}/auto-chess/insights`, signal),
    staleTime: 60_000,
  })

export const myStateQuery = (code: string, revision: number) =>
  queryOptions({
    queryKey: modeKeys.mine(code, revision),
    queryFn: () => readPersonal<MyState>(`/${encodeURIComponent(code)}/auto-chess`),
    staleTime: 15_000,
    retry: false,
  })

export function setLike(code: string, lineupId: string, liked: boolean) {
  return readPersonal<{ lineupId: string; liked: boolean; likes: number }>(
    `/${encodeURIComponent(code)}/auto-chess/likes/${encodeURIComponent(lineupId)}`,
    { method: liked ? "PUT" : "DELETE" },
  )
}

export interface SaveLineupInput {
  expectedVersion?: number
  name: string
  note?: string
  units: LineupUnit[]
  emblems: string[]
}

export function saveLineup(code: string, input: SaveLineupInput, lineupId?: string) {
  const path = `/${encodeURIComponent(code)}/auto-chess/lineups${lineupId ? `/${encodeURIComponent(lineupId)}` : ""}`
  return readPersonal<OwnLineup>(path, { method: lineupId ? "PUT" : "POST", body: input })
}

export function deleteLineup(code: string, lineupId: string, expectedVersion: number) {
  return readPersonal<void>(
    `/${encodeURIComponent(code)}/auto-chess/lineups/${encodeURIComponent(lineupId)}?expectedVersion=${expectedVersion}`,
    { method: "DELETE" },
  )
}

/** Messages for the errors a reader can cause, in the reader's language. */
export function lineupErrorMessage(error: unknown, locale = "vi-VN") {
  const text = (vietnamese: string, english: string) => (locale.startsWith("en") ? english : vietnamese)
  if (!(error instanceof WikiApiError))
    return text("Không kết nối được máy chủ. Thử lại sau.", "The server could not be reached. Try again later.")
  if (error.status === 401) return text("Đăng nhập để thích hoặc lưu đội hình.", "Sign in to like or save lineups.")
  if (error.status === 429)
    return text(
      "Bạn thao tác quá nhanh. Đợi một lát rồi thử lại.",
      "You are going too fast. Wait a moment, then try again.",
    )
  if (error.status === 403)
    return text("Tài khoản này không được thao tác với đội hình.", "This account is not allowed to change lineups.")
  if (error.status === 409)
    return text(
      "Đội hình vừa thay đổi ở nơi khác. Tải lại trang rồi thử lại.",
      "This lineup has just changed somewhere else. Reload the page, then try again.",
    )
  if (error.code === "GAME_MODE_LINEUP_NOT_FOUND")
    return text("Đội hình không còn hiển thị.", "This lineup is no longer shown.")
  if (error.status === 422)
    return error.message.includes("own")
      ? text("Bạn không thể thích đội hình của chính mình.", "You cannot like your own lineup.")
      : text(
          "Đội hình chưa hợp lệ hoặc bạn đã lưu tối đa 30 đội hình.",
          "The lineup is not valid, or you have already saved the maximum of 30 lineups.",
        )
  return text("Có lỗi xảy ra. Thử lại sau.", "Something went wrong. Try again later.")
}
