import type { DocumentView } from "@aov/community-contracts"
import { tournamentApi } from "./tournament-api"
import type { ImportContent, ImportKind, ImportRow, RegistryImport } from "./registry-import-model"

type Api = Pick<typeof tournamentApi, "list" | "read" | "create" | "save" | "restore">
type Records = Record<ImportKind, DocumentView<ImportContent>[]>
export type ImportOperation = "create" | "update" | "restore" | "skip"
export type PreparedImportRow = { row: ImportRow; operation: ImportOperation }
export type ImportProgress = { completed: number; total: number; row?: ImportRow; operation?: ImportOperation }
export class RegistryImportFailure extends Error {
  constructor(
    readonly row: ImportRow,
    readonly completed: number,
    override readonly cause: unknown,
  ) {
    super(`Không nhập được ${row.label}.`)
  }
}

async function loadRecords(plan: RegistryImport, api: Api, signal?: AbortSignal): Promise<Records> {
  const required = new Set(plan.rows.map((row) => row.kind))
  for (const row of plan.rows) {
    if (row.references.tournamentCode) required.add("tournaments")
    if (row.references.teamCode || row.references.teamACode || row.references.teamBCode) required.add("teams")
    if (row.references.playerCode) required.add("players")
  }
  const result: Records = { teams: [], players: [], tournaments: [], "roster-memberships": [], series: [] }
  await Promise.all(
    [...required].map(async (kind) => {
      result[kind] = await api.list(kind, signal, { state: "ALL" })
    }),
  )
  return result
}
function byCode(records: Records, kind: ImportKind, code: string) {
  return records[kind].find((entry) => "code" in entry.content && entry.content.code === code)
}
function sameContent(left: unknown, right: unknown): boolean {
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item != null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, ordered(item)]),
      )
    return value
  }
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right))
}
function matchRow(row: ImportRow, records: Records, resolve: (kind: ImportKind, code: string) => string) {
  if (row.kind !== "roster-memberships") {
    const previous = byCode(records, row.kind, row.matchCode ?? row.key)
    const current = byCode(records, row.kind, row.key)
    if (previous && current && previous.id !== current.id)
      throw new Error(`Mã ${row.key} đã thuộc mục khác. Không tự gộp dữ liệu.`)
    return previous ?? current
  }
  const tournamentId = resolve("tournaments", row.references.tournamentCode!)
  const teamId = resolve("teams", row.references.teamCode!)
  const playerId = resolve("players", row.references.playerCode!)
  return records[row.kind].find((entry) => {
    const value = entry.content as unknown as Record<string, unknown>
    return value.tournamentId === tournamentId && value.teamId === teamId && value.playerId === playerId
  })
}
function desiredContent(
  row: ImportRow,
  existing: DocumentView<ImportContent> | undefined,
  resolve: (kind: ImportKind, code: string) => string,
) {
  const content = { ...(existing?.content as unknown as Record<string, unknown> | undefined), ...row.content }
  for (const key of ["logoUrl", "photoUrl"])
    if (row.content[key] == null && existing && key in existing.content)
      content[key] = (existing.content as unknown as Record<string, unknown>)[key]
  const fields = {
    tournamentCode: ["tournamentId", "tournaments"],
    teamCode: ["teamId", "teams"],
    playerCode: ["playerId", "players"],
    teamACode: ["teamAId", "teams"],
    teamBCode: ["teamBId", "teams"],
  } as const
  for (const [key, [field, kind]] of Object.entries(fields)) {
    const code = row.references[key as keyof typeof fields]
    if (code) content[field] = resolve(kind, code)
  }
  return content as ImportContent
}
function resolver(records: Records, plan: RegistryImport, preview: boolean) {
  return (kind: ImportKind, code: string) => {
    const planned = plan.rows.find((row) => row.kind === kind && row.key === code)
    const entry =
      byCode(records, kind, code) ?? (planned?.matchCode ? byCode(records, kind, planned.matchCode) : undefined)
    if (entry && (!entry.deletedAt || (preview && planned))) return entry.id
    if (preview && planned) return `new:${kind}:${code}`
    throw new Error(`Chưa có ${code} đang dùng. Nhập hoặc khôi phục mục cha trước; không tự khôi phục mục ngoài file.`)
  }
}
export async function prepareRegistryImport(
  plan: RegistryImport,
  api: Api = tournamentApi,
  signal?: AbortSignal,
): Promise<PreparedImportRow[]> {
  const records = await loadRecords(plan, api, signal)
  const resolve = resolver(records, plan, true)
  return plan.rows.map((row) => {
    const existing = matchRow(row, records, resolve)
    const content = desiredContent(row, existing, resolve)
    return {
      row,
      operation: !existing
        ? "create"
        : existing.deletedAt
          ? "restore"
          : sameContent(existing.content, content)
            ? "skip"
            : "update",
    }
  })
}
export async function runRegistryImport(
  plan: RegistryImport,
  options: { api?: Api; shouldStop?: () => boolean; onProgress?: (progress: ImportProgress) => void } = {},
) {
  const api = options.api ?? tournamentApi
  const records = await loadRecords(plan, api)
  const resolve = resolver(records, plan, false)
  let completed = 0
  for (const row of plan.rows) {
    if (options.shouldStop?.()) return { completed, stopped: true }
    try {
      let entry = matchRow(row, records, resolve)
      let operation: ImportOperation = "create"
      if (entry) {
        entry = await api.read(row.kind, entry.id)
        if (entry.deletedAt) {
          const restored = await api.restore(row.kind, entry)
          entry = await api.read(row.kind, restored.id)
          if (entry.deletedAt || entry.version !== restored.version)
            throw new Error("Chưa xác nhận được phiên bản vừa khôi phục. Hãy nhập lại file để tiếp tục.")
          operation = "restore"
        } else operation = "update"
      }
      const content = desiredContent(row, entry, resolve)
      if (entry && sameContent(entry.content, content)) operation = operation === "restore" ? "restore" : "skip"
      else if (entry) entry = await api.save(row.kind, entry, content)
      else entry = await api.create(row.kind, content)
      records[row.kind] = [...records[row.kind].filter((existing) => existing.id !== entry!.id), entry]
      completed++
      options.onProgress?.({ completed, total: plan.rows.length, row, operation })
    } catch (cause) {
      throw new RegistryImportFailure(row, completed, cause)
    }
  }
  return { completed, stopped: false }
}
