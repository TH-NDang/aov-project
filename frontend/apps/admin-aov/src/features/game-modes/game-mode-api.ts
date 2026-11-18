import { backendRequest } from "@/app/auth/session"
import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import { uploadHeroImage, type Request } from "../publishing/api/publishing-api"
import type { PageSlice } from "../publishing/api/types"

export type ModeGroup = "PVP" | "ENTERTAINMENT"
export type AvailabilityStatus = "ALWAYS_OPEN" | "LIMITED" | "SPECIAL" | "CLOSED" | "LOCKED" | "UNKNOWN"

export interface RuleSection {
  group?: string | null
  title: string
  body?: string | null
}

export interface ModeContent {
  name: string
  group: ModeGroup | null
  order?: number | null
  summary?: string | null
  playersLabel?: string | null
  duration?: { minMinutes?: number | null; maxMinutes?: number | null } | null
  availability?: {
    status: AvailabilityStatus | null
    gameLabel?: string | null
    startsOn?: string | null
    endsOn?: string | null
    observedOn?: string | null
    note?: string | null
  } | null
  artAssetId?: string | null
  guideKind: "NONE" | "AUTO_CHESS"
  rules: RuleSection[]
  heroes: { heroCode?: string | null; name: string; note?: string | null }[]
  specialItems: { name: string; description?: string | null; iconAssetId?: string | null }[]
  sources: { label: string; url?: string | null; observedOn?: string | null }[]
}

