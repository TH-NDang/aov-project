import { backendRequest } from "@/app/auth/session"
import type { Request } from "../publishing/publishing-api"

export type RankingBoard = "RATES" | "FIGURES"
export type RankingRole = "TANK" | "WARRIOR" | "ASSASSIN" | "MAGE" | "MARKSMAN" | "SUPPORT"
export type RankingMetric =
  | "TIER"
  | "WIN_RATE"
  | "PICK_RATE"
  | "BAN_RATE"
  | "COUNTER_1"
  | "COUNTER_2"
  | "COUNTER_3"
  | "DAMAGE_DEALT"
  | "KILLS"
  | "GOLD"
  | "DAMAGE_TAKEN"
  | "ASSISTS"

/** An area of a screenshot, in the screenshot's own pixels. */
export interface RankingSource {
  imageId: string
  x: number
  y: number
  width: number
  height: number
}

export interface RankingValue {
  metric: RankingMetric
  number: number | null
  tier: string | null
  /** The hero a counter value points at. */
  heroId: string | null
  heroCode: string | null
  readText: string | null
  needsReview: boolean
  note: string | null
  source: RankingSource | null
  reviewedAt: string | null
  version: number
}

export interface RankingHero {
  heroId: string
  heroCode: string
  nameOnScreen: string
  roleOnScreen: RankingRole
  ratesPosition: number | null
  figuresPosition: number | null
  values: RankingValue[]
}

export interface RankingSummary {
  id: string
  code: string
  regionCode: string
  modeCode: string
  modeLabel: string
  periodLabel: string | null
  capturedAt: string
  sourceTimeZone: string
  confirmedAt: string | null
  heroCount: number
  valueCount: number
  needsReviewCount: number
  version: number
}

export interface RankingImage {
  imageId: string
  board: RankingBoard
  pageNo: number
  fileName: string
  width: number
  height: number
}

export interface RankingDetail extends RankingSummary {
  sourceRun: string
  sourceNote: string | null
  createdAt: string
  images: RankingImage[]
  heroes: RankingHero[]
}

export interface RankingPage {
  items: RankingSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface ReviewValue {
  expectedVersion: number
  number?: number | null
  tier?: string | null
  heroId?: string | null
  needsReview: boolean
  note?: string | null
}

export interface Reviewed {
  value: RankingValue
  snapshot: RankingSummary
}

/** A capture set the screenshot reader left in `resources/`, ready to import. */
export interface RankingCaptureSet {
  capturedOn: string
  code: string
  capturedAt: string
  sourceTimeZone: string
  modeLabel: string
  regionCode: string
  heroes: number
  values: number
  needsReview: number
  images: number
}

export const rankingKeys = {
  all: ["ranking-snapshots"] as const,
  list: ["ranking-snapshots", "list"] as const,
  detail: (id: string) => ["ranking-snapshots", "detail", id] as const,
  captureSets: ["ranking-snapshots", "capture-sets"] as const,
}

/** Snapshots are few (one per capture), so the newest hundred cover the picker and the comparison. */
const LIST_SIZE = 100

export function createRankingApi(request: Request = backendRequest) {
  return {
    list: (signal?: AbortSignal) => request<RankingPage>(`/admin/ranking-snapshots?size=${LIST_SIZE}`, { signal }),
    detail: (id: string, signal?: AbortSignal) => request<RankingDetail>(`/admin/ranking-snapshots/${id}`, { signal }),
    importSnapshot: (body: unknown) =>
      request<RankingDetail>("/admin/ranking-snapshots", { method: "POST", body: JSON.stringify(body) }),
    review: (snapshotId: string, heroId: string, metric: RankingMetric, body: ReviewValue) =>
      request<Reviewed>(`/admin/ranking-snapshots/${snapshotId}/heroes/${heroId}/values/${metric}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    confirm: (snapshot: RankingSummary) =>
      request<RankingSummary>(`/admin/ranking-snapshots/${snapshot.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: snapshot.version }),
      }),
    remove: (snapshot: RankingSummary) =>
      request<void>(`/admin/ranking-snapshots/${snapshot.id}?expectedVersion=${snapshot.version}`, {
        method: "DELETE",
      }),
  }
}

export const rankingApi = createRankingApi()

const CAPTURES = "/__ranking-captures"

/** Screenshots live only beside the dev server, so their address is local and never goes through the API. */
export const captureImageUrl = (imageId: string) => `${CAPTURES}/images/${imageId}.png`

/** Capture sets on this machine; null where the dev server has no `resources/` folder. */
export async function fetchCaptureSets(signal?: AbortSignal): Promise<RankingCaptureSet[] | null> {
  const response = await fetch(`${CAPTURES}/sets.json`, { signal }).catch(() => null)
  if (!response?.ok || !response.headers.get("Content-Type")?.includes("json")) return null
  return ((await response.json()) as { sets: RankingCaptureSet[] }).sets
}

export async function fetchCaptureSet(capturedOn: string): Promise<unknown> {
  const response = await fetch(`${CAPTURES}/sets/${capturedOn}.json`)
  if (!response.ok) throw new Error(`Không đọc được bộ ảnh ngày ${capturedOn}.`)
  return response.json()
}
