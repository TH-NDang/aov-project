import { useMemo } from "react"
import { useNavigate } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { ExternalLink } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { ColumnHeader } from "@/components/data-table/column-header"
import { DataTable } from "@/components/data-table/data-table"
import { facetFilterFn } from "@/components/data-table/faceted-filter"
import { MediaImage } from "@/components/media-image"
import { Page, PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import type { Hero } from "@/lib/api/types"
import { matchesQuery } from "@/lib/text"
import { useHeroes } from "@/lib/queries"

type Mechanic = "hero-form" | "skill-variant" | "none"

interface HeroRow {
  hero: Hero
  skins: number
  missingPortraits: number
  skills: number
  icons: number
  mechanic: Mechanic
  portrait: "ok" | "missing"
}

const MECHANIC_LABEL: Record<Mechanic, string> = {
  "hero-form": "Đổi dạng tướng",
  "skill-variant": "Biến thể chiêu",
  none: "Thường",
}

function toRow(hero: Hero): HeroRow {
  const skins = hero.skins.filter((skin) => !skin.isDefault)
  return {
    hero,
    skins: skins.length,
    missingPortraits: skins.filter((skin) => !skin.portrait).length,
    skills: hero.skills.length,
    icons: hero.skills.reduce((sum, skill) => sum + skill.variants.length, 0),
    mechanic: hero.forms.length
      ? "hero-form"
      : hero.skills.some((skill) => skill.switchMode === "skill-variant")
        ? "skill-variant"
        : "none",
    portrait: hero.portrait ? "ok" : "missing",
  }
}

const columns: ColumnDef<HeroRow, any>[] = [
  {
    id: "name",
    accessorFn: (row) => row.hero.name,
    header: ({ column }) => <ColumnHeader column={column} title="Tướng" />,
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <MediaImage path={row.original.hero.head} alt="" className="size-9 shrink-0 rounded-md object-cover" />
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original.hero.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{row.original.hero.id}</div>
        </div>
      </div>
    ),
  },
  {
    id: "skins",
    accessorFn: (row) => row.skins,
    meta: { label: "Trang phục", className: "text-right" },
    header: ({ column }) => <ColumnHeader column={column} title="Trang phục" className="justify-end" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.skins}
        {row.original.missingPortraits > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="ml-2">
                −{row.original.missingPortraits}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{row.original.missingPortraits} trang phục thiếu portrait</TooltipContent>
          </Tooltip>
        )}
      </div>
    ),
  },
  {
    id: "skills",
    accessorFn: (row) => row.icons,
    meta: { label: "Icon kỹ năng", className: "text-right" },
    header: ({ column }) => <ColumnHeader column={column} title="Icon kỹ năng" className="justify-end" />,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.icons}
        <span className="text-muted-foreground"> · {row.original.skills} ô</span>
      </div>
    ),
  },
  {
    id: "mechanic",
    accessorFn: (row) => row.mechanic,
    filterFn: facetFilterFn as never,
    meta: { label: "Cơ chế" },
    header: ({ column }) => <ColumnHeader column={column} title="Cơ chế" />,
    cell: ({ row }) =>
      row.original.mechanic === "none" ? (
        <span className="text-muted-foreground">Thường</span>
      ) : (
        <Badge variant="outline">
          {MECHANIC_LABEL[row.original.mechanic]}
          {row.original.hero.forms.length > 0 && ` · ${row.original.hero.forms.length}`}
        </Badge>
      ),
  },
  {
    id: "portrait",
    accessorFn: (row) => row.portrait,
    filterFn: facetFilterFn as never,
    meta: { label: "Portrait" },
    header: ({ column }) => <ColumnHeader column={column} title="Portrait" />,
    cell: ({ row }) =>
      row.original.hero.portrait ? (
        <div className="flex items-center gap-2">
          <MediaImage path={row.original.hero.portrait} className="h-9 w-6 rounded-sm object-cover" />
          {row.original.hero.portraitAlternates.length > 0 && (
            <span className="text-xs text-muted-foreground">+{row.original.hero.portraitAlternates.length} bản</span>
          )}
        </div>
      ) : (
        <Badge variant="destructive">Thiếu</Badge>
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
      <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
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
]

export function HeroesPage() {
  const navigate = useNavigate()
  const heroes = useHeroes()
  const [search, setSearch] = useSearchParam("q")
  const rows = useMemo(() => heroes.data?.map(toRow), [heroes.data])

  return (
    <Page>
      <PageHeader
        title="Tướng"
        description="Thông tin, kỹ năng, trang phục và ảnh của từng tướng. Bấm một dòng để chỉnh sửa."
      />
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
        initialVisibility={{ version: false }}
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
        ]}
        onRowClick={(row) => navigate(`/heroes/${row.hero.id}`)}
      />
    </Page>
  )
}
