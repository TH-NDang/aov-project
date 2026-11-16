import type {
  Asset,
  AssetDetail,
  Cause,
  Content,
  HeroNotes,
  HeroRow,
  PageSlice,
  Preview,
  Region,
  Revision,
  Ruleset,
  Section,
  Trait,
} from "./types"
import { SECTIONS } from "./types"
import type { UploadTicket } from "../users/avatar-upload"
import type { HeroPublishReadiness } from "./publish-readiness"
import type { HeroForms, ReplaceHeroForms } from "./hero-forms-model"
export type Request = <T>(path: string, init?: RequestInit) => Promise<T>

const sectionKeys = {
  PROFILE: "profile",
  OVERVIEW_RATINGS: "overviewRatings",
  COMBAT_STATS: "combatStats",
  SKILLS: "skills",
  SKINS: "skins",
  MEDIA_BINDINGS: "mediaBindings",
} as const
type WirePreview = {
  revision: Omit<Revision, "sections"> & { sections: Record<string, string> }
  content: Record<string, unknown>
}
export interface HeroComparison {
  status: "AVAILABLE" | "BASELINE_ONLY"
  from: Revision | null
  to: Revision
  before: Record<string, unknown>
  after: Record<string, unknown>
  changes: { section: string; path: string; kind: "ADDED" | "REMOVED" | "CHANGED"; before: unknown; after: unknown }[]
  warnings: string[]
}
export interface HeroDraftChangeSet {
  source: Revision | null
  startedAt: string
  before: Partial<Record<Section, unknown>>
  after: Partial<Record<Section, unknown>>
}
const contentFromWire = (content: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(sectionKeys).map(([key, wire]) => [key, content[wire] ?? content[key]]),
  ) as HeroDraftChangeSet["before"]
export const heroPreviewKey = (heroId: string, revisionId: string) =>
  ["publishing-preview", heroId, revisionId] as const
export interface HeroCatalogQuery {
  role?: string
  position?: string
  hasWarnings?: string
  includeUnchanged?: string
  q?: string
  seasonId?: string
  patchVariantId?: string
  rulesetId?: string
  locale?: string
  sort?: "code" | "edited-desc"
}
/** Sits under the catalog's key, so saving or publishing a hero refreshes it with the other lists. */
export const publishReadinessKey = ["publishing-heroes", "publish-readiness"] as const
export const heroCatalogKey = (query: HeroCatalogQuery) =>
  [
    "publishing-heroes",
    "infinite",
    {
      q: query.q?.trim() ?? "",
      seasonId: query.seasonId ?? "",
      patchVariantId: query.patchVariantId ?? "",
      rulesetId: query.rulesetId ?? "",
      locale: query.locale ?? "vi-VN",
      sort: query.sort ?? "code",
      includeUnchanged: query.includeUnchanged ?? "false",
      role: query.role ?? "",
      position: query.position ?? "",
      hasWarnings: query.hasWarnings ?? "",
    },
  ] as const
/** Translate the API's camelCase section keys at the boundary, keeping editor keys internal. */
function previewFromApi(value: WirePreview): Preview {
  return {
    revision: {
      ...value.revision,
      sections: Object.fromEntries(
        Object.entries(sectionKeys).map(([key, wire]) => [
          key,
          value.revision.sections[wire] ?? value.revision.sections[key],
        ]),
      ) as Revision["sections"],
    },
    content: Object.fromEntries(
      Object.entries(sectionKeys).map(([key, wire]) => [key, value.content[wire] ?? value.content[key] ?? null]),
    ) as unknown as Content,
  }
}

export type HeroAvailability = "ON_SALE" | "NOT_OPEN" | "COMING_SOON" | "UNKNOWN"
export type SkinMethod = "VOUCHER" | "EVENT" | "NOT_OPEN" | "OTHER" | "UNKNOWN"
export interface HeroShopPrice {
  availability: HeroAvailability
  goldPrice: number | null
  voucherPrice: number | null
  capturedOn: string | null
  needsReview: boolean
  note: string | null
}
export interface SkinAcquisition {
  skinKey: string
  method: SkinMethod
  voucherPrice: number | null
  eventName: string | null
  capturedOn: string | null
  needsReview: boolean
  note: string | null
}
export interface HeroShop {
  region: string
  at: string
  price: HeroShopPrice | null
  skins: SkinAcquisition[]
  /** Every dated step, newest first. */
  priceHistory: HeroShopPrice[]
  skinHistory: SkinAcquisition[]
}

