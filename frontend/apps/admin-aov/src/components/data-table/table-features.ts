import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  constructFilterFn,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  type Column,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  columnMeta: metaHelper<{ label?: string; className?: string }>(),
})

export type DataColumnDef<TData extends RowData, TValue = any> = ColumnDef<typeof dataTableFeatures, TData, TValue>
export type DataColumn<TData extends RowData, TValue = any> = Column<typeof dataTableFeatures, TData, TValue>
export const EMPTY_TABLE_DATA: never[] = []

export const facetFilterFn = constructFilterFn({
  filter: (value: unknown, selected: string[]) => !selected?.length || selected.includes(String(value)),
})
