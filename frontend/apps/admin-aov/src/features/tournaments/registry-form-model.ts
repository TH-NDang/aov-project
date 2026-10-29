import type {
  DocumentView,
  PlayerContent,
  SeriesContent,
  TeamContent,
  TournamentContent,
  TournamentResult,
} from "@aov/community-contracts"

export type RegistryKind = "teams" | "players" | "tournaments" | "series"
type Content = TeamContent | PlayerContent | TournamentContent | SeriesContent

export function registrySearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .toLocaleLowerCase()
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

export function initialRegistryValues(
  entry: DocumentView<Content> | undefined,
  kind: RegistryKind,
  tournamentId?: string,
): Record<string, string> {
  const values: Record<string, string> = { region: "VN", bestOf: "3", tournamentId: tournamentId ?? "" }
  if (entry)
    for (const [key, value] of Object.entries(entry.content)) {
      if (value == null) continue
      if (key === "aliases" && Array.isArray(value)) values[key] = value.join(", ")
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
  if (kind === "tournaments" && !entry) values.year = String(new Date().getFullYear())
  return values
}

export function registryContent(kind: RegistryKind, values: Record<string, string>, keys: string[]): Content {
  const content: Record<string, unknown> = {}
  for (const key of keys) {
    if (key.startsWith("result.")) continue
    const value = values[key]?.trim()
    if (!value) continue
    content[key] =
      key === "aliases"
        ? parseTeamAliases(value)
        : ["year", "bestOf"].includes(key)
          ? Number(value)
          : key === "scheduledAt"
            ? new Date(value).toISOString()
            : value
  }
  if (kind === "tournaments") {
    const resultKeys = ["winnerName", "runnerUpName", "winnerScore", "runnerUpScore", "sourceUrl", "verifiedOn"]
    if (resultKeys.some((key) => values[`result.${key}`]?.trim())) {
      const result: Record<string, unknown> = { verification: values["result.verification"] || "UNVERIFIED" }
      for (const key of resultKeys) {
        const value = values[`result.${key}`]?.trim()
        if (value) result[key] = key.endsWith("Score") ? Number(value) : value
      }
      content.result = result as TournamentResult
    }
  } else if (kind === "series") {
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

export function registryFormIssue(kind: RegistryKind, values: Record<string, string>): string | null {
  for (const key of ["sourceUrl", "logoUrl", "photoUrl", "result.sourceUrl"]) {
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
    const winningScore = Math.ceil(Number(values.bestOf || 3) / 2)
    if (result.scoreA == null || result.scoreB == null || !result.sourceUrl)
      return "Kết quả trận cần đủ hai vế tỷ số và link nguồn kiểm chứng."
    if ([result.scoreA, result.scoreB].some((score) => !Number.isInteger(score) || score < 0 || score > winningScore))
      return `Tỷ số phải là số nguyên từ 0 đến ${winningScore} với thể thức này.`
    if (Math.max(result.scoreA, result.scoreB) !== winningScore || result.scoreA === result.scoreB)
      return `Kết quả hoàn tất cần một đội thắng ${winningScore} ván và đội còn lại ít hơn.`
    return null
  }
  if (kind !== "tournaments") return null
  const result = (registryContent(kind, values, []) as TournamentContent).result
  if (!result) return null
  if (!result.winnerName || !result.runnerUpName || !result.sourceUrl)
    return "Kết quả cần đội vô địch, á quân và link nguồn kiểm chứng."
  if (result.winnerName.toLocaleLowerCase() === result.runnerUpName.toLocaleLowerCase())
    return "Đội vô địch và á quân phải khác nhau."
  const hasWinnerScore = result.winnerScore != null
  const hasRunnerScore = result.runnerUpScore != null
  if (hasWinnerScore !== hasRunnerScore) return "Nhập đủ hai vế tỷ số hoặc để trống cả hai."
  if (
    hasWinnerScore &&
    [result.winnerScore, result.runnerUpScore].some((score) => !Number.isInteger(score) || score! < 0 || score! > 99)
  )
    return "Tỷ số phải là số nguyên từ 0 đến 99."
  if (hasWinnerScore && result.winnerScore! <= result.runnerUpScore!) return "Tỷ số đội vô địch phải lớn hơn á quân."
  return null
}
