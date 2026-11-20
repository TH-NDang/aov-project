import type {
  Catalog,
  DocumentView,
  GameContent,
  LinkMention,
  LinkMentionCount,
  LinkMentionKind,
  PageSlice,
  PlayerContent,
  RosterMembershipContent,
  RecordDeletionImpact,
  RecordLifecycleState,
  SeriesContent,
  TeamContent,
  TournamentContent,
  TournamentFacets,
  TournamentPart,
  TournamentStats,
} from "@aov/community-contracts"
import { communityRequest } from "@/app/auth/session"
import { ApiError } from "@/lib/api/errors"
import { sameNamePlayers } from "../model/same-name-players"

export interface TournamentRecords {
  teams: TeamContent
  players: PlayerContent
  tournaments: TournamentContent
  series: SeriesContent
  games: GameContent
  "roster-memberships": RosterMembershipContent
}
export type RecordKind = keyof TournamentRecords
type Request = <T>(path: string, init?: RequestInit) => Promise<T>
type CatalogScope = Pick<GameContent, "region" | "locale" | "seasonId" | "patchVariantId" | "includeUnscoped">

const all = ["community", "tournaments"] as const
/**
 * Every cache key of the tournament records and their views. All of them start with `all`, so one invalidation after a
 * write refreshes every screen; the third part names what is cached (a record kind or a view), then whose session read
 * it, then what the view narrows to.
 */
export const tournamentKeys = {
  all,
  /** Every cached list or row of one kind, such as all games after one game is saved. */
  kind: (kind: RecordKind) => [...all, kind] as const,
  me: (actorKey: string) => [...all, "me", actorKey] as const,
  list: (kind: RecordKind, actorKey: string) => [...all, kind, actorKey] as const,
  inTournament: (kind: RecordKind, actorKey: string, tournamentId: string) =>
    [...all, kind, actorKey, "tournament", tournamentId] as const,
  one: (kind: RecordKind, actorKey: string, id: string | null) => [...all, kind, actorKey, "one", id] as const,
  /** The games of one series, or every game when no series is named. */
  seriesGames: (actorKey: string, seriesId?: string) => [...all, "games", actorKey, seriesId ?? "*"] as const,
  teamRosters: (actorKey: string, teamId: string, tournamentId: string) =>
    [...all, "roster-memberships", actorKey, teamId, tournamentId] as const,
  stats: (actorKey: string) => [...all, "tournament-stats", actorKey] as const,
  catalog: (actorKey: string, scope?: CatalogScope) =>
    [
      ...all,
      "catalog",
      actorKey,
      scope?.region,
      scope?.locale,
      scope?.seasonId ?? "",
      scope?.patchVariantId ?? "",
      !!scope?.includeUnscoped,
    ] as const,
  hub: (
    actorKey: string,
    search: string,
    filters: { status: string; tier: string; region: string; year: string },
    sort: TournamentSort,
  ) => [...all, "hub", actorKey, search, filters.status, filters.tier, filters.region, filters.year, sort] as const,
  hubFacets: (actorKey: string) => [...all, "hub-facets", actorKey] as const,
  /** The parts of one main event, or of every event with "every". */
  parts: (actorKey: string, mainEventId: string) => [...all, "parts", actorKey, mainEventId] as const,
  /** The parts of the tournament open in the registry editor, to tell whether it may become a part itself. */
  ownParts: (tournamentId: string | undefined) => [...all, "parts", tournamentId] as const,
  picker: (kind: RankedKind, search: string, context?: PickerContext) =>
    [...all, "picker", kind, search, context ?? null] as const,
  pickerSelected: (kind: RankedKind, id: string | null | undefined) => [...all, "picker-selected", kind, id] as const,
  /** Text that names someone no link names yet, one kind per tab; read again after every tournament write. */
  linkReview: (actorKey: string, kind: LinkMentionKind) => [...all, "link-review", actorKey, kind] as const,
  linkReviewFacets: (actorKey: string) => [...all, "link-review-facets", actorKey] as const,
  trash: (actorKey: string, kind: RecordKind) => [...all, "trash", actorKey, kind] as const,
  /** Rows of every state that name the parents of what sits in the trash. */
  trashLookup: (actorKey: string, kind: RecordKind) => [...all, "trash-lookup", actorKey, kind] as const,
  deletionImpact: (actorKey: string, kind: RecordKind, id: string, version: number) =>
    [...all, "deletion-impact", actorKey, kind, id, version] as const,
  /**
   * Seasons and patches of the Wiki for one market. They belong to the Wiki, so a tournament write leaves them alone:
   * the key stays outside `all`.
   */
  catalogContext: (region: string, locale: string) => ["tournament", "wiki-context", region, locale] as const,
}

/** For an invalidation after a write: a deletion check is read afresh each time its question opens. */
export const exceptDeletionImpact = ({ queryKey }: { queryKey: readonly unknown[] }) =>
  queryKey[2] !== "deletion-impact"

/** Seasons and patches the Wiki offers for one market, to scope a game to its gameplay version. */
export type CatalogContext = {
  seasons: {
    id: string
    name: string
    patches: { id: string; code: string; title: string; regionalDate?: string | null }[]
  }[]
}

