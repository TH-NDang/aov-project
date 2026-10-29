import { safeLinkUrl } from "@aov/ui/lib/entity-rich-text"
import { recordLabel, RECORD_KIND_LABELS } from "./record-lifecycle-model"
import type { TournamentRecords } from "./tournament-api"
import { registryFormIssue } from "./registry-form-model"
import { rosterFormIssue } from "./roster-model"
import type { RosterMembershipContent } from "@aov/community-contracts"

export const MAX_REGISTRY_IMPORT_BYTES = 1024 * 1024
export const IMPORT_KINDS = ["teams", "players", "tournaments", "roster-memberships", "series"] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]
export type ImportContent = TournamentRecords[ImportKind]
export type ImportRow = {
  kind: ImportKind
  key: string
  label: string
  matchCode?: string
  content: Record<string, unknown>
  references: {
    tournamentCode?: string
    teamCode?: string
    playerCode?: string
    teamACode?: string
    teamBCode?: string
  }
}
export type RegistryImport = { rows: ImportRow[]; skipped: number; asOf?: string }
const FIELDS: Record<ImportKind, string[]> = {
  teams: ["code", "name", "shortName", "country", "logoUrl", "aliases"],
  players: ["code", "nickname", "fullName", "country", "photoUrl", "aliases"],
  tournaments: [
    "code",
    "name",
    "region",
    "year",
    "startsOn",
    "endsOn",
    "sourceUrl",
    "note",
    "logoUrl",
    "tier",
    "competitionType",
    "venueMode",
    "status",
    "result",
  ],
  series: ["code", "name", "stage", "bestOf", "scheduledAt", "sourceUrl", "note", "result"],
  "roster-memberships": ["lane", "jerseyNumber", "status", "startsOn", "endsOn", "sourceUrl", "verification", "note"],
}
const ENUMS: Record<string, string[]> = {
  lane: ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"],
  tier: ["S", "A", "B", "C", "UNKNOWN"],
  competitionType: ["LEAGUE", "CUP", "QUALIFIER", "UNKNOWN"],
  venueMode: ["ONLINE", "OFFLINE", "HYBRID", "UNKNOWN"],
  verification: ["PRIMARY", "SECONDARY_CORROBORATED", "SECONDARY_CAPTURE", "SECONDARY_PRESS_ONLY", "UNVERIFIED"],
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: cần một đối tượng JSON.`)
  return value as Record<string, unknown>
}
function code(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}: thiếu mã tham chiếu.`)
  const result = value.normalize("NFC").trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 100)
    throw new Error(`${label}: mã cần chữ thường không dấu, số và dấu gạch nối.`)
  return result
}
function validCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  )
}
function cleanField(key: string, value: unknown, label: string): unknown {
  if (value == null) {
    if (key === "aliases") return []
    if (key === "verification") return "UNVERIFIED"
    if (["tier", "competitionType", "venueMode", "status"].includes(key)) return "UNKNOWN"
    return null
  }
  if (key === "aliases") {
    if (
      !Array.isArray(value) ||
      value.length > 20 ||
      value.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > 100)
    )
      throw new Error(`${label}: tên khác chưa hợp lệ.`)
    return [...new Map((value as string[]).map((item) => [item.trim().toLocaleLowerCase(), item.trim()])).values()]
  }
  if (["year", "bestOf", "scoreA", "scoreB", "winnerScore", "runnerUpScore"].includes(key)) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 9999)
      throw new Error(`${label}: cần số nguyên không âm.`)
    return value
  }
  const limit = ["name", "nickname", "fullName", "winnerName", "runnerUpName"].includes(key)
    ? 200
    : key === "shortName"
      ? 100
      : key === "jerseyNumber"
        ? 20
        : key === "note"
          ? 2000
          : key.endsWith("Url")
            ? 2048
            : 4000
  if (typeof value !== "string" || value.length > limit)
    throw new Error(`${label}: giá trị vượt giới hạn ${limit} ký tự hoặc chưa hợp lệ.`)
  const text = value.trim()
  if (key === "code") return code(text, label)
  if (key.endsWith("Url") && text && (!safeLinkUrl(text) || !/^https?:\/\//i.test(text)))
    throw new Error(`${label}: cần link http hoặc https hợp lệ.`)
  if (["startsOn", "endsOn", "verifiedOn"].includes(key) && text && !validCalendarDate(text))
    throw new Error(`${label}: ngày chưa hợp lệ.`)
  if (key === "scheduledAt" && text && (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) || Number.isNaN(Date.parse(text))))
    throw new Error(`${label}: lịch thi đấu cần thời gian có múi giờ.`)
  if (key === "scheduledAt" && text && !validCalendarDate(text.slice(0, 10)))
    throw new Error(`${label}: ngày lịch thi đấu chưa hợp lệ.`)
  if (ENUMS[key] && !ENUMS[key].includes(text)) throw new Error(`${label}: lựa chọn chưa được hỗ trợ.`)
  return text
}
function content(kind: ImportKind, value: unknown, label: string) {
  const source = object(value, label)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (!FIELDS[kind].includes(key)) throw new Error(`${label}: trường “${key}” chưa được hỗ trợ.`)
    if (key === "result" && value != null) {
      const fields =
        kind === "series"
          ? ["scoreA", "scoreB", "sourceUrl", "verification", "verifiedOn"]
          : ["winnerName", "runnerUpName", "winnerScore", "runnerUpScore", "sourceUrl", "verification", "verifiedOn"]
      result[key] = {
        verification: "UNVERIFIED",
        ...Object.fromEntries(
          Object.entries(object(value, `${label}.result`)).map(([field, detail]) => {
            if (!fields.includes(field)) throw new Error(`${label}.result: trường “${field}” chưa được hỗ trợ.`)
            return [field, cleanField(field, detail, `${label}.result.${field}`)]
          }),
        ),
      }
    } else result[key] = cleanField(key, value, `${label}.${key}`)
  }
  for (const field of kind === "teams" || kind === "tournaments"
    ? ["code", "name"]
    : kind === "players"
      ? ["code", "nickname"]
      : kind === "series"
        ? ["code", "bestOf"]
        : [])
    if (!result[field]) throw new Error(`${label}: thiếu ${field}.`)
  if (kind === "tournaments" && !result.region) throw new Error(`${label}: thiếu thị trường.`)
  if (kind === "series" && ![1, 3, 5, 7, 9].includes(result.bestOf as number))
    throw new Error(`${label}: thể thức BO chưa hợp lệ.`)
  if (
    result.status != null &&
    !(
      kind === "roster-memberships"
        ? ["ACTIVE", "SUBSTITUTE", "INACTIVE", "UNKNOWN"]
        : ["UPCOMING", "ONGOING", "FINISHED", "ANNOUNCED", "UNKNOWN"]
    ).includes(String(result.status))
  )
    throw new Error(`${label}: trạng thái chưa hợp lệ.`)
  return result
}