/** The hero in the latest confirmed ranked snapshot readers see (ADR-025, ADR-029); `null` parts were not found. */
export interface HeroRankingReading {
  snapshot: {
    code: string
    regionCode: string
    modeCode: string
    modeLabel: string
    periodLabel: string | null
    capturedAt: string
    sourceTimeZone: string | null
    heroes: number
  } | null
  entry: {
    heroId: string
    heroCode: string
    tier: string | null
    winRate: number | null
    pickRate: number | null
    banRate: number | null
    /** Per-match figures with their rank among the snapshot's heroes, the largest first. */
    figures: { metric: string; value: number | null; rank: number | null; of: number }[]
    counters: { heroId: string | null; heroCode: string }[]
  } | null
}

type AssetResponse = Omit<AssetDetail, "currentUrl"> & { versions: { id: string; url: string }[] }

const assetDetail = (detail: AssetResponse): AssetDetail => ({
  ...detail,
  provenance: detail.provenance ?? [],
  currentUrl: detail.versions.find((version) => version.id === detail.currentVersionId)?.url ?? null,
})

export function createPublishingApi(request: Request) {
  const send = <T>(path: string, method: string, value?: unknown) =>
    request<T>(path, { method, body: value === undefined ? undefined : JSON.stringify(value) })
  return {
    heroes: (page = 0, query: HeroCatalogQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), size: "20" })
      for (const [key, value] of Object.entries(query)) if (value?.trim()) params.set(key, value.trim())
      return request<PageSlice<HeroRow>>(`/admin/heroes?${params}`, signal ? { signal } : undefined)
    },
    publishReadiness: (signal?: AbortSignal) =>
      request<HeroPublishReadiness[]>("/admin/heroes/publish-readiness", signal ? { signal } : undefined),
    forms: (heroId: string) => request<HeroForms>(`/admin/heroes/${heroId}/forms`),
    replaceForms: (heroId: string, value: ReplaceHeroForms) =>
      send<HeroForms>(`/admin/heroes/${heroId}/forms`, "PUT", value),
    shop: (heroId: string, region: string) => request<HeroShop>(`/admin/heroes/${heroId}/shop?region=${region}`),
    saveShopPrice: (heroId: string, region: string, value: HeroShopPrice) =>
      send<HeroShopPrice>(`/admin/heroes/${heroId}/shop?region=${region}`, "PUT", value),
    saveSkinAcquisition: (heroId: string, skinKey: string, region: string, value: Omit<SkinAcquisition, "skinKey">) =>
      send<SkinAcquisition>(
        `/admin/heroes/${heroId}/shop/skins/${encodeURIComponent(skinKey)}?region=${region}`,
        "PUT",
        value,
      ),
    deleteShopPrice: (heroId: string, region: string, capturedOn: string) =>
      send<void>(`/admin/heroes/${heroId}/shop/prices/${capturedOn}?region=${region}`, "DELETE"),
    deleteSkinAcquisition: (heroId: string, skinKey: string, region: string, capturedOn: string) =>
      send<void>(
        `/admin/heroes/${heroId}/shop/skins/${encodeURIComponent(skinKey)}/${capturedOn}?region=${region}`,
        "DELETE",
      ),
    /** The ranked figures readers see for the hero, the basis of the notes' machine draft. */
    ranking: (heroId: string, region = "VN") =>
      request<HeroRankingReading>(`/heroes/${heroId}/ranking?region=${encodeURIComponent(region)}`),
    /** Replaces the confirmed traits of a draft; the rest of its skills stay as saved (ADR-029). */
    saveTraits: (revision: Revision, traits: Trait[], changeNote: string) =>
      send<Revision>(`/admin/heroes/${revision.heroId}/drafts/${revision.id}/traits`, "PUT", {
        expectedDraftVersion: revision.version,
        traits,
        changeNote,
      }),
    /** Replaces the notes of one language of a draft's profile; blank text clears a note. */
    saveNotes: (revision: Revision, locale: string, notes: HeroNotes, changeNote: string) =>
      send<Revision>(`/admin/heroes/${revision.heroId}/drafts/${revision.id}/notes`, "PUT", {
        expectedDraftVersion: revision.version,
        locale,
        strengths: notes.strengths ?? null,
        weaknesses: notes.weaknesses ?? null,
        counterTips: notes.counterTips ?? null,
        changeNote,
      }),
    revisions: (heroId: string) => request<Revision[]>(`/admin/heroes/${heroId}/revisions`),
    read: async (heroId: string, revisionId: string) =>
      previewFromApi(await request<WirePreview>(`/admin/heroes/${heroId}/revisions/${revisionId}`)),
    comparison: (heroId: string, revisionId: string, fromRevisionId?: string) =>
      request<HeroComparison>(
        `/admin/heroes/${heroId}/revisions/${revisionId}/comparison${fromRevisionId ? `?fromRevisionId=${encodeURIComponent(fromRevisionId)}` : ""}`,
      ),
    draftChanges: async (heroId: string, revisionId: string): Promise<HeroDraftChangeSet> => {
      const changes = await request<
        Omit<HeroDraftChangeSet, "before" | "after"> & {
          before: Record<string, unknown>
          after: Record<string, unknown>
        }
      >(`/admin/heroes/${heroId}/revisions/${revisionId}/draft-changes`)
      return { ...changes, before: contentFromWire(changes.before), after: contentFromWire(changes.after) }
    },
    rulesets: () => request<Ruleset[]>("/admin/rulesets"),
    regions: () => request<Region[]>("/regions"),
    create: (code: string, name: string, locale: string, rulesetId: string, contextId: string) =>
      send<Revision>("/admin/heroes", "POST", { code, name, initialLocale: locale, rulesetId, contextId }),
    fork: (revision: Revision, cause: Cause, effectiveFromPatchVariantId: string | null) =>
      send<Revision>(`/admin/heroes/${revision.heroId}/drafts`, "POST", {
        rulesetId: revision.rulesetId,
        sourceRevisionId: revision.id,
        cause,
        effectiveFromPatchVariantId,
      }),
    save: (revision: Revision, section: Section, content: NonNullable<Content[Section]>, changeNote: string) =>
      send<Revision>(
        `/admin/heroes/${revision.heroId}/drafts/${revision.id}/${SECTIONS.find((s) => s[0] === section)![1]}`,
        "PUT",
        { expectedDraftVersion: revision.version, ...content, changeNote },
      ),
    publish: (revision: Revision, changeNote: string) =>
      send<Revision>(`/admin/heroes/${revision.heroId}/drafts/${revision.id}/publish`, "POST", {
        expectedVersion: revision.version,
        changeNote,
      }),
    discard: (revision: Revision) =>
      send<Revision>(`/admin/heroes/${revision.heroId}/drafts/${revision.id}/discard`, "POST", {
        expectedVersion: revision.version,
      }),
    assets: (semanticType: string, page = 0) =>
      request<PageSlice<Asset>>(`/admin/media/assets?semanticType=${semanticType}&page=${page}&size=20`),
    asset: async (id: string) => assetDetail(await request<AssetResponse>(`/admin/media/assets/${id}`)),
    /** Leaves out ids the backend does not know. Screens of images read through `createAssetLoader`. */
    assetsById: async (ids: readonly string[]) => {
      const { items } = await request<{ items: AssetResponse[] }>(`/admin/media/assets/batch?ids=${ids.join(",")}`)
      return items.map(assetDetail)
    },
    send,
  }
}