/** Read from the public Wiki API without the session: every market's seasons are public. */
export async function fetchCatalogContext(region: string, locale: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ region, locale })
  const response = await fetch(`/api/wiki/v1/catalog-context?${params}`, { signal, credentials: "omit" })
  if (!response.ok) throw new Error("Catalog context unavailable")
  return (await response.json()) as CatalogContext
}

export type TournamentSort = "RECENT" | "STATUS" | "NAME"
/** MAIN keeps a list to main events; each then also answers to the names of its parts. */
export type TournamentLevel = "ALL" | "MAIN"
export type TournamentFilters = {
  q?: string
  level?: TournamentLevel
  status?: string
  tier?: string
  region?: string
  year?: string
  /** Regions whose name holds the search, so that typing a place still finds its tournaments. */
  alsoRegions?: string[]
  sort?: TournamentSort
  teamId?: string
  playerId?: string
  page?: number
  size?: number
}
/** What a picker was opened in: rows belonging to it come first. */
/** What a merge moved from the merged profile to the one that stays. */
export type PlayerMergeResult = {
  player: DocumentView<TournamentRecords["players"]>
  moved: {
    rosterLines: number
    repeatedRosterLines: number
    tournaments: number
    series: number
    games: number
    plans: number
    planRevisions: number
  }
}
export type PickerContext = { tournamentId?: string; teamId?: string; playerId?: string; level?: TournamentLevel }
type RankedKind = "teams" | "players" | "tournaments"
const searchParams = (values: Record<string, string | number | string[] | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (Array.isArray(value) ? value.length : value !== undefined && value !== "") params.set(key, String(value))
  return params
}

const withQuery = (path: string, values: Parameters<typeof searchParams>[0]) => {
  const query = searchParams(values).toString()
  return query ? `${path}?${query}` : path
}

export function createTournamentApi(request: Request = communityRequest) {
  const send = <T>(path: string, method: string, body: unknown) =>
    request<T>(path, { method, body: JSON.stringify(body) })
  return {
    me: (signal?: AbortSignal) => request<{ capabilities: string[] }>("/admin/me", { signal }),
    async list<K extends RecordKind>(
      kind: K,
      signal?: AbortSignal,
      filters?:
        string | { tournamentId?: string; teamId?: string; playerId?: string; state?: "ACTIVE" | "DELETED" | "ALL" },
    ): Promise<DocumentView<TournamentRecords[K]>[]> {
      const rows: DocumentView<TournamentRecords[K]>[] = []
      for (let page = 0; page < 100; page++) {
        const params = new URLSearchParams({ page: String(page), size: "500" })
        // This walks the whole list to look rows up by id: ranking every page would only make that slower.
        if (kind === "teams" || kind === "players" || kind === "tournaments") params.set("sort", "UPDATED")
        if (typeof filters === "string") params.set("seriesId", filters)
        else if (filters) for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
        const result = await request<PageSlice<DocumentView<TournamentRecords[K]>>>(`/admin/${kind}?${params}`, {
          signal,
        })
        rows.push(...result.items)
        if (!result.items.length || rows.length >= result.totalElements) return rows
      }
      throw new Error("Danh sách quá lớn. Hãy thu hẹp phạm vi trước khi tải lại.")
    },
    tournamentStats: (signal?: AbortSignal) => request<TournamentStats[]>("/admin/tournaments/stats", { signal }),
    tournamentFacets: (signal?: AbortSignal, level?: TournamentLevel) =>
      request<TournamentFacets>(withQuery("/admin/tournaments/facets", { level }), { signal }),
    /** The parts of one main event, or every part when none is named, each event's parts in playing order. */
    tournamentParts: (mainEventId?: string, signal?: AbortSignal) =>
      request<TournamentPart[]>(withQuery("/admin/tournaments/parts", { parentId: mainEventId }), { signal }),
    /** One page of tournaments in the server's order, with every filter applied there. */
    searchTournaments: (filters: TournamentFilters, signal?: AbortSignal) =>
      request<PageSlice<DocumentView<TournamentContent>>>(
        `/admin/tournaments?${searchParams({ size: 30, ...filters })}`,
        { signal },
      ),
    /** One page for a picker. Asks for no order of its own: the default puts what is recent and relevant first. */
    pick: <K extends RankedKind>(
      kind: K,
      filters: PickerContext & { q?: string; page?: number },
      signal?: AbortSignal,
    ) =>
      request<PageSlice<DocumentView<TournamentRecords[K]>>>(
        `/admin/${kind}?${searchParams({ size: 30, ...filters })}`,
        {
          signal,
        },
      ),
    read: <K extends RecordKind>(kind: K, id: string, signal?: AbortSignal) =>
      request<DocumentView<TournamentRecords[K]>>(`/admin/${kind}/${id}`, { signal }),
    create: <K extends RecordKind>(kind: K, content: TournamentRecords[K]) =>
      send<DocumentView<TournamentRecords[K]>>(`/admin/${kind}`, "POST", { content }),
    save: <K extends RecordKind>(kind: K, entry: DocumentView<TournamentRecords[K]>, content: TournamentRecords[K]) =>
      send<DocumentView<TournamentRecords[K]>>(`/admin/${kind}/${entry.id}`, "PUT", {
        version: entry.version,
        content,
      }),
    /** Folds the player `id` into `intoId` and trashes it, at the versions read just before (spec 04). */
    mergePlayer: async (id: string, intoId: string) => {
      const [source, target] = await Promise.all([
        request<DocumentView<TournamentRecords["players"]>>(`/admin/players/${id}`),
        request<DocumentView<TournamentRecords["players"]>>(`/admin/players/${intoId}`),
      ])
      return send<PlayerMergeResult>(`/admin/players/${id}/merge`, "POST", {
        version: source.version,
        intoId,
        intoVersion: target.version,
      })
    },
    deletionImpact: (kind: RecordKind, id: string, signal?: AbortSignal) =>
      request<RecordDeletionImpact>(`/admin/${kind}/${id}/deletion-impact`, { signal }),
    remove: (kind: RecordKind, entry: { id: string; version: number }) =>
      send<RecordLifecycleState>(`/admin/${kind}/${entry.id}/delete`, "POST", { version: entry.version }),
    restore: (kind: RecordKind, entry: { id: string; version: number }) =>
      send<RecordLifecycleState>(`/admin/${kind}/${entry.id}/restore`, "POST", { version: entry.version }),
    publish: (entry: DocumentView<GameContent>) =>
      send<DocumentView<GameContent>>(`/admin/games/${entry.id}/publish`, "POST", { version: entry.version }),
    withdraw: (entry: DocumentView<GameContent>) =>
      send<DocumentView<GameContent>>(`/admin/games/${entry.id}/withdraw`, "POST", { version: entry.version }),
    /** One page of the text still waiting for a link, of one kind, in the order the server keeps. */
    linkReview: (kind: LinkMentionKind, page = 0, signal?: AbortSignal) =>
      request<PageSlice<LinkMention>>(withQuery("/admin/link-review", { kind, page, size: 50 }), { signal }),
    /** How many rows each kind has, those with none included. */
    linkReviewFacets: (signal?: AbortSignal) => request<LinkMentionCount[]>("/admin/link-review/facets", { signal }),
    catalog: (
      scope: Pick<GameContent, "region" | "locale" | "seasonId" | "patchVariantId" | "includeUnscoped">,
      signal?: AbortSignal,
    ) => {
      const params = new URLSearchParams({ region: scope.region, locale: scope.locale })
      if (scope.seasonId) params.set("seasonId", scope.seasonId)
      if (scope.patchVariantId) params.set("patchVariantId", scope.patchVariantId)
      if (scope.includeUnscoped) params.set("includeUnscoped", "true")
      return request<Catalog>(`/admin/catalog?${params}`, { signal })
    },
  }
}
export const tournamentApi = createTournamentApi()

