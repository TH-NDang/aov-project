import { useMemo } from "react"
import { KeyRound, Pencil, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnHeader } from "@/components/data-table/column-header"
import type { DataColumnDef } from "@/components/data-table/table-features"
import { matchesQuery } from "@/lib/text"
import { displayValue } from "./import-dialog"
import { rowId, type StorageRow, type StorageTable } from "./storage-model"

export function StorageDataTable({
  table,
  busy,
  onEditRow,
  onEditColumn,
  onDeleteRow,
  onDeleteColumn,
}: {
  table: StorageTable
  busy: boolean
  onEditRow: (row: StorageRow) => void
  onEditColumn: (column: string) => void
  onDeleteRow: (row: StorageRow) => void
  onDeleteColumn: (column: string) => void
}) {
  const columns = useMemo<DataColumnDef<StorageRow>[]>(
    () => [
      ...table.columns.map((key): DataColumnDef<StorageRow> => ({
        id: `field:${key}`,
        accessorFn: (row) => row[key],
        meta: { label: key, className: "min-w-40 max-w-80" },
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <ColumnHeader column={column} title={key} />
            {key === table.idColumn ? (
              <KeyRound className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={busy}
                  aria-label={`Đổi tên cột ${key}`}
                  onClick={() => onEditColumn(key)}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  disabled={busy}
                  aria-label={`Xóa cột ${key}`}
                  onClick={() => onDeleteColumn(key)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </>
            )}
          </div>
        ),
        cell: ({ getValue }) => (
          <div className="line-clamp-3 break-words" title={String(displayValue(getValue()))}>
            {displayValue(getValue())}
          </div>
        ),
      })),
      {
        id: "actions",
        header: "Thao tác",
        enableHiding: false,
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Sửa dòng ${rowId(row.original[table.idColumn!])}`}
              disabled={busy}
              onClick={() => onEditRow(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Xóa dòng ${rowId(row.original[table.idColumn!])}`}
              disabled={busy}
              onClick={() => onDeleteRow(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [table.columns, table.idColumn, busy, onEditRow, onEditColumn, onDeleteRow, onDeleteColumn],
  )

  return (
    <DataTable
      key={table.id}
      columns={columns}
      data={table.rows}
      getRowId={(row) => rowId(row[table.idColumn!])}
      matchesSearch={(row, query) =>
        matchesQuery(query, ...Object.values(row).map((value) => String(displayValue(value))))
      }
      searchPlaceholder="Tìm trong bảng…"
      pageSizes={[10, 25, 50, 100]}
      emptyMessage={
        table.columns.length
          ? "Chưa có dòng phù hợp. Thêm dòng hoặc import dữ liệu."
          : "Bảng chưa có cột. Thêm cột hoặc chọn file import."
      }
    />
  )
}
