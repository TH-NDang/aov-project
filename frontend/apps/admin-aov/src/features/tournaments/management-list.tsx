import { useRef, useState, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, SearchX, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { cn } from "@aov/ui/lib/utils"
import { SearchField } from "@/components/search-field"

export const managementSelectClassName =
  "type-body h-9 min-w-0 max-w-full rounded-md border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

export function ManagementPanel({ children }: { children: ReactNode }) {
  return <section className="@container min-w-0 overflow-hidden rounded-xl border bg-card">{children}</section>
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

export function useManagementPagination<T extends { id: string }>(
  entries: T[],
  filterKey: string,
  selectedId?: string,
) {
  const key = `${filterKey}:${selectedId ?? ""}`
  const initialPage = Math.floor(
    Math.max(
      0,
      entries.findIndex((entry) => entry.id === selectedId),
    ) / PAGE_SIZE,
  )
  const [selection, setSelection] = useState({ key, page: initialPage })
  // Remember each filter change so clearing filters cannot restore an outdated page.
  if (selection.key !== key) setSelection({ key, page: initialPage })
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const page = Math.min(selection.key === key ? selection.page : initialPage, pageCount - 1)
  return {
    page,
    pageCount,
    rows: entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    onPageChange: (next: number) => setSelection({ key, page: Math.max(0, Math.min(next, pageCount - 1)) }),
  }
}

export function ManagementFooter({
  count,
  total,
  noun,
  page,
  pageCount,
  onPageChange,
}: {
  count: number
  total: number
  noun: string
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  const footer = useRef<HTMLDivElement>(null)
  const changePage = (next: number) => {
    onPageChange(next)
    footer.current?.parentElement?.scrollIntoView?.({ block: "start" })
  }
  return (
    <div ref={footer} className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-3 @3xl:px-4">
      <p className="type-meta tabular-nums" role="status">
        {count
          ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, count)} trong ${count} ${noun}`
          : `0 ${noun}`}
        {count !== total && <span> · Tổng {total}</span>}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang trước"
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="type-meta tabular-nums">
            Trang {page + 1}/{pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang sau"
            disabled={page === pageCount - 1}
            onClick={() => changePage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
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