export function tournamentIssueFields(error: unknown): string[] {
  if (!(error instanceof ApiError)) return []
  const problem = error.problem as typeof error.problem & { missingFields?: unknown; violations?: unknown }
  const fields = problem.missingFields ?? problem.violations
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === "string") : []
}

export function tournamentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    if (error.status === 403) return "Tài khoản chưa có quyền quản lý giải đấu. Hãy kiểm tra quyền trong Keycloak."
    if (error.code === "TOURNAMENT_PLAYER_SAME_NAME") {
      const codes = (sameNamePlayers(error) ?? []).map((player) => player.code).join(", ")
      return `Đã có tuyển thủ cùng quốc gia mang tên này${codes ? ` (${codes})` : ""}. Dùng mã của hồ sơ đó thay vì tạo hồ sơ mới.`
    }
    if (error.code === "TOURNAMENT_RECORD_IN_USE") return "Chưa thể xóa: mục này còn được dữ liệu khác sử dụng."
    if (error.code === "TOURNAMENT_RESTORE_BLOCKED") return "Chưa thể khôi phục: cần khôi phục dữ liệu liên quan trước."
    if (error.code === "TOURNAMENT_RECORD_DELETED")
      return "Mục này, hoặc đội hay tuyển thủ được liên kết, đang ở thùng rác. Khôi phục hoặc chọn lại trước khi lưu."
    if (error.code === "DUPLICATE_RECORD")
      return "Mã đã được dùng hoặc số ván đã tồn tại trong trận này. Chọn mã / số khác."
    if (error.status === 409) return "Dữ liệu đã thay đổi. Hãy tải bản mới trước khi lưu lại."
    if (error.status === 422 || error.status === 400)
      return "Thông tin chưa hợp lệ. Kiểm tra các ô đã nhập và danh sách còn thiếu."
    if (error.status === 502 || error.status === 503)
      return "Chưa kết nối được dịch vụ giải đấu hoặc danh mục Wiki. Bạn có thể thử lại."
    return "Chưa thể hoàn tất thao tác. Vui lòng thử lại."
  }
  return error instanceof Error ? error.message : "Chưa kết nối được dịch vụ giải đấu."
}
