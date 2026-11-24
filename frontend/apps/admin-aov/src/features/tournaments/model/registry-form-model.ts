import type {
  DocumentView,
  PlayerContent,
  SeriesContent,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import { normalize } from "@/lib/text"

export type RegistryKind = "teams" | "players" | "tournaments" | "series"
type Content = TeamContent | PlayerContent | TournamentContent | SeriesContent

export function registrySearchText(value: string) {
  return normalize(value)
}

export function parseTeamAliases(value: string): string[] {
  const names = value
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
  const unique = new Map<string, string>()
  for (const name of names) if (!unique.has(name.toLocaleLowerCase())) unique.set(name.toLocaleLowerCase(), name)
  return [...unique.values()]
}

/** `defaults` start a new record, such as a part that takes its main event's region, year and logo. */
export function initialRegistryValues(
  entry: DocumentView<Content> | undefined,
  kind: RegistryKind,
  tournamentId?: string,
  defaults?: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {
    region: "VN",
    bestOf: "3",
    tournamentId: tournamentId ?? "",
    ...(entry ? undefined : defaults),
  }
  if (entry)
    for (const [key, value] of Object.entries(entry.content)) {
      if (value == null) continue
      if ((key === "aliases" || key === "signatureHeroes") && Array.isArray(value)) values[key] = value.join(", ")
      else if (key === "result" && typeof value === "object") {
        for (const [field, detail] of Object.entries(value))
          if (detail != null) values[`result.${field}`] = String(detail)
      } else values[key] = String(value)
    }
  if (values.scheduledAt) {
    const date = new Date(values.scheduledAt)
    if (!Number.isNaN(date.getTime()))
      values.scheduledAt = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  if (values.repeatPicksAllowed === "false") values.repeatPicksAllowed = ""
  if (kind === "tournaments" && !entry && !values.year) values.year = String(new Date().getFullYear())
  return values
}

export function registryContent(kind: RegistryKind, values: Record<string, string>, keys: string[]): Content {
  const content: Record<string, unknown> = {}
  for (const key of keys) {
    if (key.startsWith("result.")) continue
    const value = values[key]?.trim()
    if (!value) continue
    content[key] =
      key === "repeatPicksAllowed"
        ? value === "true"
        : key === "aliases" || key === "signatureHeroes"
          ? parseTeamAliases(value)
          : ["year", "bestOf"].includes(key)
            ? Number(value)
            : key === "scheduledAt"
              ? new Date(value).toISOString()
              : value
  }
  if (kind === "series") {
    const resultKeys = ["scoreA", "scoreB", "sourceUrl", "verifiedOn"]
    if (resultKeys.some((key) => values[`result.${key}`]?.trim())) {
      const result: Record<string, unknown> = { verification: values["result.verification"] || "UNVERIFIED" }
      for (const key of resultKeys) {
        const value = values[`result.${key}`]?.trim()
        if (value) result[key] = key.startsWith("score") ? Number(value) : value
      }
      content.result = result
    }
  }
  return content as Content
}

/**
 * A tournament saved from its editor: the form's fields, with what other screens edit kept from the stored record (the
 * final table, awards, links and local currency, the broadcast crew and the team staff), and a result an import
 * recorded before the Final step kept the final table, which Stream still reads when the table names no single
 * champion.
 */
export function keptTournamentFields(fields: TournamentContent, stored: TournamentContent): TournamentContent {
  return {
    ...fields,
    result: stored.result,
    localCurrency: stored.localCurrency,
    placements: stored.placements,
    awards: stored.awards,
    links: stored.links,
    broadcast: stored.broadcast,
    staff: stored.staff,
  }
}

/**
 * A match saved from its editor: the form's fields, with what the form does not show kept from the stored record (the
 * title its plan gave it, its MVP and the people of its own broadcast).
 */
export function keptSeriesFields(fields: SeriesContent, stored: SeriesContent): SeriesContent {
  return {
    ...fields,
    title: stored.title,
    mvpPlayerId: stored.mvpPlayerId,
    broadcast: stored.broadcast,
  }
}

/**
 * A record's content after an edit of some of its fields: those fields take the form's values, a field the editor
 * cleared goes, and every field the form does not show stays as it was.
 */
export function editedRecordContent<T extends Content>(
  kind: RegistryKind,
  entry: DocumentView<T>,
  values: Record<string, string>,
  keys: string[],
): T {
  const kept = Object.fromEntries(Object.entries(entry.content).filter(([key]) => !keys.includes(key)))
  return { ...kept, ...registryContent(kind, values, keys) } as T
}

export function registryFormIssue(kind: RegistryKind, values: Record<string, string>): string | null {
  for (const key of ["sourceUrl", "logoUrl", "logoDarkUrl", "photoUrl", "result.sourceUrl"]) {
    if (values[key]?.trim() && !/^https?:\/\//i.test(values[key].trim()))
      return "Link ảnh hoặc nguồn kiểm chứng cần bắt đầu bằng https:// hoặc http://."
  }
  if (kind === "teams" || kind === "players") {
    const aliases = parseTeamAliases(values.aliases ?? "")
    if (aliases.length > 20 || aliases.some((alias) => alias.length > 100))
      return "Tên khác: tối đa 20 tên, mỗi tên không quá 100 ký tự."
  }
  if (kind === "series") {
    if (values.teamAId === values.teamBId) return "Hai đội trong cùng một trận phải khác nhau."
    const result = (registryContent(kind, values, []) as SeriesContent).result
    if (!result) return null
    const bestOf = Number(values.bestOf || 3)
    const winningScore = Math.ceil(bestOf / 2)
    if (result.scoreA == null || result.scoreB == null || !result.sourceUrl)
      return "Kết quả trận cần đủ hai vế tỷ số và link nguồn kiểm chứng."
    if (bestOf % 2 === 0) {
      if ([result.scoreA, result.scoreB].some((score) => !Number.isInteger(score) || score < 0))
        return "Tỷ số phải là số nguyên không âm."
      // A fixed-length series plays every game, so it may end level.
      return result.scoreA + result.scoreB === bestOf ? null : `Thể thức BO${bestOf} cần đủ ${bestOf} ván trong tỷ số.`
    }
    if ([result.scoreA, result.scoreB].some((score) => !Number.isInteger(score) || score < 0 || score > winningScore))
      return `Tỷ số phải là số nguyên từ 0 đến ${winningScore} với thể thức này.`
    if (Math.max(result.scoreA, result.scoreB) !== winningScore || result.scoreA === result.scoreB)
      return `Kết quả hoàn tất cần một đội thắng ${winningScore} ván và đội còn lại ít hơn.`
    return null
  }
  return null
}
