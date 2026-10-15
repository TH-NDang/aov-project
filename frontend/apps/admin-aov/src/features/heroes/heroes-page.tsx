import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { constructFilterFn, type ColumnFiltersState } from "@tanstack/react-table"
import { ArrowUpRight, CheckCircle2, ExternalLink, ImageOff, RefreshCw, Shirt, Sparkles, Swords } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { ColumnHeader } from "@/components/data-table/column-header"
import { DataTable } from "@/components/data-table/data-table"
import { facetFilterFn } from "@/components/data-table/faceted-filter"
import type { DataColumnDef } from "@/components/data-table/table-features"
import { MediaImage } from "@/components/media-image"
import { Page, PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { matchesQuery } from "@/lib/text"
import { useHeroes } from "@/lib/queries"
import { MECHANIC_LABEL, toHeroRow, type HeroReview, type HeroRow, type Mechanic } from "./hero-table-model"

const REVIEW_LABEL: Record<HeroReview, string> = {
  portrait: "Portrait tướng",
  skins: "Ảnh trang phục",
  skills: "Kỹ năng",
  ready: "Đủ ảnh và mô tả",
}
const detailUrl = (row: HeroRow, tab?: string) =>
  `/heroes/${encodeURIComponent(row.hero.id)}${tab ? `?tab=${tab}` : ""}`
const columns: DataColumnDef<HeroRow>[] = [
  {
    id: "name",
    accessorFn: (row) => row.hero.name,
    meta: { label: "Tướng", className: "min-w-52" },
    enableHiding: false,
    sortFn: (a, b) =>
      a.original.hero.name.localeCompare(b.original.hero.name, "vi", { numeric: true, sensitivity: "base" }),
    header: ({ column }) => <ColumnHeader column={column} title="Tài nguyên tướng" />,
    cell: ({ row: { original: row } }) => (
      <div className="flex items-center gap-3">
        <MediaImage path={row.hero.head} alt="" className="size-11 shrink-0 rounded-lg border object-cover" />
        <div className="min-w-0">
          <Link
            to={detailUrl(row)}
            className="truncate font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.hero.name}
          </Link>
          <div className="truncate font-mono text-xs text-muted-foreground">{row.hero.id}</div>
        </div>
      </div>
    ),
  },
  {
    id: "skins",
    accessorFn: (row) => row.skins,
    meta: { label: "Trang phục", className: "text-right min-w-40" },
    header: ({ column }) => <ColumnHeader column={column} title="Trang phục" className="justify-end" />,
    cell: ({ row: { original: row } }) => (
      <Link
        to={detailUrl(row, "skins")}
        aria-label={`Trang phục của ${row.hero.name}`}
        className="inline-flex flex-col items-end gap-1 rounded-md px-2 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-medium tabular-nums">{row.skins} trang phục</span>
        <span
          className={cn(
            "text-xs",
            row.missingPortraits ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {row.missingPortraits
            ? `${row.missingPortraits} thiếu portrait`
            : row.skins
              ? "Đủ portrait"
              : "Chưa có trang phục"}
        </span>
      </Link>
    ),
  },
  {
    id: "skills",
    accessorFn: (row) => row.icons,
    meta: { label: "Kỹ năng", className: "text-right min-w-44" },
    header: ({ column }) => <ColumnHeader column={column} title="Kỹ năng" className="justify-end" />,
    cell: ({ row: { original: row } }) => (
      <Link
        to={detailUrl(row, "skills")}
        aria-label={`Kỹ năng của ${row.hero.name}`}
        className="inline-flex flex-col items-end gap-1 rounded-md px-2 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-medium tabular-nums">
          {row.skills} kỹ năng · {row.icons}/{row.expectedIcons} icon
        </span>
        <span
          className={cn(
            "text-xs",
            row.missingDescriptions || !row.skills ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {!row.skills
            ? "Chưa có kỹ năng"
            : row.missingDescriptions
              ? `${row.missingDescriptions} thiếu mô tả`
              : "Đủ mô tả"}
        </span>
      </Link>
    ),
  },
  {
    id: "mechanic",
    accessorFn: (row) => row.mechanic,
    filterFn: facetFilterFn,
    meta: { label: "Cơ chế" },
    header: ({ column }) => <ColumnHeader column={column} title="Cơ chế" />,
    cell: ({ row: { original: row } }) =>
      row.mechanic === "none" ? (
        <span className="text-muted-foreground">Thường</span>
      ) : (
        <Badge variant="outline">
          {MECHANIC_LABEL[row.mechanic]}
          {row.hero.forms.length > 0 && ` · ${row.hero.forms.length}`}
        </Badge>
      ),
  },
  {
    id: "portrait",
    accessorFn: (row) => row.portrait,
    filterFn: facetFilterFn,
    meta: { label: "Portrait" },
    header: ({ column }) => <ColumnHeader column={column} title="Portrait" />,
    cell: ({ row: { original: row } }) =>
      row.hero.portrait ? (
        <Link
          to={detailUrl(row, "media")}
          aria-label={`Ảnh của ${row.hero.name}`}
          className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MediaImage path={row.hero.portrait} alt="" className="h-12 w-8 rounded-md border object-cover" />
          {row.hero.portraitAlternates.length > 0 && (
            <span className="text-xs text-muted-foreground">+{row.hero.portraitAlternates.length} bản</span>
          )}
        </Link>
      ) : (
        <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
          Thiếu ảnh
        </Badge>
      ),
  },
  {
    id: "review",
    accessorFn: (row) => row.review,
    getUniqueValues: (row) => row.review,
    enableSorting: false,
    meta: { label: "Hoàn thiện dữ liệu", className: "min-w-44" },
    header: "Hoàn thiện dữ liệu",
    filterFn: constructFilterFn({
      filter: (value: HeroReview[], selected: HeroReview[]) =>
        !selected.length || selected.some((item) => value.includes(item)),
    }),
    cell: ({ row: { original: row } }) => (
      <div className="flex max-w-60 flex-wrap gap-1">
        {row.review.includes("ready") ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Đủ ảnh và mô tả
          </span>
        ) : (
          row.review.map((issue) => (
            <Badge
              key={issue}
              variant="outline"
              className="border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
            >
              {REVIEW_LABEL[issue]}
            </Badge>
          ))
        )}
      </div>
    ),
  },
  {
    id: "version",
    accessorFn: (row) => row.hero.version,
    meta: { label: "Phiên bản" },
    header: ({ column }) => <ColumnHeader column={column} title="Phiên bản" />,
    cell: ({ row }) => <span className="font-mono text-xs">v{row.original.hero.version}</span>,
  },
  {
    id: "sources",
    meta: { label: "Nguồn" },
    enableSorting: false,
    header: "Nguồn",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {row.original.hero.sources.portraits && (
          <Button variant="ghost" size="xs" asChild>
            <a href={row.original.hero.sources.portraits} target="_blank" rel="noreferrer">
              Garena <ExternalLink />
            </a>
          </Button>
        )}
        {row.original.hero.sources.skills && (
          <Button variant="ghost" size="xs" asChild>
            <a href={row.original.hero.sources.skills} target="_blank" rel="noreferrer">
              Liquipedia <ExternalLink />
            </a>
          </Button>
        )}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Thao tác",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link to={detailUrl(row.original)} aria-label={`Mở chi tiết ${row.original.hero.name}`}>
          Chi tiết <ArrowUpRight className="size-4" />
        </Link>
      </Button>
    ),
  },
]

export function HeroesPage() {
  const navigate = useNavigate()
  const heroes = useHeroes()
  const [search, setSearch] = useSearchParam("q")
  const [filters, setFilters] = useState<ColumnFiltersState>([])
  const rows = useMemo(() => heroes.data?.map(toHeroRow), [heroes.data])
  const reviewFilter = filters.find((filter) => filter.id === "review")?.value as HeroReview[] | undefined
  const quickFilter = reviewFilter?.length === 1 ? reviewFilter[0] : reviewFilter?.length ? "mixed" : "all"
  const setQuickFilter = (value: HeroReview | "all") =>
    setFilters((current) => [
      ...current.filter((filter) => filter.id !== "review"),
      ...(value === "all" ? [] : [{ id: "review", value: [value] }]),
    ])
  const summaries = [
    { value: "all" as const, title: "Tổng số tướng", count: rows?.length, icon: Swords },
    {
      value: "portrait" as const,
      title: "Thiếu portrait tướng",
      count: rows?.filter((row) => row.review.includes("portrait")).length,
      icon: ImageOff,
    },
    {
      value: "skins" as const,
      title: "Trang phục thiếu portrait",
      count: rows?.filter((row) => row.review.includes("skins")).length,
      icon: Shirt,
    },
    {
      value: "skills" as const,
      title: "Kỹ năng cần bổ sung",
      count: rows?.filter((row) => row.review.includes("skills")).length,
      icon: Sparkles,
    },
  ]
  return (
    <Page>
      <PageHeader
        title="Tài nguyên tướng"
        description="Duyệt và chuẩn bị dữ liệu resources. Thay đổi tại đây được lưu cục bộ; mở Biên tập backend để tạo draft và publish."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/publishing">Biên tập backend</Link>
            </Button>
            <Button variant="outline" size="sm" disabled={heroes.isFetching} onClick={() => void heroes.refetch()}>
              <RefreshCw className={cn("size-4", heroes.isFetching && "animate-spin")} />
              Tải lại
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaries.map((summary) => (
          <button
            key={summary.value}
            type="button"
            aria-pressed={quickFilter === summary.value}
            onClick={() => setQuickFilter(summary.value)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              quickFilter === summary.value && "border-primary bg-primary/5",
            )}
          >
            <summary.icon className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">{summary.count ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{summary.title}</p>
            </div>
          </button>
        ))}
      </div>
      {heroes.isError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          Không tải được dữ liệu tướng. Bấm “Tải lại” để thử lại.
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={heroes.isLoading}
        getRowId={(row) => row.hero.id}
        matchesSearch={(row, query) => matchesQuery(query, row.hero.name, row.hero.id)}
        searchPlaceholder="Tìm tên hoặc mã tướng…"
        search={search}
        onSearchChange={setSearch}
        initialSorting={[{ id: "name", desc: false }]}
        initialVisibility={{ version: false, sources: false }}
        filters={filters}
        onFiltersChange={setFilters}
        facets={[
          {
            columnId: "mechanic",
            title: "Cơ chế",
            options: (Object.keys(MECHANIC_LABEL) as Mechanic[]).map((value) => ({
              value,
              label: MECHANIC_LABEL[value],
            })),
          },
          {
            columnId: "portrait",
            title: "Portrait",
            options: [
              { value: "ok", label: "Đã có" },
              { value: "missing", label: "Thiếu" },
            ],
          },
          {
            columnId: "review",
            title: "Cần bổ sung",
            options: (Object.keys(REVIEW_LABEL) as HeroReview[]).map((value) => ({
              value,
              label: REVIEW_LABEL[value],
            })),
          },
        ]}
        onRowClick={(row) => navigate(detailUrl(row))}
      />
    </Page>
  )
}
