import { storageErrorMessage } from "./storage-errors"
import { useMemo, useState } from "react"
import { AlertCircle, ArrowLeft, Check, FileUp } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Badge } from "@aov/ui/components/badge"
import {
  applyImport,
  parseCsv,
  planImport,
  recordArrays,
  type ImportPlan,
  type StorageRow,
  type StorageTable,
} from "./storage-model"

export const SELECT_CLASS =
  "h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
export const displayValue = (value: unknown) =>
  value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value)

export function ImportDialog({
  table,
  onClose,
  onSave,
}: {
  table: StorageTable
  onClose: () => void
  onSave: (table: StorageTable) => Promise<void>
}) {
  const [arrays, setArrays] = useState<Record<string, StorageRow[]>>({})
  const [arrayName, setArrayName] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [updates, setUpdates] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [filename, setFilename] = useState("")
  const [filter, setFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number } | null>(null)
  const rows = arrays[arrayName] ?? []
  const columns = useMemo(() => [...new Set(rows.flatMap((row) => Object.keys(row)))], [rows])
  const counts = plan
    ? {
        new: plan.entries.filter((entry) => entry.kind === "new").length,
        update: plan.entries.filter((entry) => entry.kind === "update").length,
        same: plan.entries.filter((entry) => entry.kind === "same").length,
      }
    : null
  const entries = plan?.entries.filter((entry) => filter === "all" || entry.kind === filter) ?? []

  const chooseArray = (name: string, data = arrays) => {
    setArrayName(name)
    const available = [...new Set((data[name] ?? []).flatMap((row) => Object.keys(row)))]
    setSourceId(table.idColumn && available.includes(table.idColumn) ? table.idColumn : "")
    setMapping(
      Object.fromEntries(
        available.map((column) => [column, table.columns.length === 0 || table.columns.includes(column) ? column : ""]),
      ),
    )
    setError("")
  }

  const readFile = async (file: File) => {
    setError("")
    setArrays({})
    setPlan(null)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Import file exceeds 10 MB.")
      const text = await file.text()
      const data = file.name.toLowerCase().endsWith(".csv")
        ? { "Dữ liệu": parseCsv(text) }
        : recordArrays(JSON.parse(text.replace(/^\uFEFF/, "")))
      if (Object.values(data).some((value) => value.length > 10000)) throw new Error("Import exceeds 10000 rows.")
      setArrays(data)
      setFilename(file.name)
      chooseArray(Object.keys(data)[0]!, data)
    } catch (cause) {
      setError(cause instanceof Error ? storageErrorMessage(cause.message) : "Không đọc được file.")
    }
  }

  const preview = () => {
    try {
      if (!rows.length) throw new Error("Import file has no records.")
      setPlan(planImport(table, rows, sourceId, mapping))
      setUpdates(new Set())
      setError("")
      setPage(0)
      setFilter("all")
    } catch (cause) {
      setError(cause instanceof Error ? storageErrorMessage(cause.message) : "Không thể chuẩn bị import.")
    }
  }

  const commit = async () => {
    if (!plan || !counts) return
    setBusy(true)
    setError("")
    try {
      await onSave(applyImport(table, plan, updates))
      setResult({ added: counts.new, updated: updates.size, skipped: counts.update - updates.size + counts.same })
    } catch (cause) {
      setError(cause instanceof Error ? storageErrorMessage(cause.message) : "Không thể lưu.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-4xl"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onInteractOutside={(event) => busy && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import vào {table.name}</DialogTitle>
          <DialogDescription>
            {result
              ? "Đã lưu vào kho JSON của dự án."
              : "Chọn ID, ánh xạ cột và xem xét bản ghi đã tồn tại trước khi lưu."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
        {result ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-medium">
              <Check className="size-5 text-green-600" />
              Import hoàn tất
            </p>
            <p>
              {result.added} dòng mới · {result.updated} cập nhật · {result.skipped} bỏ qua
            </p>
            <Button onClick={onClose}>Đóng</Button>
          </div>
        ) : !plan ? (
          <div className="space-y-5">
            <label className="grid gap-2 text-sm font-medium">
              File JSON hoặc CSV
              <Input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void readFile(file)
                }}
              />
            </label>
            {Object.keys(arrays).length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    Danh sách trong file
                    <select
                      className={SELECT_CLASS}
                      value={arrayName}
                      onChange={(event) => chooseArray(event.target.value)}
                    >
                      {Object.keys(arrays).map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    {table.idColumn
                      ? `Cột ánh xạ với ID “${table.idColumn}”`
                      : "Chọn cột làm ID (duy nhất, không trống)"}
                    <select
                      className={SELECT_CLASS}
                      value={sourceId}
                      onChange={(event) => {
                        setSourceId(event.target.value)
                        setError("")
                      }}
                    >
                      <option value="">Chọn cột ID…</option>
                      {columns.map((column) => (
                        <option key={column}>{column}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {filename} · {rows.length} dòng.{" "}
                  {table.idColumn
                    ? "ID hiện có được giữ nguyên. Chỉ những cột đã chọn mới được bổ sung hoặc cập nhật."
                    : "Giá trị của cột bạn chọn sẽ trở thành ID, không tạo ID mới."}
                </p>
                <div className="rounded-lg border">
                  <div className="grid grid-cols-[2rem_1fr_1fr] gap-3 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                    <span />
                    <span>Cột trong file</span>
                    <span>Cột trong bảng</span>
                  </div>
                  {columns
                    .filter((column) => column !== sourceId)
                    .map((column) => (
                      <div key={column} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-3 px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Import cột ${column}`}
                          checked={Boolean(mapping[column])}
                          onChange={(event) => setMapping({ ...mapping, [column]: event.target.checked ? column : "" })}
                        />
                        <span className="break-all text-sm">{column}</span>
                        <Input
                          aria-label={`Cột đích của ${column}`}
                          list="storage-columns"
                          value={mapping[column] ?? ""}
                          onChange={(event) => setMapping({ ...mapping, [column]: event.target.value })}
                        />
                      </div>
                    ))}
                  <datalist id="storage-columns">
                    {table.columns
                      .filter((column) => column !== table.idColumn)
                      .map((column) => (
                        <option key={column} value={column} />
                      ))}
                  </datalist>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nhập tên cột đích có sẵn để ánh xạ, hoặc tên mới để thêm cột. Cột không chọn được giữ nguyên; ô thiếu
                  trong file không xóa dữ liệu cũ.
                </p>
                <Button onClick={preview} disabled={!sourceId || !rows.length}>
                  <FileUp />
                  Phân tích và xem trước
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{counts!.new} dòng mới</Badge>
              <Badge variant="secondary">{counts!.update} có thay đổi</Badge>
              <Badge variant="outline">{counts!.same} giống hiện tại</Badge>
            </div>
            <p className="text-sm">
              Dòng mới sẽ được thêm. Với ID đã có, tích chọn để cập nhật; không chọn sẽ bỏ qua. ID và các cột không
              import luôn được giữ nguyên.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc kết quả import"
                className={`${SELECT_CLASS} w-auto`}
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value)
                  setPage(0)
                }}
              >
                <option value="all">Tất cả</option>
                <option value="new">Dòng mới</option>
                <option value="update">Có thay đổi</option>
                <option value="same">Giống hiện tại</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setUpdates(new Set(plan.entries.filter((entry) => entry.kind === "update").map((entry) => entry.id)))
                }
              >
                Cập nhật tất cả bản ghi thay đổi
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setUpdates(new Set())}>
                Bỏ qua tất cả cập nhật
              </Button>
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3">Xử lý</th>
                    <th className="p-3">ID</th>
                    <th className="p-3">Thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(page * 30, (page + 1) * 30).map((entry) => (
                    <tr key={entry.id} className="border-t align-top">
                      <td className="p-3">
                        {entry.kind === "update" ? (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={updates.has(entry.id)}
                              aria-label={`Cập nhật ID ${entry.id}`}
                              onChange={(event) =>
                                setUpdates((current) => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(entry.id)
                                  else next.delete(entry.id)
                                  return next
                                })
                              }
                            />
                            {updates.has(entry.id) ? "Cập nhật" : "Bỏ qua"}
                          </label>
                        ) : entry.kind === "new" ? (
                          "Thêm mới"
                        ) : (
                          "Bỏ qua (giống)"
                        )}
                      </td>
                      <td className="p-3 font-mono">{entry.id}</td>
                      <td className="space-y-2 p-3">
                        {entry.changes.map((column) => (
                          <div key={column}>
                            <span className="font-medium">{column}: </span>
                            {entry.before && (
                              <span className="break-all text-muted-foreground">
                                {displayValue(entry.before[column])} →{" "}
                              </span>
                            )}
                            <span className="break-all">{displayValue(entry.after[column])}</span>
                          </div>
                        ))}
                        {entry.kind === "same" && "Không có thay đổi trong các cột đã chọn."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>
                {entries.length} dòng · trang {page + 1}/{Math.max(1, Math.ceil(entries.length / 30))}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || (page + 1) * 30 >= entries.length}
                  onClick={() => setPage(page + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setPlan(null)}>
                <ArrowLeft />
                Ánh xạ lại
              </Button>
              <Button disabled={busy} onClick={() => void commit()}>
                {busy ? "Đang lưu…" : `Lưu ${counts!.new} dòng mới và ${updates.size} cập nhật`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
