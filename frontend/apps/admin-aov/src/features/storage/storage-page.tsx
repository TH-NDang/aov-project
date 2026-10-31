import { useChangeEffect } from "@/hooks/use-change-effect"
import { storageErrorMessage } from "./storage-errors"
import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Database, Download, FileUp, KeyRound, Pencil, Plus, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { Input } from "@aov/ui/components/input"
import { Badge } from "@aov/ui/components/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
import { Page, PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { ImportDialog, SELECT_CLASS, displayValue } from "./import-dialog"
import { StorageDataTable } from "./storage-data-table"
import { storageApi } from "./storage-api"
import { rowId, validColumn, validateTable, type StorageRow, type StorageTable } from "./storage-model"

type Editor = { kind: "create" | "rename" | "column" | "row"; column?: string; row?: StorageRow }

export function StoragePage() {
  const client = useQueryClient()
  const [selected, setSelected] = useSearchParam("table")
  const tables = useQuery({ queryKey: ["storage"], queryFn: storageApi.list })
  const query = useQuery({
    queryKey: ["storage", selected],
    queryFn: () => storageApi.get(selected),
    enabled: Boolean(selected),
  })
  const table = query.data
  const [editor, setEditor] = useState<Editor | null>(null)
  const [text, setText] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [archived, setArchived] = useState(false)
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; next: StorageTable } | null>(
    null,
  )
  const mutation = useMutation({
    mutationFn: storageApi.save,
    onSuccess: (saved) => {
      client.setQueryData(["storage", saved.id], saved)
      void client.invalidateQueries({ queryKey: ["storage"], exact: true })
    },
  })
  useChangeEffect(() => {
    setEditor(null)
    setImportOpen(false)
    setError("")
  }, [selected])
  const save = async (next: StorageTable) => {
    validateTable(next)
    await mutation.mutateAsync(next)
  }
  const run = async (next: StorageTable) => {
    try {
      await save(next)
      toast.success("Đã lưu bảng JSON.")
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? storageErrorMessage(cause.message) : "Không thể lưu.")
    }
  }
  const openEditor = useCallback(
    (next: Editor) => {
      setEditor(next)
      setError("")
      setText(next.kind === "rename" ? (table?.name ?? "") : (next.column ?? ""))
      setFields(
        Object.fromEntries(
          (table?.columns ?? []).map((column) => [
            column,
            next.row?.[column] === undefined ? "" : String(displayValue(next.row[column])),
          ]),
        ),
      )
    },
    [table],
  )
  const editRow = useCallback((row: StorageRow) => openEditor({ kind: "row", row }), [openEditor])
  const editColumn = useCallback((column: string) => openEditor({ kind: "column", column }), [openEditor])
  const deleteRow = useCallback(
    (row: StorageRow) => {
      if (!table?.idColumn) return
      setConfirmation({
        title: "Xóa dòng dữ liệu?",
        description: `Dòng có ID ${rowId(row[table.idColumn])} sẽ bị xóa khỏi bảng.`,
        next: {
          ...table,
          rows: table.rows.filter((item) => rowId(item[table.idColumn!]) !== rowId(row[table.idColumn!])),
        },
      })
    },
    [table],
  )
  const deleteColumn = useCallback(
    (column: string) => {
      if (!table || column === table.idColumn) return
      setConfirmation({
        title: `Xóa cột ${column}?`,
        description: "Các giá trị trong cột này cũng sẽ bị xóa. Bạn có thể xuất JSON để giữ bản sao.",
        next: {
          ...table,
          columns: table.columns.filter((key) => key !== column),
          rows: table.rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== column))),
        },
      })
    },
    [table],
  )
  const submitEditor = async () => {
    try {
      if (!editor) return
      if (editor.kind === "create") {
        setCreating(true)
        const created = await storageApi.create(text.trim())
        await client.invalidateQueries({ queryKey: ["storage"], exact: true })
        setSelected(created.id)
      } else if (table) {
        let next = table
        if (editor.kind === "rename") next = { ...table, name: text.trim() }
        if (editor.kind === "column") {
          const column = text.trim()
          if (!validColumn(column) || (column !== editor.column && table.columns.includes(column)))
            throw new Error("Column name is invalid or already exists.")
          next = {
            ...table,
            columns: editor.column
              ? table.columns.map((key) => (key === editor.column ? column : key))
              : [...table.columns, column],
            rows: editor.column
              ? table.rows.map((row) =>
                  Object.fromEntries(
                    Object.entries(row).map(([key, value]) => [key === editor.column ? column : key, value]),
                  ),
                )
              : table.rows,
          }
        }
        if (editor.kind === "row") {
          if (!table.idColumn) throw new Error("Select an ID column before adding rows.")
          const row = Object.fromEntries(
            table.columns.map((column) => {
              const old = editor.row?.[column]
              const value = fields[column] ?? ""
              if (
                editor.row &&
                (old === null || typeof old === "number" || typeof old === "boolean" || typeof old === "object")
              ) {
                return [column, JSON.parse(value)]
              }
              return [column, editor.row && column === table.idColumn ? old : value]
            }),
          )
          next = {
            ...table,
            rows: editor.row
              ? table.rows.map((current) =>
                  rowId(current[table.idColumn!]) === rowId(editor.row![table.idColumn!]) ? row : current,
                )
              : [...table.rows, row],
          }
        }
        await save(next)
      }
      setEditor(null)
      setError("")
      toast.success("Đã lưu.")
    } catch (cause) {
      setError(cause instanceof Error ? storageErrorMessage(cause.message) : "Không thể lưu.")
    } finally {
      setCreating(false)
    }
  }

  const exportTable = () => {
    if (!table) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(table, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${table.name.replace(/[^\p{L}\p{N}._-]/gu, "-")}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Page>
      <PageHeader
        title="Lưu trữ"
        actions={
          <PageActionsMenu label="Tạo bảng lưu trữ">
            <DropdownMenuItem onSelect={() => openEditor({ kind: "create" })}>
              <Plus />
              Tạo bảng
            </DropdownMenuItem>
          </PageActionsMenu>
        }
      />
      {(tables.error || query.error || error) && !editor && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error || storageErrorMessage((query.error ?? tables.error)?.message ?? "")}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-56 gap-2 text-sm">
          Bảng dữ liệu
          <select className={SELECT_CLASS} value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Chọn bảng…</option>
            {tables.data
              ?.filter((item) => archived || !item.archived)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.rowCount} dòng{item.archived ? " (đã ẩn)" : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Hiện bảng đã ẩn
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void tables.refetch()
            if (selected) void query.refetch()
          }}
        >
          <RotateCcw />
          Tải lại
        </Button>
      </div>
      {!selected ? (
        <div className="grid justify-items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <Database className="size-8 text-muted-foreground" />
          <p>Tạo một bảng rồi import JSON/CSV, hoặc chọn bảng đã có.</p>
        </div>
      ) : query.isLoading ? (
        <p>Đang tải bảng…</p>
      ) : (
        table && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-lg font-bold">{table.name}</h2>
              <Badge variant="outline">
                {table.rows.length} dòng · {table.columns.length} cột
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Đổi tên bảng"
                disabled={mutation.isPending}
                onClick={() => openEditor({ kind: "rename" })}
              >
                <Pencil />
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" disabled={mutation.isPending} onClick={() => openEditor({ kind: "column" })}>
                  <Plus />
                  Thêm cột
                </Button>
                <Button
                  variant="outline"
                  disabled={mutation.isPending || !table.idColumn}
                  onClick={() => openEditor({ kind: "row" })}
                >
                  <Plus />
                  Thêm dòng
                </Button>
                <Button variant="outline" onClick={exportTable}>
                  <Download />
                  Xuất JSON
                </Button>
                <Button
                  disabled={mutation.isPending}
                  onClick={() => {
                    setError("")
                    setImportOpen(true)
                  }}
                >
                  <FileUp />
                  Import
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={table.archived ? "Khôi phục bảng" : "Ẩn bảng"}
                  disabled={mutation.isPending}
                  onClick={() => {
                    void run({ ...table, archived: !table.archived })
                    setArchived(true)
                  }}
                >
                  {table.archived ? <RotateCcw /> : <Archive />}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {table.idColumn && table.rows.length ? (
                <Badge variant="secondary">
                  <KeyRound className="mr-1 size-3" />
                  ID: {table.idColumn}
                </Badge>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  Cột ID
                  <select
                    aria-label="Cột ID"
                    className={`${SELECT_CLASS} w-auto`}
                    value={table.idColumn ?? ""}
                    disabled={mutation.isPending}
                    onChange={(event) => void run({ ...table, idColumn: event.target.value || null })}
                  >
                    <option value="">Chọn khi import…</option>
                    {table.columns.map((column) => (
                      <option key={column}>{column}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <StorageDataTable
              table={table}
              busy={mutation.isPending}
              onEditRow={editRow}
              onEditColumn={editColumn}
              onDeleteRow={deleteRow}
              onDeleteColumn={deleteColumn}
            />
          </>
        )
      )}
      {table && importOpen && <ImportDialog table={table} onClose={() => setImportOpen(false)} onSave={save} />}
      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && !mutation.isPending && setEditor(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editor?.kind === "create"
                ? "Tạo bảng"
                : editor?.kind === "rename"
                  ? "Đổi tên bảng"
                  : editor?.kind === "column"
                    ? editor.column
                      ? "Đổi tên cột"
                      : "Thêm cột"
                    : editor?.row
                      ? "Sửa dòng"
                      : "Thêm dòng"}
            </DialogTitle>
            <DialogDescription>
              {editor?.kind === "row"
                ? "ID của dòng đã có không thay đổi. Giá trị số, đúng/sai hoặc đối tượng giữ định dạng JSON khi sửa."
                : "Tên cần duy nhất, không để trống."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {editor?.kind === "row" ? (
            table?.columns.map((column) => (
              <label key={column} className="grid gap-2 text-sm">
                {column}
                {column === table.idColumn && " (ID)"}
                <Input
                  value={fields[column] ?? ""}
                  disabled={Boolean(editor.row) && column === table.idColumn}
                  onChange={(event) => setFields({ ...fields, [column]: event.target.value })}
                />
              </label>
            ))
          ) : (
            <Input
              aria-label="Tên"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void submitEditor()}
            />
          )}
          <Button disabled={mutation.isPending || creating} onClick={() => void submitEditor()}>
            {mutation.isPending || creating ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmation && void run(confirmation.next)}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
