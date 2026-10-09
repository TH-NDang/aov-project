import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@aov/ui/components/badge"
import { ColumnHeader } from "@/components/data-table/column-header"
import { DataTable } from "@/components/data-table/data-table"
import { facetFilterFn } from "@/components/data-table/faceted-filter"
import { badgeLabel } from "@/components/badge-picker"
import { MasterDetail } from "@/components/master-detail"
import { MediaImage } from "@/components/media-image"
import { PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import type { Hero, Skin } from "@/lib/api/types"
import { isPortraitOnly } from "@/lib/domain/portraits"
import { useBadges } from "@/lib/queries"
import { matchesQuery } from "@/lib/text"
import { useHeroIndex } from "@/lib/use-wiki-index"
import { SkinEditor } from "./skin-editor"

interface SkinRow {
  hero: Hero
  skin: Skin
  kind: "default" | "skin"
  portrait: "ok" | "missing"
  art: "full" | "partial" | "none"
  badge: string
}

const ART_LABEL = { full: "Đủ head & cover", partial: "Thiếu một ảnh", none: "Chỉ portrait" } as const

export function SkinsPage() {
  const { index, isLoading } = useHeroIndex()
  const badges = useBadges()
  const [search, setSearch] = useSearchParam("q")
  const [portraitFilter] = useSearchParam("portrait")
  const [selectedId, setSelectedId] = useSearchParam("skin")
  const badgeIcons = useMemo(() => new Map((badges.data ?? []).map((badge) => [badge.id, badge.icon])), [badges.data])

  const rows = useMemo<SkinRow[] | undefined>(
    () =>
      index?.heroes.flatMap((hero) =>
        hero.skins.map((skin) => ({
          hero,
          skin,
          kind: skin.isDefault ? "default" : "skin",
          portrait: skin.portrait ? "ok" : "missing",
          art: skin.head && skin.cover ? "full" : skin.head || skin.cover ? "partial" : "none",
          badge: skin.badgeId ?? "none",
        })),
      ),
    [index],
  )

  const columns = useMemo<ColumnDef<SkinRow, any>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.skin.name,
        enableHiding: false,
        header: ({ column }) => <ColumnHeader column={column} title="Trang phục" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <MediaImage path={row.original.skin.portrait} className="h-11 w-7 shrink-0 rounded-sm object-cover" />
            <div className="min-w-0">
              <div className="truncate font-medium">{row.original.skin.name || "Chưa có tên"}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">{row.original.skin.sourceSkinId}</div>
            </div>
          </div>
        ),
      },
      {
        id: "hero",
        accessorFn: (row) => row.hero.id,
        filterFn: facetFilterFn as never,
        sortingFn: (a, b) => a.original.hero.name.localeCompare(b.original.hero.name, "vi"),
        meta: { label: "Tướng" },
        header: ({ column }) => <ColumnHeader column={column} title="Tướng" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <MediaImage path={row.original.hero.head} className="size-6 rounded-sm object-cover" />
            <span className="truncate">{row.original.hero.name}</span>
          </div>
        ),
      },
      {
        id: "badge",
        accessorFn: (row) => row.badge,
        filterFn: facetFilterFn as never,
        meta: { label: "Bậc" },
        header: ({ column }) => <ColumnHeader column={column} title="Bậc" />,
        cell: ({ row }) =>
          row.original.skin.badgeId ? (
            <div className="flex items-center gap-2">
              <MediaImage path={badgeIcons.get(row.original.skin.badgeId)} className="h-5 w-9 object-contain" />
              <span className="truncate text-xs capitalize">{badgeLabel(row.original.skin.badgeId)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "portrait",
        accessorFn: (row) => row.portrait,
        filterFn: facetFilterFn as never,
        meta: { label: "Portrait" },
        header: ({ column }) => <ColumnHeader column={column} title="Portrait" />,
        cell: ({ row }) =>
          row.original.skin.portrait ? (
            <span className="text-sm">
              Có
              {row.original.skin.portraitAlternates.length > 0 && (
                <span className="text-muted-foreground"> · +{row.original.skin.portraitAlternates.length} bản</span>
              )}
            </span>
          ) : (
            <Badge variant="destructive">Thiếu</Badge>
          ),
      },
      {
        id: "art",
        accessorFn: (row) => row.art,
        filterFn: facetFilterFn as never,
        meta: { label: "Head & cover" },
        header: ({ column }) => <ColumnHeader column={column} title="Head & cover" />,
        cell: ({ row }) =>
          row.original.art === "full" ? (
            <span className="text-sm text-muted-foreground">Đủ</span>
          ) : (
            <Badge variant="outline">{ART_LABEL[row.original.art]}</Badge>
          ),
      },
      {
        id: "kind",
        accessorFn: (row) => row.kind,
        filterFn: facetFilterFn as never,
        meta: { label: "Loại" },
        header: ({ column }) => <ColumnHeader column={column} title="Loại" />,
        cell: ({ row }) =>
          row.original.skin.isDefault ? (
            <Badge variant="secondary">Mặc định</Badge>
          ) : isPortraitOnly(row.original.skin) ? (
            <Badge variant="outline">Mới</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Trang phục</span>
          ),
      },
    ],
    [badgeIcons],
  )

  const badgeOptions = useMemo(() => {
    const usage = index?.badgeUsage ?? new Map<string, number>()
    return [
      { value: "none", label: "Chưa gắn bậc" },
      ...[...usage.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => ({ value: id, label: badgeLabel(id) })),
    ]
  }, [index])

  const selected = selectedId ? index?.skinById.get(selectedId) : undefined

  return (
    <MasterDetail
      detail={
        selected ? (
          <SkinEditor
            hero={selected.hero}
            skin={selected.skin}
            badges={badges.data ?? []}
            badgeUsage={index?.badgeUsage}
            showHeroLink
          />
        ) : null
      }
      detailTitle="Chỉnh sửa trang phục"
      onCloseDetail={() => setSelectedId(null)}
    >
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <PageHeader
          title="Trang phục"
          description="Toàn bộ trang phục theo tướng: bậc, portrait, head & cover. Bấm một dòng để sửa."
        />
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          getRowId={(row) => row.skin.id}
          matchesSearch={(row, query) =>
            matchesQuery(
              query,
              row.skin.name,
              row.skin.fullName,
              row.hero.name,
              row.skin.sourceSkinId,
              row.skin.badgeId,
            )
          }
          searchPlaceholder="Tìm trang phục, tướng, bậc…"
          search={search}
          onSearchChange={setSearch}
          initialFilters={[
            { id: "kind", value: ["skin"] },
            ...(portraitFilter === "missing" ? [{ id: "portrait", value: ["missing"] }] : []),
          ]}
          initialSorting={[{ id: "hero", desc: false }]}
          facets={[
            {
              columnId: "kind",
              title: "Loại",
              options: [
                { value: "skin", label: "Trang phục" },
                { value: "default", label: "Mặc định" },
              ],
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
              columnId: "art",
              title: "Head & cover",
              options: (Object.keys(ART_LABEL) as SkinRow["art"][]).map((value) => ({
                value,
                label: ART_LABEL[value],
              })),
            },
            { columnId: "badge", title: "Bậc", options: badgeOptions },
            {
              columnId: "hero",
              title: "Tướng",
              options: (index?.heroes ?? []).map((hero) => ({ value: hero.id, label: hero.name })),
            },
          ]}
          onRowClick={(row) => setSelectedId(row.skin.id)}
          selectedRowId={selectedId || null}
        />
      </div>
    </MasterDetail>
  )
}
