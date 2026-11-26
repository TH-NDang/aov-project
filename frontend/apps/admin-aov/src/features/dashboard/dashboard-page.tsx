import { useMemo, type ComponentType } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, CalendarClock, ChevronRight, CircleCheck, Plus, Trophy, Upload } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@aov/ui/components/item"
import { Progress } from "@aov/ui/components/progress"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Page, PageHeader } from "@/components/page-header"
import { NAV_ICONS } from "@/app/aov-nav-icon"
import { formatNumber } from "@/lib/text"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import type { PageSlice } from "@/lib/hero-types"
import { useContentLocale, usePublicationOverview } from "../publishing/api/publication-overview"
import { dateLabel } from "@/lib/schedule-date"
import { defaultRulesetId } from "@/lib/default-ruleset"
import { Button } from "@aov/ui/components/button"
import { useWarehouseCatalog, warehouseApi, warehouseKeys } from "../warehouse/api/warehouse-api"
import { cn } from "@aov/ui/lib/utils"
import { itemWork, useEsportsWork, useHeroWork, type WorkArea, type WorkRow } from "./use-dashboard-work"
import { mediaKeys } from "@/features/media/api/media-cache"
import { characterImageKeys } from "../media/api/character-image-api"

const publishing = createPublishingApi(backendRequest)

interface StatTile {
  label: string
  value: number | undefined
  hint: string
  icon: ComponentType<{ className?: string }>
  to: string
}

interface CoverageRow {
  label: string
  done: number
  total: number
}

