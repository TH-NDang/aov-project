import { useState, type ReactNode } from "react"
import { Copy, PencilLine, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { confirmAction } from "@/components/confirm-dialog"
import { RowMenu } from "../entry-controls"
import { normalize } from "@/lib/text"
import { CodeLine } from "./guide-fields"

interface ListRow {
  key: string
  index: number
  title: string
  meta?: ReactNode
  icon?: ReactNode
  warn?: boolean
}

/**
 * The list of one kind of entry, grouped, with a search; the selected entry is edited beside it. This keeps every
 * long list to one screen instead of a page of forms.
 */
export function MasterDetail({
  title,
  groups,
  selected,
  onSelect,
  onAdd,
  addLabel,
  children,
  footer,
}: {
  title: string
  groups: { key: string; label: ReactNode; rows: ListRow[] }[]
  selected: number
  onSelect: (index: number) => void
  onAdd: () => void
  addLabel: string
  children: ReactNode
  footer?: ReactNode
}) {
  const [search, setSearch] = useState("")
  const needle = normalize(search.trim())
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="grid gap-2 rounded-lg border bg-card p-3 lg:sticky lg:top-14">
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-section-title">
            {title} <span className="type-meta">{total}</span>
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={onAdd} title={addLabel}>
            <Plus /> Thêm
          </Button>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Tìm…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="grid max-h-[64vh] gap-3 overflow-y-auto pr-1">
          {groups.map((group) => {
            const rows = group.rows.filter((row) => !needle || normalize(row.title).includes(needle))
            if (!rows.length) return null
            return (
              <section key={group.key} className="grid gap-0.5">
                <h3 className="type-label flex items-center gap-1.5 px-1 py-1">
                  {group.label} <span className="type-meta">{rows.length}</span>
                </h3>
                <ul className="grid gap-0.5">
                  {rows.map((row) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        aria-current={row.index === selected || undefined}
                        onClick={() => onSelect(row.index)}
                        className={`type-body flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60 ${
                          row.index === selected ? "bg-muted ring-1 ring-primary/50" : ""
                        }`}
                      >
                        {row.icon}
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate">{row.title || "(chưa đặt tên)"}</span>
                          {row.meta && <span className="type-meta truncate">{row.meta}</span>}
                        </span>
                        {row.warn && (
                          <span className="size-2 shrink-0 rounded-full bg-(--aov-warning)" title="Còn thiếu dữ liệu" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
        {footer}
      </section>
      <div className="grid min-w-0 gap-3">{children}</div>
    </div>
  )
}

/** The selected entry's picture, name and code, with every other change to it in the "⋯" menu. */
export function DetailHeader({
  icon,
  title,
  code,
  onRename,
  onDuplicate,
  onDelete,
  deleteLabel,
}: {
  icon: ReactNode
  title: ReactNode
  code: string
  onRename: (code: string) => void
  onDuplicate: () => void
  onDelete: () => void
  deleteLabel: string
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const editing = renaming === code
  return (
    <header className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      {icon}
      <div className="grid min-w-0 flex-1 gap-1">
        <h2 className="type-section-title truncate">{title}</h2>
        <CodeLine
          code={code}
          onRename={onRename}
          editing={editing}
          onEditing={(open) => setRenaming(open ? code : null)}
        />
      </div>
      <RowMenu
        size="icon"
        label="Tùy chọn khác"
        actions={[
          { label: "Đổi mã", icon: <PencilLine />, onSelect: () => setRenaming(code) },
          { label: "Nhân bản", icon: <Copy />, onSelect: onDuplicate },
          {
            label: "Xóa",
            icon: <Trash2 />,
            destructive: true,
            apart: true,
            onSelect: async () => {
              if (
                await confirmAction({
                  title: deleteLabel,
                  description: "Mục này sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                  confirmLabel: "Xóa",
                })
              )
                onDelete()
            },
          },
        ]}
      />
    </header>
  )
}
