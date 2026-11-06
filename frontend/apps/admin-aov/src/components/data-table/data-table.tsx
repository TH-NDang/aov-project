import { useState, type ReactNode } from "react"
import { useHotkeys } from "@/app/hotkeys"
import {
  flexRender,
  functionalUpdate,
  useTable,
  type RowData,
  type ColumnFiltersState,
  type SortingState,
  type ColumnVisibilityState,
} from "@tanstack/react-table"
import { Search, Settings2, X } from "lucide-react"
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
import { Skeleton } from "@aov/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { cn } from "@aov/ui/lib/utils"
import { formatNumber } from "@/lib/text"
import { FacetedFilter, type FacetOption } from "./faceted-filter"
import { dataTableFeatures, EMPTY_TABLE_DATA, type DataColumnDef } from "./table-features"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useRevealedCount } from "@aov/ui/hooks/use-revealed-rows"

const ROW_BATCH = 25

export interface DataTableFacet {
  columnId: string
  title: string
  options: FacetOption[]
}

interface DataTableProps<TData extends RowData> {
  // TanStack column value types differ per column, so the array is typed loosely.
  columns: DataColumnDef<TData>[]
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
  initialVisibility?: ColumnVisibilityState
  toolbar?: ReactNode
  onRowClick?: (row: TData) => void
  selectedRowId?: string | null
  emptyMessage?: string
  filters?: ColumnFiltersState
  onFiltersChange?: (filters: ColumnFiltersState) => void
}

export function DataTable<TData extends RowData>({
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
  filters,
  onFiltersChange,
}: DataTableProps<TData>) {
  const { enabled } = useHotkeys()
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [localFilters, setLocalFilters] = useState<ColumnFiltersState>(initialFilters)
  const columnFilters = filters ?? localFilters
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(initialVisibility)
  const [localSearch, setLocalSearch] = useState("")
  const globalFilter = search ?? localSearch
  const setGlobalFilter = onSearchChange ?? setLocalSearch
  const reveal = useRevealedCount(JSON.stringify([sorting, columnFilters, globalFilter]), ROW_BATCH)

  const table = useTable({
    features: dataTableFeatures,
    data: data ?? EMPTY_TABLE_DATA,
    columns,
    getRowId: (row) => getRowId(row),
    // The page is the rows revealed so far; there is only ever this one.
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination: { pageIndex: 0, pageSize: reveal.count },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const next = functionalUpdate(updater, columnFilters)
      if (onFiltersChange) onFiltersChange(next)
      else setLocalFilters(next)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setGlobalFilter(value ?? ""),
    globalFilterFn: (row, _columnId, value: string) => matchesSearch(row.original, value),
    autoResetPageIndex: false,
  })

  const filtered = table.getFilteredRowModel().rows.length
  const isFiltered = columnFilters.length > 0 || globalFilter.length > 0
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
          <DropdownMenu modal={false}>
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
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.className}
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
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
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
                    onRowClick?.(row.original)
                  }}
                  onKeyDown={(event) => {
                    if (
                      enabled &&
                      event.target === event.currentTarget &&
                      onRowClick &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault()
                      onRowClick(row.original)
                    }
                  }}
                  tabIndex={onRowClick && enabled ? 0 : undefined}
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

      <InfiniteScroll query={reveal.loader(filtered)} label="Đang tải thêm dòng" />
      <p className="text-sm text-muted-foreground tabular-nums">
        {filtered > reveal.count
          ? `${formatNumber(reveal.count)} trên ${formatNumber(filtered)} kết quả`
          : `${formatNumber(filtered)} kết quả`}
        {data && filtered !== data.length && ` (lọc từ ${formatNumber(data.length)})`}
      </p>
    </div>
  )
}
