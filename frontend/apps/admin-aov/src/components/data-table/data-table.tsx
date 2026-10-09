import { useState, type ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Settings2, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@aov/ui/components/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { cn } from "@aov/ui/lib/utils"
import { formatNumber } from "@/lib/text"
import { FacetedFilter, type FacetOption } from "./faceted-filter"

export interface DataTableFacet {
  columnId: string
  title: string
  options: FacetOption[]
}

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    /** Label used by the column visibility menu. */
    label?: string
    className?: string
  }
}

interface DataTableProps<TData> {
  // TanStack column value types differ per column, so the array is typed loosely.
  columns: ColumnDef<TData, any>[]
  data: TData[] | undefined
  isLoading?: boolean
  getRowId: (row: TData) => string
  matchesSearch: (row: TData, query: string) => boolean
  searchPlaceholder: string
  search?: string
  onSearchChange?: (value: string) => void
  facets?: DataTableFacet[]
  initialFilters?: ColumnFiltersState
  initialSorting?: SortingState
  initialVisibility?: VisibilityState
  toolbar?: ReactNode
  onRowClick?: (row: TData) => void
  selectedRowId?: string | null
  emptyMessage?: string
  pageSizes?: number[]
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  getRowId,
  matchesSearch,
  searchPlaceholder,
  search,
  onSearchChange,
  facets = [],
  initialFilters = [],
  initialSorting = [],
  initialVisibility = {},
  toolbar,
  onRowClick,
  selectedRowId,
  emptyMessage = "Không có dữ liệu phù hợp.",
  pageSizes = [10, 20, 50, 100],
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialVisibility)
  const [localSearch, setLocalSearch] = useState("")
  const globalFilter = search ?? localSearch
  const setGlobalFilter = onSearchChange ?? setLocalSearch

  const table = useReactTable({
    data: data ?? [],
    columns,
    getRowId: (row) => getRowId(row),
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setGlobalFilter(value ?? ""),
    globalFilterFn: (row, _columnId, value: string) => matchesSearch(row.original, value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    autoResetPageIndex: true,
    initialState: { pagination: { pageSize: pageSizes[1] ?? pageSizes[0] } },
  })

  const filtered = table.getFilteredRowModel().rows.length
  const isFiltered = columnFilters.length > 0 || globalFilter.length > 0
  const { pageIndex, pageSize } = table.getState().pagination
  const visibleColumns = table.getVisibleLeafColumns().length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-full sm:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={globalFilter}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          {globalFilter && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={() => table.setGlobalFilter("")} aria-label="Xoá tìm kiếm">
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        {facets.map((facet) => (
          <FacetedFilter
            key={facet.columnId}
            column={table.getColumn(facet.columnId)}
            title={facet.title}
            options={facet.options}
          />
        ))}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter("")
            }}
          >
            Xoá lọc <X />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Settings2 /> Cột
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Hiện cột</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && !data ? (
              Array.from({ length: 8 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: visibleColumns }, (_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.id === selectedRowId ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault()
                      onRowClick(row.original)
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumns} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {filtered === 0
            ? "0 kết quả"
            : `${formatNumber(pageIndex * pageSize + 1)}–${formatNumber(Math.min((pageIndex + 1) * pageSize, filtered))} trên ${formatNumber(filtered)}`}
          {data && filtered !== data.length && ` (lọc từ ${formatNumber(data.length)})`}
        </span>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground">Mỗi trang</span>
            <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
              <SelectTrigger size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular-nums">
            Trang {pageIndex + 1}/{Math.max(table.getPageCount(), 1)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Trang đầu"
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Trang trước"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Trang sau"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Trang cuối"
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
