export type StorageRow = Record<string, unknown>
export interface StorageTable {
  id: string
  name: string
  version: number
  columns: string[]
  idColumn: string | null
  rows: StorageRow[]
  archived: boolean
}

export function validColumn(column: string) {
  return column.trim().length > 0 && !["__proto__", "constructor", "prototype"].includes(column)
}

export function rowId(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("ID must be a string or number.")
  const key = String(value).trim()
  if (!key) throw new Error("ID must not be empty.")
  return key
}

export function validateTable(table: StorageTable) {
  if (!table.name.trim()) throw new Error("Table name must not be empty.")
  if (new Set(table.columns).size !== table.columns.length || table.columns.some((column) => !validColumn(column))) {
    throw new Error("Column names are invalid or duplicated.")
  }
  if (table.idColumn !== null && !table.columns.includes(table.idColumn)) throw new Error("ID column does not exist.")
  if (table.rows.length && !table.idColumn) throw new Error("Select an ID column before adding data.")
  const ids = new Set<string>()
  for (const row of table.rows) {
    if (Object.keys(row).some((column) => !table.columns.includes(column)))
      throw new Error("Row contains an undeclared column.")
    const id = rowId(row[table.idColumn!])
    if (ids.has(id)) throw new Error(`Duplicate ID: ${id}`)
    ids.add(id)
  }
}

export function parseCsv(text: string): StorageRow[] {
  const input = text.replace(/^\uFEFF/, "")
  const firstLine = input.split(/\r?\n/)[0] ?? ""
  const delimiters = [",", ";", "\t"]
  const counts = delimiters.map((delimiter) => {
    let quoted = false,
      count = 0
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') quoted = !quoted
      else if (!quoted && firstLine[i] === delimiter) count++
    }
    return count
  })
  const delimiter = delimiters[counts.indexOf(Math.max(...counts))]!
  const records: string[][] = []
  let record: string[] = [],
    cell = "",
    quoted = false,
    closed = false
  const pushCell = () => {
    record.push(cell)
    cell = ""
    closed = false
  }
  const pushRecord = () => {
    pushCell()
    records.push(record)
    record = []
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
        closed = true
      } else cell += char
    } else if (char === delimiter) pushCell()
    else if (char === "\n" || char === "\r") {
      pushRecord()
      if (char === "\r" && input[i + 1] === "\n") i++
    } else if (char === '"' && cell === "" && !closed) quoted = true
    else {
      if (closed || char === '"') throw new Error("CSV contains invalid quotes.")
      cell += char
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.")
  if (cell || record.length || closed) pushRecord()
  const headers = records.shift()?.map((header) => header.trim()) ?? []
  if (!headers.length || headers.some((header) => !validColumn(header)) || new Set(headers).size !== headers.length) {
    throw new Error("CSV requires unique nonempty column headers.")
  }
  return records
    .filter((row) => row.some((value) => value !== ""))
    .map((row, index) => {
      if (row.length !== headers.length) throw new Error(`CSV row ${index + 2} has an unexpected column count.`)
      return Object.fromEntries(headers.map((header, position) => [header, row[position]]))
    })
}

export function recordArrays(value: unknown): Record<string, StorageRow[]> {
  const isRecords = (rows: unknown): rows is StorageRow[] =>
    Array.isArray(rows) && rows.every((row) => row !== null && typeof row === "object" && !Array.isArray(row))
  if (isRecords(value)) return { "Dữ liệu": value }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const result = Object.fromEntries(Object.entries(value).filter(([, rows]) => isRecords(rows))) as Record<
      string,
      StorageRow[]
    >
    if (Object.keys(result).length) return result
  }
  throw new Error("JSON must contain a record array or an object property containing one.")
}

export interface ImportEntry {
  id: string
  kind: "new" | "update" | "same"
  before: StorageRow | undefined
  after: StorageRow
  changes: string[]
}
export interface ImportPlan {
  columns: string[]
  idColumn: string
  entries: ImportEntry[]
}

export function planImport(
  table: StorageTable,
  source: StorageRow[],
  sourceId: string,
  mapping: Record<string, string>,
): ImportPlan {
  const idColumn = table.idColumn ?? sourceId
  if (!validColumn(sourceId)) throw new Error("Select an ID column.")
  const pairs = Object.entries(mapping).filter(([from, to]) => from !== sourceId && to)
  if (
    pairs.some(([, to]) => !validColumn(to) || to === idColumn) ||
    new Set(pairs.map(([, to]) => to)).size !== pairs.length
  ) {
    throw new Error("Destination columns must be unique and must not replace the ID column.")
  }
  const columns = [...new Set([...table.columns, idColumn, ...pairs.map(([, to]) => to)])]
  const existing = new Map(table.rows.map((row) => [rowId(row[idColumn]), row]))
  const seen = new Set<string>()
  const entries = source.map((row, index): ImportEntry => {
    let id: string
    try {
      id = rowId(row[sourceId])
    } catch {
      throw new Error(`Import row ${index + 1} has an empty or invalid ID.`)
    }
    if (seen.has(id)) throw new Error(`Duplicate import ID: ${id}`)
    seen.add(id)
    const before = existing.get(id)
    const after = { ...before, [idColumn]: before ? before[idColumn] : row[sourceId] }
    for (const [from, to] of pairs) {
      if (Object.hasOwn(row, from)) after[to] = row[from]
    }
    const changes = Object.keys(after).filter(
      (column) => JSON.stringify(before?.[column]) !== JSON.stringify(after[column]),
    )
    return { id, before, after, changes, kind: !before ? "new" : changes.length ? "update" : "same" }
  })
  return { columns, idColumn, entries }
}

export function applyImport(table: StorageTable, plan: ImportPlan, updates: Set<string>): StorageTable {
  const rows = new Map(table.rows.map((row) => [rowId(row[plan.idColumn]), row]))
  for (const entry of plan.entries) {
    if (entry.kind === "new" || (entry.kind === "update" && updates.has(entry.id))) rows.set(entry.id, entry.after)
  }
  const result = { ...table, columns: plan.columns, idColumn: plan.idColumn, rows: [...rows.values()] }
  validateTable(result)
  return result
}