function validateContent(
  kind: ImportKind,
  data: Record<string, unknown>,
  references: ImportRow["references"],
  label: string,
) {
  if (data.startsOn && data.endsOn && String(data.startsOn) > String(data.endsOn))
    throw new Error(`${label}: ngày kết thúc không được trước ngày bắt đầu.`)
  if (kind === "roster-memberships") {
    const issue = rosterFormIssue({
      ...data,
      tournamentId: references.tournamentCode,
      teamId: references.teamCode,
      playerId: references.playerCode,
    } as RosterMembershipContent)
    if (issue) throw new Error(`${label}: ${issue}`)
    return
  }
  if (data.result != null) {
    const result = data.result as Record<string, unknown>
    const required = kind === "series" ? ["scoreA", "scoreB", "sourceUrl"] : ["winnerName", "runnerUpName", "sourceUrl"]
    if (required.some((field) => result[field] == null || result[field] === ""))
      throw new Error(`${label}: kết quả cần đủ hai đội hoặc tỷ số và link nguồn.`)
  }
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === "result" && value)
      for (const [field, detail] of Object.entries(value as Record<string, unknown>)) {
        if (detail != null) values[`result.${field}`] = String(detail)
      }
    else if (value != null) values[key] = Array.isArray(value) ? value.join(", ") : String(value)
  }
  if (kind === "series") {
    values.teamAId = references.teamACode!
    values.teamBId = references.teamBCode!
  }
  const issue = registryFormIssue(kind, values)
  if (issue) throw new Error(`${label}: ${issue}`)
}

