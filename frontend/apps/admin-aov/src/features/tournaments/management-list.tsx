import { type ComponentProps, type ReactNode } from "react"
import { SearchX, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { cn } from "@aov/ui/lib/utils"
import { SearchField } from "@/components/search-field"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"

export const managementSelectClassName =
  "type-body h-9 min-w-0 max-w-full rounded-md border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

export function ManagementPanel({ children }: { children: ReactNode }) {
  return <section className="@container min-w-0 overflow-hidden admin-panel">{children}</section>
}

export function ManagementToolbar({
  search,
  onSearchChange,
  searchLabel,
  placeholder,
  onReset,
  children,
}: {
  search: string
  onSearchChange?: (value: string) => void
  searchLabel: string
  placeholder: string
  onReset?: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-3 @3xl:p-4">
      {onSearchChange && (
        <SearchField
          className="w-full @xl:w-64 @xl:flex-1 @3xl:max-w-sm [&_input]:rounded-md"
          label={searchLabel}
          placeholder={placeholder}
          value={search}
          onChange={onSearchChange}
          shortcut
        />
      )}
      {children}
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X aria-hidden="true" /> Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}

export function ManagementTable({
  label,
  columns,
  children,
}: {
  label: string
  columns: { label: string; className?: string }[]
  children: ReactNode
}) {
  return (
    <Table className="type-body table-fixed [&_td]:px-3 [&_td]:py-3 [&_td]:whitespace-normal @3xl:[&_td]:px-4">
      <TableCaption className="sr-only">{label}</TableCaption>
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.label}
              className={cn("type-label px-3 text-muted-foreground @3xl:px-4", column.className)}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

const PAGE_SIZE = 25

/** Rows on screen; a selected record stays among them, however far down the list it sits. */
export function useManagementRows<T extends { id: string }>(entries: T[], filterKey: string, selectedId?: string) {
  const selected = entries.findIndex((entry) => entry.id === selectedId)
  return useRevealedRows(entries, filterKey, PAGE_SIZE, selected + 1)
}

export function ManagementFooter({
  count,
  total,
  noun,
  rows,
  loader,
}: {
  count: number
  total: number
  noun: string
  rows: readonly unknown[]
  loader: ComponentProps<typeof InfiniteScroll>["query"]
}) {
  return (
    <>
      <InfiniteScroll query={loader} label={`Đang tải thêm ${noun}`} />
      <div className="border-t px-3 py-3 @3xl:px-4">
        <p className="type-meta tabular-nums" role="status">
          {rows.length < count ? `${rows.length} trong ${count} ${noun}` : `${count} ${noun}`}
          {count !== total && <span> · Tổng {total}</span>}
        </p>
      </div>
    </>
  )
}

export function ManagementEmpty({
  title,
  description,
  onReset,
}: {
  title: string
  description: string
  onReset?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
      <div className="mb-2 rounded-full bg-muted p-3 text-muted-foreground">
        <SearchX className="size-5" />
      </div>
      <h2 className="type-section-title">{title}</h2>
      <p className="type-body max-w-sm text-muted-foreground">{description}</p>
      {onReset && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onReset}>
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}

export function ManagementLoading() {
  return (
    <div className="space-y-4 rounded-xl border p-4" role="status" aria-label="Đang tải danh sách">
      <Skeleton className="h-9 w-64 max-w-full" />
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-14 w-full" />
      ))}
    </div>
  )
}
