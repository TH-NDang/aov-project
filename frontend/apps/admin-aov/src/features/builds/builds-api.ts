import { backendRequest } from "@/app/auth/session"
import { fetchPublishedSets, isSourceAccessDenied } from "../files/capture-sets"
import type { Request } from "@/lib/api/publishing-api"

export type BuildSourceKind = "PRO" | "HOT" | "SYSTEM"
export type CaptureResult = "COLLECTED" | "NO_BUILDS" | "FAILED"

export interface BuildItem {
  slot: number
  itemId: string
  code: string | null
}

export interface BuildEnchantment {
  slot: number
  enchantmentId: string
  code: string | null
}

export interface BuildArcana {
  arcanaId: string
  code: string | null
  quantity: number
}

export interface Build {
  id: string
  position: number
  imageId: string | null
  items: BuildItem[]
  enchantmentSetId: string | null
  enchantments: BuildEnchantment[]
  arcanaPageId: string | null
  arcana: BuildArcana[]
  spellId: string | null
  spellCode: string | null
  contentKey: string | null
  playerName: string | null
  playerPower: number | null
  playerWinRate: number | null
  needsReview: boolean
  note: string | null
  reviewedAt: string | null
  version: number
}

export interface BuildHero {
  heroId: string
  heroCode: string | null
  nameOnScreen: string
  captureOrder: number
  result: CaptureResult
  builds: Build[]
}

export interface CaptureSummary {
  id: string
  code: string
  regionCode: string
  sourceKind: BuildSourceKind
  sourceLabel: string
  capturedAt: string
  sourceTimeZone: string
  patchVariantId: string | null
  patchCode: string | null
  confirmedAt: string | null
  heroCount: number
  buildCount: number
  needsReviewCount: number
  version: number
}

export interface CaptureDetail extends CaptureSummary {
  sourceRun: string
  sourceNote: string | null
  createdAt: string
  images: { imageId: string; fileName: string; width: number; height: number; layout: string }[]
  heroes: BuildHero[]
}

export interface CapturePage {
  items: CaptureSummary[]
  page: number
  size: number
  totalElements: number
}

/** Replaces the whole content of one build; an incomplete part keeps the build in review. */
export interface ReviewBuild {
  expectedVersion: number
  items: { slot: number; itemId: string }[]
  enchantments: { slot: number; enchantmentId: string }[]
  arcana: { arcanaId: string; quantity: number }[]
  spellId: string | null
  playerName: string | null
  playerPower: number | null
  playerWinRate: number | null
  needsReview: boolean
  note: string | null
}

export interface Reviewed {
  build: Build
  capture: CaptureSummary
}

/** A capture set published to the private bucket with the sync tool's publish-captures (ADR-030). */
export interface BuildCaptureSet {
  capturedOn: string
  code: string
  capturedAt: string
  sourceTimeZone: string
  sourceLabel: string
  regionCode: string
  heroes: number
  builds: number
  needsReview: number
}

export const buildKeys = {
  all: ["build-captures"] as const,
  list: ["build-captures", "list"] as const,
  detail: (id: string) => ["build-captures", "detail", id] as const,
  captureSets: ["build-captures", "capture-sets"] as const,
}

/** Captures are few (one per run of the macro), so the newest hundred cover the picker. */
const LIST_SIZE = 100

export function createBuildsApi(request: Request = backendRequest) {
  return {
    list: (signal?: AbortSignal) => request<CapturePage>(`/admin/build-captures?size=${LIST_SIZE}`, { signal }),
    detail: (id: string, signal?: AbortSignal) => request<CaptureDetail>(`/admin/build-captures/${id}`, { signal }),
    importCapture: (body: unknown) =>
      request<CaptureDetail>("/admin/build-captures", { method: "POST", body: JSON.stringify(body) }),
    review: (captureId: string, buildId: string, body: ReviewBuild) =>
      request<Reviewed>(`/admin/build-captures/${captureId}/builds/${buildId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    confirm: (capture: CaptureSummary) =>
      request<CaptureSummary>(`/admin/build-captures/${capture.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: capture.version }),
      }),
    remove: (capture: CaptureSummary) =>
      request<void>(`/admin/build-captures/${capture.id}?expectedVersion=${capture.version}`, { method: "DELETE" }),
  }
}

export const buildsApi = createBuildsApi()

/** Published capture sets, newest first; null where the account cannot open source files. */
export async function fetchCaptureSets(): Promise<BuildCaptureSet[] | null> {
  try {
    return (await fetchPublishedSets("BUILD_CAPTURE"))
      .map((entry) => entry.set.set)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  } catch (failure) {
    if (isSourceAccessDenied(failure)) return null
    throw failure
  }
}

/** The import body of one published set; the screenshots stay in the private bucket, named by SHA-256. */
export async function fetchCaptureSet(capturedOn: string): Promise<unknown> {
  const published = (await fetchPublishedSets("BUILD_CAPTURE")).find((entry) => entry.set.set.capturedOn === capturedOn)
  if (!published) throw new Error(`Không đọc được bộ ảnh ngày ${capturedOn}.`)
  return published.set.capture
}
