import { queryOptions } from "@tanstack/react-query"
import { wikiAccessToken } from "../auth/wiki-auth"
import type { GuideContent, LineupUnit, ModeImage, RuleSection } from "./auto-chess-model"

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

export class ModeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = "ModeRequestError"
  }
}

const BASE = "/api/wiki/v1/game-modes"
/** The signed-in reader's routes live under `/users/me`, like the rest of what belongs to a reader. */
const READER_BASE = "/api/wiki/v1/users/me/game-modes"

async function readPublic<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { signal, credentials: "omit" })
  if (!response.ok) throw await failure(response)
  return response.json()
}

async function failure(response: Response) {
  let code: string | undefined
  let detail = ""
  try {
    const problem = (await response.json()) as { code?: string; detail?: string }
    code = problem.code
    detail = problem.detail ?? ""
  } catch {
    // A body that is not problem JSON keeps the status only.
  }
  return new ModeRequestError(response.status, code, detail || `Request failed with ${response.status}`)
}

/** Requests of the signed-in reader; the token never goes to public reads, so those stay cacheable. */
async function readPersonal<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await wikiAccessToken()
  if (!token) throw new ModeRequestError(401, undefined, "Sign in first.")
  const response = await fetch(`${READER_BASE}${path}`, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store",
  })
  if (!response.ok) throw await failure(response)
  return response.status === 204 ? (undefined as T) : response.json()
}

export const modeCardsQuery = () =>
  queryOptions({
    queryKey: ["wiki", "game-modes"],
    queryFn: ({ signal }) => readPublic<{ items: ModeCard[] }>("", signal),
    staleTime: 60_000,
  })

export const modeQuery = (code: string) =>
  queryOptions({
    queryKey: ["wiki", "game-mode", code],
    queryFn: ({ signal }) => readPublic<PublicMode>(`/${encodeURIComponent(code)}`, signal),
    staleTime: 60_000,
    retry: (count, error) => !(error instanceof ModeRequestError && error.status === 404) && count < 1,
  })

export const guideQuery = (code: string) =>
  queryOptions({
    queryKey: ["wiki", "game-mode", code, "auto-chess"],
    queryFn: ({ signal }) => readPublic<PublicGuide>(`/${encodeURIComponent(code)}/auto-chess`, signal),
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof ModeRequestError && error.status === 404) && count < 1,
  })

export const communityLineupsQuery = (code: string, sort: LineupSort, unit: string | null, page: number) =>
  queryOptions({
    queryKey: ["wiki", "game-mode", code, "community", sort, unit, page],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ sort, page: String(page), size: "12" })
      if (unit) params.set("unit", unit)
      return readPublic<PageSlice<CommunityLineup>>(`/${encodeURIComponent(code)}/auto-chess/lineups?${params}`, signal)
    },
    staleTime: 15_000,
  })

export const insightsQuery = (code: string) =>
  queryOptions({
    queryKey: ["wiki", "game-mode", code, "insights"],
    queryFn: ({ signal }) => readPublic<Insights>(`/${encodeURIComponent(code)}/auto-chess/insights`, signal),
    staleTime: 60_000,
  })

export const myStateQuery = (code: string, revision: number) =>
  queryOptions({
    queryKey: ["wiki", "game-mode", code, "me", revision],
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
  return readPersonal<OwnLineup>(path, { method: lineupId ? "PUT" : "POST", body: JSON.stringify(input) })
}

export function deleteLineup(code: string, lineupId: string, expectedVersion: number) {
  return readPersonal<void>(
    `/${encodeURIComponent(code)}/auto-chess/lineups/${encodeURIComponent(lineupId)}?expectedVersion=${expectedVersion}`,
    { method: "DELETE" },
  )
}

/** Vietnamese messages for the errors a reader can cause. */
export function lineupErrorMessage(error: unknown) {
  if (!(error instanceof ModeRequestError)) return "Không kết nối được máy chủ. Thử lại sau."
  if (error.status === 401) return "Đăng nhập để thích hoặc lưu đội hình."
  if (error.status === 429) return "Bạn thao tác quá nhanh. Đợi một lát rồi thử lại."
  if (error.status === 403) return "Tài khoản này không được thao tác với đội hình."
  if (error.status === 409) return "Đội hình vừa thay đổi ở nơi khác. Tải lại trang rồi thử lại."
  if (error.code === "GAME_MODE_LINEUP_NOT_FOUND") return "Đội hình không còn hiển thị."
  if (error.status === 422)
    return error.message.includes("own")
      ? "Bạn không thể thích đội hình của chính mình."
      : "Đội hình chưa hợp lệ hoặc bạn đã lưu tối đa 30 đội hình."
  return "Có lỗi xảy ra. Thử lại sau."
}
