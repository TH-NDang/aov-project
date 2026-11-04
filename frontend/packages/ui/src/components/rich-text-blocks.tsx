import { useState, type ReactNode } from "react"
import { paragraphStyles, tableLimits, type ParagraphStyle } from "../lib/rich-text-blocks"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"
import { Button } from "./button"

export function RichParagraph({ style, children }: { style: ParagraphStyle; children: ReactNode }) {
  return (
    <span className={paragraphStyles[style].classes}>
      {style !== "note" && (
        <span className="block text-xs font-semibold text-foreground">{paragraphStyles[style].label}</span>
      )}
      {children}
    </span>
  )
}

/** Phrasing elements allow the same accessible grid inside descriptions, including paragraph hosts. */
export function ExampleTable({ rows }: { rows: string[][] }) {
  return (
    <span className="my-2 block max-w-full overflow-x-auto rounded-md border text-left text-sm text-foreground">
      <span role="table" aria-label="Bảng ví dụ" className="table w-full border-collapse tabular-nums">
        {rows.map((row, r) => (
          <span key={r} role="row" className={r ? "table-row border-t" : "table-row bg-muted"}>
            {row.map((cell, c) => (
              <span
                key={c}
                role={r ? "cell" : "columnheader"}
                className={`table-cell min-w-12 px-2 py-1 align-top whitespace-pre-wrap break-words ${r ? "" : "type-label"}`}
              >
                {cell}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}

export function ExampleTableDialog({
  initial,
  onSave,
  onCancel,
}: {
  initial?: string[][]
  onSave: (rows: string[][]) => boolean
  onCancel: () => void
}) {
  const [rows, setRows] = useState(
    () =>
      initial ?? [
        ["", ""],
        ["", ""],
      ],
  )
  const [error, setError] = useState("")
  const width = rows[0]!.length
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="max-h-[85dvh] max-w-[min(38rem,95vw)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa bảng ví dụ" : "Chèn bảng ví dụ"}</DialogTitle>
          <DialogDescription>Hàng đầu là tiêu đề cột. Nhập giá trị minh họa ở các hàng bên dưới.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={r ? "p-1" : "bg-muted p-1"}>
                      <input
                        className="h-9 w-full min-w-20 rounded border bg-background px-2"
                        aria-label={r ? `Hàng ${r}, cột ${c + 1}` : `Tiêu đề cột ${c + 1}`}
                        placeholder={r ? "Giá trị" : `Tiêu đề ${c + 1}`}
                        maxLength={tableLimits.cell}
                        value={cell}
                        onChange={(e) => {
                          setError("")
                          setRows(
                            rows.map((line, i) =>
                              i === r ? line.map((v, j) => (j === c ? e.target.value : v)) : line,
                            ),
                          )
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length >= tableLimits.rows}
            onClick={() => setRows([...rows, Array(width).fill("")])}
          >
            Thêm hàng
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={width >= tableLimits.columns}
            onClick={() => setRows(rows.map((row) => [...row, ""]))}
          >
            Thêm cột
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={rows.length <= 2}
            onClick={() => setRows(rows.slice(0, -1))}
          >
            Bỏ hàng cuối
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={width <= 1}
            onClick={() => setRows(rows.map((row) => row.slice(0, -1)))}
          >
            Bỏ cột cuối
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (
                rows[0]!.some((cell) => !cell.trim()) ||
                !rows.slice(1).some((row) => row.some((cell) => cell.trim()))
              ) {
                setError("Điền tên cho từng cột và ít nhất một giá trị ví dụ.")
              } else if (!onSave(rows)) setError("Không thể chèn bảng. Kiểm tra giới hạn độ dài hoặc mở lại bảng.")
            }}
          >
            {initial ? "Áp dụng" : "Chèn bảng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
