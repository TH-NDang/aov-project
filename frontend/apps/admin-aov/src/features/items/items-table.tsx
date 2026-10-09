import { useMemo } from "react"
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table"
import { Badge } from "@aov/ui/components/badge"
import type { Item, ItemCategory, ItemIssue, RecipeStatus } from "@/lib/api/types"
import { ColumnHeader } from "@/components/data-table/column-header"
import { DataTable } from "@/components/data-table/data-table"
import { facetFilterFn } from "@/components/data-table/faceted-filter"
import { MediaImage } from "@/components/media-image"
import { useSearchParam } from "@/hooks/use-search-param"
import { buildsInto, RECIPE_STATUS_LABEL } from "@/lib/domain/items"
import { formatNumber, matchesQuery } from "@/lib/text"
import { RecipeStatusBadge } from "./item-detail-panel"

interface ItemRow {
  item: Item
  status: RecipeStatus
  tier: string
  upgrades: number
  issues: number
  changed: boolean
  placement: string
}

interface ItemsTableProps {
  items: Item[]
  categories: ItemCategory[]
  issues: ItemIssue[]
  changed: Set<string>
  selectedId: string | null
  onSelect: (itemId: string) => void
  initialFilters: ColumnFiltersState
}

export function ItemsTable({
  items,
  categories,
  issues,
  changed,
  selectedId,
  onSelect,
  initialFilters,
}: ItemsTableProps) {
  const [search, setSearch] = useSearchParam("q")
  const rows = useMemo<ItemRow[]>(
    () =>
      items.map((item) => ({
        item,
        status: item.recipe.status,
        tier: String(item.tier),
        upgrades: buildsInto(items, item.id).length,
        issues: issues.filter((issue) => issue.itemIds.includes(item.id)).length,
        changed: changed.has(item.id),
        placement: item.shopPositions
          .map(
            (position) =>
              `${position.group} · ${position.row ?? "?"},${position.column ?? "?"}${position.variant ? ` · ${position.variant}` : ""}`,
          )
          .join(" / "),
      })),
    [items, issues, changed],
  )

  const columns = useMemo<ColumnDef<ItemRow, any>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.item.name,
        enableHiding: false,
        header: ({ column }) => <ColumnHeader column={column} title="Trang bị" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <MediaImage
              path={row.original.item.image}
              className="size-9 shrink-0 rounded-md border bg-muted/40 object-contain p-0.5"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate font-medium">
                {row.original.item.name}
                {row.original.changed && (
                  <span className="size-1.5 rounded-full bg-primary" aria-label="Đã sửa, chưa lưu" />
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">{row.original.item.summary}</div>
            </div>
          </div>
        ),
      },
      {
        id: "category",
        accessorFn: (row) => row.item.category,
        filterFn: facetFilterFn as never,
        meta: { label: "Nhóm" },
        header: ({ column }) => <ColumnHeader column={column} title="Nhóm" />,
      },
      {
        id: "tier",
        accessorFn: (row) => row.tier,
        filterFn: facetFilterFn as never,
        meta: { label: "Cấp" },
        header: ({ column }) => <ColumnHeader column={column} title="Cấp" />,
        cell: ({ row }) => <Badge variant="outline">Cấp {row.original.tier}</Badge>,
      },
      {
        id: "price",
        accessorFn: (row) => row.item.price,
        meta: { label: "Giá", className: "text-right" },
        header: ({ column }) => <ColumnHeader column={column} title="Giá" className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatNumber(row.original.item.price)}</div>,
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        filterFn: facetFilterFn as never,
        meta: { label: "Công thức" },
        header: ({ column }) => <ColumnHeader column={column} title="Công thức" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <RecipeStatusBadge status={row.original.status} />
            {row.original.item.recipe.components.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {row.original.item.recipe.components.reduce((sum, c) => sum + c.quantity, 0)} món
              </span>
            )}
          </div>
        ),
      },
      {
        id: "upgrades",
        accessorFn: (row) => row.upgrades,
        meta: { label: "Nâng cấp thành", className: "text-right" },
        header: ({ column }) => <ColumnHeader column={column} title="Nâng cấp" className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.upgrades || "—"}</div>,
      },
      {
        id: "placement",
        accessorFn: (row) => row.placement,
        meta: { label: "Vị trí" },
        header: ({ column }) => <ColumnHeader column={column} title="Vị trí" />,
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.placement}</span>,
      },
      {
        id: "issues",
        accessorFn: (row) => (row.issues ? "yes" : "no"),
        filterFn: facetFilterFn as never,
        meta: { label: "Cần kiểm tra" },
        header: ({ column }) => <ColumnHeader column={column} title="Kiểm tra" />,
        cell: ({ row }) => (row.original.issues ? <Badge variant="destructive">{row.original.issues}</Badge> : null),
      },
    ],
    [],
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.item.id}
      matchesSearch={(row, query) => matchesQuery(query, row.item.name, row.item.id, row.item.summary)}
      searchPlaceholder="Tìm tên, mã, tóm tắt…"
      search={search}
      onSearchChange={setSearch}
      initialFilters={initialFilters}
      initialVisibility={{ placement: false }}
      facets={[
        {
          columnId: "category",
          title: "Nhóm",
          options: categories.map((category) => ({ value: category.name, label: category.name })),
        },
        {
          columnId: "tier",
          title: "Cấp",
          options: ["1", "2", "3"].map((tier) => ({ value: tier, label: `Cấp ${tier}` })),
        },
        {
          columnId: "status",
          title: "Công thức",
          options: (Object.keys(RECIPE_STATUS_LABEL) as RecipeStatus[]).map((value) => ({
            value,
            label: RECIPE_STATUS_LABEL[value],
          })),
        },
        {
          columnId: "issues",
          title: "Kiểm tra",
          options: [
            { value: "yes", label: "Cần kiểm tra" },
            { value: "no", label: "Ổn" },
          ],
        },
      ]}
      onRowClick={(row) => onSelect(row.item.id)}
      selectedRowId={selectedId}
      pageSizes={[20, 50, 120]}
    />
  )
}