export interface Revision {
  id: string
  revisionNo: number
  state: "DRAFT" | "PUBLISHED" | "DISCARDED"
  version: number
  sourceRevisionId?: string | null
  changeNote?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminImage {
  assetId: string
  versionId: string
  url: string
  width: number
  height: number
}

export interface AdminSummary {
  id: string
  code: string
  name: string
  group: ModeGroup | null
  order?: number | null
  guideKind: "NONE" | "AUTO_CHESS"
  art?: AdminImage | null
  published?: Revision | null
  draft?: Revision | null
  guide?: { published?: Revision | null; draft?: Revision | null } | null
}

export interface AdminMode {
  id: string
  code: string
  revision: Revision
  hasPublished: boolean
  content: ModeContent
  missingFields: string[]
  images: Record<string, AdminImage>
}

export interface TraitTier {
  count: number
  effect: string
}

export interface GuideContent {
  edition?: string | null
  observedOn?: string | null
  summary?: string | null
  rules: RuleSection[]
  traits: {
    code: string
    kind: "FACTION" | "CLASS"
    name: string
    description?: string | null
    iconAssetId?: string | null
    tiers: TraitTier[]
    note?: string | null
  }[]
  units: {
    code: string
    name: string
    cost: number
    traitCodes: string[]
    portraitAssetId?: string | null
    heroCode?: string | null
    skill?: {
      name?: string | null
      description?: string | null
      iconAssetId?: string | null
      valueLabel?: string | null
      values: string[]
    } | null
    stats?: { health: number[]; physicalAttack: number[]; armor: number[]; magicResistance: number[] } | null
    complete: boolean
    note?: string | null
  }[]
  itemGroups: { code: string; name: string; slotCount?: number | null; iconAssetId?: string | null }[]
  items: {
    code: string
    name: string
    effect?: string | null
    groupCode?: string | null
    slot?: number | null
    iconAssetId?: string | null
  }[]
  blessings: {
    code: string
    tier: "NORMAL" | "EPIC" | "LEGENDARY"
    name: string
    description?: string | null
    iconAssetId?: string | null
  }[]
  quests: { code: string; task: string; reward?: string | null }[]
  lineups: GuideLineup[]
  sources: { label: string; url?: string | null; observedOn?: string | null }[]
}

export interface GuideLineup {
  id?: string | null
  code: string
  name: string
  tier?: "S" | "A" | "B" | "C" | null
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null
  summary?: string | null
  units: {
    unitCode: string
    carry: boolean
    row?: "FRONT" | "MIDDLE" | "BACK" | null
    /** Column 1–7 on the three-by-seven board, with a row. */
    column?: number | null
    itemCodes: string[]
  }[]
  emblems: string[]
  blessingCodes: string[]
  notes?: string | null
  /** Early and mid game boards; the lineup's own units are its late game. */
  stages?: { stage: "EARLY" | "MID"; unitCodes: string[]; note?: string | null }[]
  /** Items to build first, in order. */
  priorityItemCodes?: string[]
}

export interface AdminGuide {
  modeId: string
  modeCode: string
  revision: Revision
  hasPublished: boolean
  content: GuideContent
  missingFields: string[]
  images: Record<string, AdminImage>
}

export interface AdminLineup {
  id: string
  name: string
  note?: string | null
  units: GuideLineup["units"]
  emblems: string[]
  status: "VISIBLE" | "HIDDEN"
  hiddenReason?: string | null
  authorSubject: string
  version: number
  likes: number
  createdAt: string
  updatedAt: string
}

export const gameModeKeys = {
  all: ["admin-game-modes"] as const,
  list: ["admin-game-modes", "list"] as const,
  mode: (id: string) => ["admin-game-modes", "mode", id] as const,
  history: (id: string) => ["admin-game-modes", "history", id] as const,
  guide: (id: string) => ["admin-game-modes", "guide", id] as const,
  community: (id: string, status: string) => ["admin-game-modes", "community", id, status] as const,
  communities: (id: string) => ["admin-game-modes", "community", id] as const,
}

export function createGameModeApi(request: Request = backendRequest) {
  const send = <T>(path: string, method: string, body?: unknown) =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
  const base = "/admin/game-modes"
  return {
    list: (signal?: AbortSignal) => request<AdminSummary[]>(base, { signal }),
    create: (body: { code: string; name: string; group: ModeGroup; content?: ModeContent }) =>
      send<AdminMode>(base, "POST", body),
    current: (id: string, signal?: AbortSignal) => request<AdminMode>(`${base}/${id}`, { signal }),
    history: (id: string, signal?: AbortSignal) => request<Revision[]>(`${base}/${id}/revisions`, { signal }),
    createDraft: (id: string, changeNote?: string) => send<AdminMode>(`${base}/${id}/drafts`, "POST", { changeNote }),
    update: (id: string, revisionId: string, expectedVersion: number, content: ModeContent, changeNote?: string) =>
      send<AdminMode>(`${base}/${id}/drafts/${revisionId}`, "PUT", { expectedVersion, content, changeNote }),
    publish: (id: string, revisionId: string, expectedVersion: number, changeNote?: string) =>
      send<AdminMode>(`${base}/${id}/drafts/${revisionId}/publish`, "POST", { expectedVersion, changeNote }),
    discard: (id: string, revisionId: string, expectedVersion: number) =>
      send<AdminMode>(`${base}/${id}/drafts/${revisionId}/discard`, "POST", { expectedVersion }),
    guide: (id: string, signal?: AbortSignal) => request<AdminGuide>(`${base}/${id}/auto-chess`, { signal }),
    createGuideDraft: (id: string, content?: GuideContent, changeNote?: string) =>
      send<AdminGuide>(`${base}/${id}/auto-chess/drafts`, "POST", { content, changeNote }),
    updateGuide: (
      id: string,
      revisionId: string,
      expectedVersion: number,
      content: GuideContent,
      changeNote?: string,
    ) =>
      send<AdminGuide>(`${base}/${id}/auto-chess/drafts/${revisionId}`, "PUT", {
        expectedVersion,
        content,
        changeNote,
      }),
    publishGuide: (id: string, revisionId: string, expectedVersion: number, changeNote?: string) =>
      send<AdminGuide>(`${base}/${id}/auto-chess/drafts/${revisionId}/publish`, "POST", {
        expectedVersion,
        changeNote,
      }),
    discardGuide: (id: string, revisionId: string, expectedVersion: number) =>
      send<AdminGuide>(`${base}/${id}/auto-chess/drafts/${revisionId}/discard`, "POST", { expectedVersion }),
    community: (id: string, status: string | null, page: number, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), size: "30" })
      if (status) params.set("status", status)
      return request<PageSlice<AdminLineup>>(`${base}/${id}/auto-chess/community-lineups?${params}`, { signal })
    },
    visibility: (id: string, lineupId: string, expectedVersion: number, hidden: boolean, reason?: string) =>
      send<AdminLineup>(`${base}/${id}/auto-chess/community-lineups/${lineupId}/visibility`, "POST", {
        expectedVersion,
        hidden,
        reason,
      }),
  }
}

export const gameModeApi = createGameModeApi()

/** Credit of images taken from the game, as for other game art in the project. */
export const GAME_CREDIT = "Garena / Liên Quân Mobile"

export function uploadModeImage(
  file: File,
  semanticType: "GAME_MODE_ART" | "AUTO_CHESS_ICON",
  source: MediaSourceInput,
  request: Request = backendRequest,
) {
  return uploadHeroImage(request, file, semanticType, { ownerName: GAME_CREDIT, ...source })
}
