export interface Asset {
  assetId: string
  currentVersion: { url: string; width: number; height: number; versionId: string } | null
}
export interface Context {
  region: string
  requestedLocale: string
  actualLocale?: string
  fallbackApplied?: boolean
  ruleset: { id: string; code: string }
  patch: { id: string; code: string }
  patchVariantId: string
  effectiveAt: string
}
export interface HeroSummary {
  id: string
  code: string
  name: string
  roles: string[]
  head?: Asset
}
export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  context?: Context
}
export interface HeroDetail {
  id: string
  code: string
  revisionId: string
  context: Context
  content: {
    profile: { name: string; title: string | null; summary: string | null; lore: string | null; roles: string[] }
    overviewRatings: {
      survivability: number
      attackDamage: number
      skillEffects: number
      difficulty: number
      scaleCode: string
    }
    combatStats: {
      values: { statKey: string; baseValue: number | null; growthPerLevel: number | null; unit: string }[]
    }
    skills: {
      skills: {
        skillKey: string
        name: string
        description: string
        kind: string
        formKey: string | null
        displayOrder: number
        actualLocale: string
        fallbackApplied: boolean
      }[]
    }
    skins: {
      skins: {
        skinKey: string
        name: string
        description: string | null
        acquisitionNote: string | null
        rarityCode: string | null
        displayOrder: number
      }[]
    }
  }
  media: Partial<Record<"HEAD" | "PORTRAIT" | "SPLASH", Asset>>
  skillMedia: Record<string, Asset>
  skinMedia: Record<string, Asset>
}
export interface Change {
  id: string
  summary: string
  patch: { title?: string; code: string; effectiveAt: string }
  changes: {
    id: string
    type: string
    statKey?: string
    skillKey?: string
    oldValue?: unknown
    newValue?: unknown
    unit?: string
    description?: string
    changeKind: string
  }[]
}
export class WikiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(code)
  }
}
export async function wikiRequest<T>(path: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(`/api/wiki/v1${path}`, {
    signal,
    cache: "no-cache",
    credentials: "omit",
    headers: { Accept: "application/json" },
  })
  if (!response.headers.get("content-type")?.includes("json")) throw new WikiError(response.status, "API_UNAVAILABLE")
  const body = await response.json()
  if (!response.ok) throw new WikiError(response.status, body.code ?? "HTTP_ERROR", body.requestId)
  return body as T
}
export function wikiErrorMessage(error: unknown): string {
  if (error instanceof WikiError) {
    const messages: Record<string, string> = {
      PATCH_CONTEXT_UNAVAILABLE: "Vùng này chưa có dữ liệu patch đang hiệu lực. Vui lòng quay lại sau.",
      HERO_NOT_FOUND: "Tướng chưa được xuất bản hoặc chưa có hiệu lực tại vùng bạn chọn.",
      REGION_UNAVAILABLE: "Vùng này chưa được hỗ trợ.",
      REGION_NOT_FOUND: "Không tìm thấy vùng đã chọn.",
      API_UNAVAILABLE: "Chưa kết nối được dịch vụ wiki. Vui lòng thử lại sau.",
    }
    return messages[error.code] ?? "Không tải được dữ liệu wiki. Vui lòng thử lại."
  }
  return "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại."
}
export const ROLE_LABELS: Record<string, string> = {
  TANK: "Đỡ đòn",
  WARRIOR: "Đấu sĩ",
  ASSASSIN: "Sát thủ",
  MAGE: "Pháp sư",
  MARKSMAN: "Xạ thủ",
  SUPPORT: "Trợ thủ",
}
