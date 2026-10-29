import type {
  Asset,
  AssetDetail,
  Cause,
  Content,
  HeroRow,
  PageSlice,
  Preview,
  Region,
  Revision,
  Ruleset,
  Section,
} from "./types"
import { SECTIONS } from "./types"
import type { UploadTicket } from "../users/avatar-upload"
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
export const heroPreviewKey = (heroId: string, revisionId: string) =>
  ["publishing-preview", heroId, revisionId] as const
export interface HeroCatalogQuery {
  includeUnchanged?: string
  q?: string
  seasonId?: string
  patchVariantId?: string
  rulesetId?: string
  locale?: string
  sort?: "code" | "edited-desc"
}
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

export function createPublishingApi(request: Request) {
  const send = <T>(path: string, method: string, value?: unknown) =>
    request<T>(path, { method, body: value === undefined ? undefined : JSON.stringify(value) })
  return {
    heroes: (page = 0, query: HeroCatalogQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page), size: "20" })
      for (const [key, value] of Object.entries(query)) if (value?.trim()) params.set(key, value.trim())
      return request<PageSlice<HeroRow>>(`/admin/heroes?${params}`, signal ? { signal } : undefined)
    },
    revisions: (heroId: string) => request<Revision[]>(`/admin/heroes/${heroId}/revisions`),
    read: async (heroId: string, revisionId: string) =>
      previewFromApi(await request<WirePreview>(`/admin/heroes/${heroId}/revisions/${revisionId}`)),
    comparison: (heroId: string, revisionId: string, fromRevisionId?: string) =>
      request<HeroComparison>(
        `/admin/heroes/${heroId}/revisions/${revisionId}/comparison${fromRevisionId ? `?fromRevisionId=${encodeURIComponent(fromRevisionId)}` : ""}`,
      ),
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
    asset: async (id: string): Promise<AssetDetail> => {
      const detail = await request<Omit<AssetDetail, "currentUrl"> & { versions: { id: string; url: string }[] }>(
        `/admin/media/assets/${id}`,
      )
      return {
        ...detail,
        provenance: detail.provenance ?? [],
        currentUrl: detail.versions.find((version) => version.id === detail.currentVersionId)?.url ?? null,
      }
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
  if (!response.ok) throw new Error("Tải ảnh thất bại. Asset chưa được gắn vào tướng.")
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