export function DashboardPage() {
  const { actor } = useSession()
  const canReadHeroes = actor?.capabilities.includes("catalog:read") ?? false
  const heroes = useQuery({
    queryKey: publishingKeys.dashboardHeroes,
    queryFn: () => publishing.heroes(),
    enabled: canReadHeroes,
    staleTime: 30000,
  })
  const images = useQuery({
    queryKey: mediaKeys.list("dashboard"),
    queryFn: () => backendRequest<PageSlice<unknown>>("/admin/media/assets?page=0&size=1"),
    enabled: canReadHeroes,
    staleTime: 30000,
  })
  const badges = useQuery({
    queryKey: characterImageKeys.dashboardBadges,
    queryFn: () => backendRequest<PageSlice<unknown>>("/admin/skin-badges?page=0&size=1"),
    enabled: canReadHeroes,
    staleTime: 30000,
  })
  const locale = useContentLocale()
  const rulesets = useQuery({
    queryKey: publishingKeys.rulesets,
    queryFn: publishing.rulesets,
    enabled: canReadHeroes,
    staleTime: 60000,
  })
  const rulesetId = canReadHeroes ? defaultRulesetId(rulesets.data) : ""
  const catalog = useWarehouseCatalog("items", rulesetId, locale)
  const enchantments = useWarehouseCatalog("enchantments", rulesetId, locale)
  const arcana = useWarehouseCatalog("arcana", rulesetId, locale)
  const spells = useWarehouseCatalog("spells", rulesetId, locale)
  const branches = useQuery({
    queryKey: warehouseKeys.metadata("enchantments"),
    queryFn: () => warehouseApi.metadata("enchantments"),
    enabled: canReadHeroes,
    staleTime: 60000,
  })

  const itemStats = useMemo(() => {
    const items = catalog.data
    if (!items) return undefined
    return {
      total: items.length,
      settled: items.filter((item) => item.content.recipeStatus !== "UNKNOWN").length,
      unverified: items.filter((item) => item.content.recipeStatus === "UNKNOWN").length,
      firstUnverified: items.find((item) => item.content.recipeStatus === "UNKNOWN"),
      incomplete: items.filter((item) => item.missingFields?.length),
      placed: items.filter(
        (item) =>
          item.content.shopPositions.length > 0 &&
          item.content.shopPositions.every((position) => position.row !== null && position.column !== null),
      ).length,
    }
  }, [catalog.data])

  const stats: StatTile[] = [
    ...(canReadHeroes
      ? [
          {
            label: "Tướng",
            value: heroes.data?.totalElements,
            hint: "Trong danh mục wiki",
            icon: NAV_ICONS.heroes,
            to: "/hero",
          },
          {
            label: "Ảnh đã lưu",
            value: images.data?.totalElements,
            hint: "Trong thư viện ảnh",
            icon: NAV_ICONS.imageLibrary,
            to: "/files",
          },
          {
            label: "Bậc trang phục",
            value: badges.data?.totalElements,
            hint: "Tên và biểu tượng",
            icon: NAV_ICONS.badges,
            to: "/hero/media?tab=badges",
          },
        ]
      : []),
    {
      label: "Trang bị",
      value: itemStats?.total,
      hint: "Trong kho trang bị",
      icon: NAV_ICONS.items,
      to: "/items",
    },
    {
      label: "Phù hiệu",
      value: enchantments.data?.length,
      hint: `${branches.data?.length ?? "…"} hệ`,
      icon: NAV_ICONS.enchantments,
      to: "/enchantments",
    },
    { label: "Bảng ngọc", value: arcana.data?.length, hint: "Theo màu và cấp", icon: NAV_ICONS.arcana, to: "/arcana" },
    { label: "Phụ trợ", value: spells.data?.length, hint: "Kỹ năng phụ trợ", icon: NAV_ICONS.spells, to: "/spells" },
  ]

  const coverage: CoverageRow[] = [
    ...(itemStats
      ? [
          { label: "Công thức trang bị đã chốt", done: itemStats.settled, total: itemStats.total },
          { label: "Vị trí cửa hàng đầy đủ", done: itemStats.placed, total: itemStats.total },
        ]
      : []),
  ]

  const heroWork = useHeroWork(canReadHeroes, locale)
  const esportsWork = useEsportsWork()
  const wikiRows = [...heroWork.rows, ...(itemStats ? itemWork(itemStats) : [])]
  const waiting = heroWork.pending || esportsWork.pending || catalog.isPending
  const canWriteHeroes = actor?.capabilities.includes("hero:write") ?? false
  if (canReadHeroes && heroWork.total)
    coverage.unshift({ label: "Tướng có bản công khai", done: heroWork.published, total: heroWork.total })

  return (
    <Page>
      <PageHeader
        title="Bảng điều khiển"
        description="Việc đang chờ và lối tắt để nhập dữ liệu."
        actions={
          canWriteHeroes && (
            <>
              <Button asChild size="sm">
                <Link to="/hero/new">
                  <Plus />
                  Tạo tướng
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/hero/import">
                  <Upload />
                  Nhập tướng
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/tournaments">
                  <Trophy />
                  Giải đấu
                </Link>
              </Button>
            </>
          )
        }
      />
      {(rulesets.isError ||
        catalog.isError ||
        enchantments.isError ||
        arcana.isError ||
        spells.isError ||
        branches.isError) && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          Chưa tải đầy đủ số liệu kho trang bị từ máy chủ.
        </p>
      )}

      <nav
        aria-label="Danh mục và số lượng"
        className="admin-panel grid grid-cols-3 overflow-hidden sm:grid-cols-4 xl:grid-cols-7"
      >
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            title={stat.hint}
            className="min-w-0 space-y-1 px-2 py-2.5 shadow-[1px_1px_0_var(--border)] sm:px-3 transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <span className="type-meta flex items-center gap-1.5">
              <stat.icon aria-hidden className="size-5 shrink-0 max-lg:hidden" />
              {stat.label}
            </span>
            <div className="type-section-title tabular-nums">
              {stat.value === undefined ? <Skeleton className="h-5 w-10" /> : formatNumber(stat.value)}
            </div>
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <Card className="admin-section xl:col-span-3">
          <CardHeader>
            <CardTitle>Việc cần làm</CardTitle>
            <CardDescription>Những gì đang chờ; việc làm xong được ngay đứng trước.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <WorkList title="Wiki" area={{ ...heroWork, rows: wikiRows }} />
            <WorkList title="Giải đấu" area={esportsWork} />
            {!waiting && !wikiRows.length && !esportsWork.rows.length && (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleCheck />
                  </EmptyMedia>
                  <EmptyTitle>Không còn việc nào đang chờ</EmptyTitle>
                  <EmptyDescription>Bản nháp, lịch phát hành, kho trang bị và giải đấu đều đã gọn.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-4 xl:col-span-2">
          {canReadHeroes && <CurrentPatchCard locale={locale} />}
          <Card className="admin-section">
            <CardHeader>
              <CardTitle>Độ phủ dữ liệu</CardTitle>
              <CardDescription>Phần dữ liệu đã đủ để công khai.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {coverage.length === 0 && <Skeleton className="h-32 w-full" />}
              {coverage.map((row) => {
                // Floor so an incomplete set never reads as 100%.
                const percent = row.total
                  ? row.done === row.total
                    ? 100
                    : Math.floor((row.done / row.total) * 100)
                  : 0
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span>{row.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatNumber(row.done)}/{formatNumber(row.total)} ·{" "}
                        <span className="text-foreground">{percent}%</span>
                      </span>
                    </div>
                    <Progress value={percent} aria-label={`${row.label}: ${percent}%`} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  )
}

const TONE_BADGE: Record<WorkRow["tone"], string> = {
  ready: "bg-(--aov-success-soft) text-(--aov-success)",
  attention: "bg-(--aov-warning-soft) text-(--aov-warning)",
  neutral: "",
}

/** One area's waiting work as rows that open the list where it is done; nothing shows for an area with none. */
function WorkList({ title, area }: { title: string; area: WorkArea }) {
  if (area.pending && !area.rows.length)
    return (
      <section className="space-y-2">
        <h3 className="type-label text-muted-foreground">{title}</h3>
        <Skeleton className="h-24 w-full" />
      </section>
    )
  if (!area.rows.length && !area.failed) return null
  return (
    <section className="space-y-2">
      <h3 className="type-label text-muted-foreground">{title}</h3>
      {area.failed && <p className="type-meta">Chưa tải được một phần số liệu; danh sách có thể chưa đủ.</p>}
      {area.rows.length > 0 && (
        <ItemGroup className="rounded-md border">
          {area.rows.map((row, position) => (
            <div key={row.key}>
              {position > 0 && <ItemSeparator />}
              <Item asChild size="sm" className="rounded-none hover:bg-accent/50">
                <Link to={row.to}>
                  <ItemMedia variant="icon">
                    <row.icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{row.title}</ItemTitle>
                    <ItemDescription>{row.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="secondary" className={cn("tabular-nums", TONE_BADGE[row.tone])}>
                      {formatNumber(row.count)}
                    </Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            </div>
          ))}
        </ItemGroup>
      )}
    </section>
  )
}

/** The patch markets play now, with how many hero changes are recorded for it. */
function CurrentPatchCard({ locale }: { locale: string }) {
  const overview = usePublicationOverview()
  const data = overview.data
  const market = data?.markets.find((entry) => entry.available && entry.currentReleaseId)
  const release = data?.releases.find((entry) => entry.id === market?.currentReleaseId)
  const variant = data?.variants.find((entry) => entry.id === release?.variantId)
  const season = data?.seasons.find((entry) => entry.id === (variant?.seasonId ?? market?.currentSeasonId))
  const changes = useQuery({
    queryKey: publishingKeys.patchChanges(variant?.id, locale),
    queryFn: () =>
      backendRequest<{ heroId: string; sourceKind?: string }[]>(
        `/admin/patch-variants/${variant!.id}/hero-changes?locale=${encodeURIComponent(locale)}`,
      ),
    enabled: !!variant,
    staleTime: 60000,
  })
  const fromNotes = changes.data?.filter((change) => change.sourceKind === "PATCH_NOTES").length ?? 0
  return (
    <Card className="admin-section">
      <CardHeader>
        <CardTitle>Patch hiện tại</CardTitle>
        <CardDescription>
          {market ? `${market.displayName} · ${season?.displayName ?? "Chưa gắn mùa"}` : "—"}
        </CardDescription>
        <CardAction>
          <CalendarClock className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !variant ? (
          <p className="text-sm text-muted-foreground">Chưa có patch đang áp dụng ở thị trường nào.</p>
        ) : (
          <>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{variant.patchCode}</p>
              <p className="text-xs text-muted-foreground">
                Áp dụng từ {dateLabel(release?.effectiveOn ?? release?.effectiveAt ?? null, locale)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Tướng có thay đổi</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {changes.data ? formatNumber(changes.data.length) : "…"}
                </dd>
              </div>
              <div className="border-l pl-3">
                <dt className="text-xs text-muted-foreground">Ghi từ ghi chú cập nhật</dt>
                <dd className="text-base font-semibold tabular-nums">{changes.data ? formatNumber(fromNotes) : "…"}</dd>
              </div>
            </dl>
            <Button asChild variant="outline" size="sm">
              <Link to={`/game-configuration?season=${variant.seasonId ?? ""}&patch=${variant.id}`}>
                Xem và ghi thay đổi
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