/** The storage upload intentionally uses a separate fetch without API authorization. */
export async function uploadHeroImage(
  request: Request,
  file: File,
  semanticType: string,
  source: import("@aov/ui/lib/media-credit").MediaSourceInput,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 25 * 1024 * 1024)
    throw new Error("Chọn ảnh PNG, JPEG hoặc WebP tối đa 25 MB.")
  const api = createPublishingApi(request)
  const asset = await api.send<{ id: string }>("/admin/media/assets", "POST", { semanticType, source })
  const ticket = await api.send<UploadTicket>(`/admin/media/assets/${asset.id}/version-uploads`, "POST", {
    source,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  })
  const response = await fetcher(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body: file,
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error("Tải ảnh thất bại. Ảnh chưa được gắn vào tướng.")
  const result = await api.send<{ assetId: string; current: boolean }>(
    `/admin/media/uploads/${ticket.uploadId}/complete`,
    "POST",
  )
  if (!result.current) throw new Error("Phiên bản ảnh chưa được kích hoạt.")
  return result.assetId
}

/** Upgrade bytes on the same asset; Hero section references must remain unchanged. */
export async function upgradeHeroImage(
  request: Request,
  assetId: string,
  file: File,
  fetcher: typeof fetch = fetch,
  source?: import("@aov/ui/lib/media-credit").MediaSourceInput,
): Promise<void> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 25 * 1024 * 1024)
    throw new Error("Chọn ảnh PNG, JPEG hoặc WebP tối đa 25 MB.")
  const api = createPublishingApi(request)
  const ticket = await api.send<UploadTicket>(`/admin/media/assets/${assetId}/version-uploads`, "POST", {
    source,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  })
  const uploaded = await fetcher(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body: file,
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  })
  if (!uploaded.ok) throw new Error("Tải phiên bản ảnh chưa thành công.")
  const result = await api.send<{ versionId: string; current: boolean }>(
    `/admin/media/uploads/${ticket.uploadId}/complete`,
    "POST",
  )
  if (!result.current) {
    const asset = await request<{ version: number }>(`/admin/media/assets/${assetId}`)
    await api.send(`/admin/media/assets/${assetId}/versions/${result.versionId}/activate`, "POST", {
      expectedVersion: asset.version,
    })
  }
}