export function parseRegistryImport(text: string): RegistryImport {
  if (new TextEncoder().encode(text).byteLength > MAX_REGISTRY_IMPORT_BYTES)
    throw new Error("File JSON không được lớn hơn 1 MB.")
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Không đọc được JSON. Kiểm tra định dạng file.")
  }
  const source = object(parsed, "File")
  if (source.schemaVersion !== 1) throw new Error("Chỉ hỗ trợ JSON schemaVersion: 1.")
  if (source.games != null) throw new Error("Luồng này không nhập hoặc tự tạo ván đấu.")
  const rows: ImportRow[] = []
  let skipped = 0
  const eventCode = source.scope ? object(source.scope, "scope").eventCode : undefined
  const append = (kind: ImportKind, raw: unknown, index: number) => {
    const label = `${RECORD_KIND_LABELS[kind]} · dòng ${index + 1}`
    const row = object(raw, label)
    if (row.importReady === false) {
      skipped++
      return
    }
    if (row.importReady != null && row.importReady !== true)
      throw new Error(`${label}: importReady cần true hoặc false.`)
    const data = content(kind, row.content, label)
    const references: ImportRow["references"] = {}
    if (kind === "roster-memberships") {
      references.tournamentCode = code(row.tournamentCode ?? eventCode, `${label}.tournamentCode`)
      references.teamCode = code(row.teamCode, `${label}.teamCode`)
      references.playerCode = code(row.playerCode, `${label}.playerCode`)
    } else if (kind === "series") {
      references.tournamentCode = code(row.tournamentCode ?? eventCode, `${label}.tournamentCode`)
      references.teamACode = code(row.teamACode, `${label}.teamACode`)
      references.teamBCode = code(row.teamBCode, `${label}.teamBCode`)
      if (references.teamACode === references.teamBCode) throw new Error(`${label}: hai đội cần khác nhau.`)
    }
    validateContent(kind, data, references, label)
    const key =
      kind === "roster-memberships"
        ? [references.tournamentCode, references.teamCode, references.playerCode].join("/")
        : String(data.code)
    rows.push({
      kind,
      key,
      label:
        kind === "roster-memberships" ? `${references.playerCode} · ${references.teamCode}` : recordLabel(kind, data),
      matchCode: row.existingCode == null ? undefined : code(row.existingCode, `${label}.existingCode`),
      content: data,
      references,
    })
  }
  for (const kind of IMPORT_KINDS) {
    const key = kind === "roster-memberships" ? "rosters" : kind
    const raw = kind === "tournaments" && source.tournament != null ? [source.tournament] : source[key]
    if (raw == null) continue
    if (!Array.isArray(raw)) throw new Error(`${key}: cần một mảng JSON.`)
    raw.forEach((row, index) => append(kind, row, index))
  }
  if (!rows.length) throw new Error("File không có mục sẵn sàng để nhập.")
  if (rows.length > 2000) throw new Error("Mỗi lần nhập tối đa 2.000 mục.")
  const keys = new Set<string>()
  for (const row of rows) {
    const key = `${row.kind}:${row.key}`
    if (keys.has(key)) throw new Error(`Trùng mục ${row.label} (${row.key}) trong file.`)
    keys.add(key)
    if (row.kind === "roster-memberships") {
      const player =
        rows.find((entry) => entry.kind === "players" && entry.key === row.references.playerCode)?.label ||
        row.references.playerCode
      const team =
        rows.find((entry) => entry.kind === "teams" && entry.key === row.references.teamCode)?.label ||
        row.references.teamCode
      row.label = `${player} · ${team}`
    }
  }
  return { rows, skipped, asOf: typeof source.asOf === "string" ? source.asOf : undefined }
}

export function importCounts(rows: ImportRow[]) {
  return IMPORT_KINDS.map((kind) => ({
    kind,
    label: RECORD_KIND_LABELS[kind],
    count: rows.filter((row) => row.kind === kind).length,
  })).filter((entry) => entry.count)
}
