import { useMemo } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowUpRight, CalendarClock, ChevronRight, ScrollText, ShieldAlert, type LucideIcon } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@aov/ui/components/chart"
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
import { createPublishingApi } from "../publishing/publishing-api"
import type { PageSlice } from "../publishing/types"
import { dateLabel, useContentLocale, usePublicationOverview } from "../publishing/publication-overview"
import { defaultRulesetId } from "../publishing/default-ruleset"
import { Button } from "@aov/ui/components/button"
import { useWarehouseCatalog, warehouseApi, warehouseKeys } from "../warehouse/warehouse-api"
import { warehouseText } from "../warehouse/warehouse-types"

const publishing = createPublishingApi(backendRequest)

const chartConfig = {
  count: { label: "Trang bị", color: "var(--chart-1)" },
} satisfies ChartConfig

interface StatTile {
  label: string
  value: number | undefined
  hint: string
  icon: LucideIcon
  to: string
}

interface CoverageRow {
  label: string
  done: number
  total: number
}

interface TodoRow {
  title: string
  description: string
  count: number
  icon: LucideIcon
  to: string
}

export function DashboardPage() {
  const { actor } = useSession()
  const canReadHeroes = actor?.capabilities.includes("catalog:read") ?? false
  const heroes = useQuery({
    queryKey: ["publishing-heroes", "dashboard"],
    queryFn: () => publishing.heroes(),
    enabled: canReadHeroes,
    staleTime: 30000,
  })
  const images = useQuery({
    queryKey: ["managed-images", "dashboard"],
    queryFn: () => backendRequest<PageSlice<unknown>>("/admin/media/assets?page=0&size=1"),
    enabled: canReadHeroes,
    staleTime: 30000,
  })
  const badges = useQuery({
    queryKey: ["skin-badges", "dashboard"],
    queryFn: () => backendRequest<PageSlice<unknown>>("/admin/skin-badges?page=0&size=1"),
    enabled: canReadHeroes,
    staleTime: 30000,
  })
  const locale = useContentLocale()
  const rulesets = useQuery({
    queryKey: ["publishing-rulesets"],
    queryFn: publishing.rulesets,
    enabled: canReadHeroes,
    staleTime: 60000,
  })
  const rulesetId = canReadHeroes ? defaultRulesetId(rulesets.data) : ""
  const catalog = useWarehouseCatalog("items", rulesetId, locale)
  const enchantments = useWarehouseCatalog("enchantments", rulesetId, locale)
  const arcana = useWarehouseCatalog("arcana", rulesetId, locale)
  const spells = useWarehouseCatalog("spells", rulesetId, locale)
  const categories = useQuery({
    queryKey: warehouseKeys.metadata("items"),
    queryFn: () => warehouseApi.metadata("items"),
    enabled: canReadHeroes,
    staleTime: 60000,
  })
  const branches = useQuery({
    queryKey: warehouseKeys.metadata("enchantments"),
    queryFn: () => warehouseApi.metadata("enchantments"),
    enabled: canReadHeroes,
    staleTime: 60000,
  })

  const itemStats = useMemo(() => {
    const items = catalog.data
    if (!items) return undefined
    const byCategory = (categories.data ?? []).map((category) => {
      const inCategory = items.filter((item) => item.content.categoryCode === category.code)
      return {
        category: warehouseText(category.translations, locale)?.name ?? category.code,
        count: inCategory.length,
        tier1: inCategory.filter((item) => item.content.tier === 1).length,
        tier2: inCategory.filter((item) => item.content.tier === 2).length,
        tier3: inCategory.filter((item) => item.content.tier === 3).length,
      }
    })
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
      byCategory,
    }
  }, [catalog.data, categories.data, locale])

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
            to: "/image-management",
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
    { label: "Phụ trợ", value: spells.data?.length, hint: "Phép bổ trợ", icon: NAV_ICONS.spells, to: "/spells" },
  ]

  const coverage: CoverageRow[] = [
    ...(itemStats
      ? [
          { label: "Công thức trang bị đã chốt", done: itemStats.settled, total: itemStats.total },
          { label: "Vị trí shop đầy đủ", done: itemStats.placed, total: itemStats.total },
        ]
      : []),
  ]

  const todos: TodoRow[] = [
    {
      title: "Trang bị chưa hoàn thiện",
      description: "Còn thiếu dữ liệu bắt buộc để xuất bản",
      count: itemStats?.incomplete.length ?? 0,
      icon: ShieldAlert,
      to: itemStats?.incomplete[0] ? `/items?item=${itemStats.incomplete[0].id}` : "/items",
    },
    {
      title: "Công thức chưa xác nhận",
      description: "Chưa đủ dữ liệu để chốt nguyên liệu",
      count: itemStats?.unverified ?? 0,
      icon: ScrollText,
      to: itemStats?.firstUnverified ? `/items?item=${itemStats.firstUnverified.id}` : "/items",
    },
    ...(arcana.data && arcana.data.length === 0
      ? [
          {
            title: "Chưa có dữ liệu ngọc",
            description: "Kho chưa có ngọc nào",
            count: 1,
            icon: NAV_ICONS.arcana,
            to: "/arcana",
          },
        ]
      : []),
  ].filter((todo) => todo.count > 0)

  return (
    <Page>
      <PageHeader title="Bảng điều khiển" />
      {(rulesets.isError ||
        catalog.isError ||
        enchantments.isError ||
        arcana.isError ||
        spells.isError ||
        categories.isError ||
        branches.isError) && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          Chưa tải đầy đủ số liệu kho trang bị từ backend.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="group rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card className="h-full gap-1 py-3 transition-colors group-hover:bg-accent/50">
              <CardHeader className="gap-1 px-3">
                <CardDescription className="text-xs">{stat.label}</CardDescription>
                <CardAction>
                  <stat.icon className="size-4 text-muted-foreground" />
                </CardAction>
                <CardTitle className="text-xl tabular-nums">
                  {stat.value === undefined ? <Skeleton className="h-7 w-14" /> : formatNumber(stat.value)}
                </CardTitle>
              </CardHeader>
              <CardContent className="truncate px-3 text-[11px] text-muted-foreground">{stat.hint}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {canReadHeroes && <CurrentPatchCard locale={locale} />}
        <Card className={canReadHeroes ? "xl:col-span-3" : "xl:col-span-5"}>
          <CardHeader>
            <CardTitle>Việc cần xử lý</CardTitle>
            <CardDescription>Ưu tiên các mục thiếu dữ liệu và công thức chưa xác nhận.</CardDescription>
          </CardHeader>
          <CardContent>
            {todos.length ? (
              <ItemGroup className="rounded-md border">
                {todos.map((todo, position) => (
                  <div key={todo.title}>
                    {position > 0 && <ItemSeparator />}
                    <Item asChild size="sm" className="rounded-none hover:bg-accent/50">
                      <Link to={todo.to}>
                        <ItemMedia variant="icon">
                          <todo.icon />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{todo.title}</ItemTitle>
                          <ItemDescription>{todo.description}</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Badge variant="secondary" className="tabular-nums">
                            {formatNumber(todo.count)}
                          </Badge>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </ItemActions>
                      </Link>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            ) : catalog.isPending ? (
              <Skeleton className="h-64 w-full" />
            ) : catalog.isError ? (
              <p className="py-6 text-sm text-muted-foreground">Chưa kiểm tra được dữ liệu trang bị.</p>
            ) : (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <NAV_ICONS.items />
                  </EmptyMedia>
                  <EmptyTitle>Không có mục cần xử lý</EmptyTitle>
                  <EmptyDescription>Dữ liệu trang bị hiện có đã đủ các mục đang kiểm tra.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Độ phủ dữ liệu</CardTitle>
            <CardDescription>Tỉ lệ hoàn thiện dữ liệu trang bị đã thu thập.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {coverage.length === 0 && <Skeleton className="h-64 w-full" />}
            {coverage.map((row) => {
              // Floor so an incomplete set never reads as 100%.
              const percent = row.total ? (row.done === row.total ? 100 : Math.floor((row.done / row.total) * 100)) : 0
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
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Trang bị theo nhóm shop</CardTitle>
            <CardDescription>Di chuột vào cột để xem phân bổ theo cấp.</CardDescription>
          </CardHeader>
          <CardContent>
            {itemStats ? (
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={itemStats.byCategory} margin={{ top: 8, left: -16, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                    content={({ active, payload }) => {
                      const row = active
                        ? (payload?.[0]?.payload as (typeof itemStats.byCategory)[number] | undefined)
                        : undefined
                      if (!row) return null
                      return (
                        <div className="grid min-w-36 gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="font-medium">{row.category}</div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Tổng</span>
                            <span className="font-mono font-medium tabular-nums">{row.count}</span>
                          </div>
                          {[1, 2, 3].map((tier) => (
                            <div key={tier} className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Cấp {tier}</span>
                              <span className="font-mono tabular-nums">{row[`tier${tier}` as "tier1"]}</span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
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
  const pending = data?.releases.filter((entry) => entry.phase === "AWAITING_CONFIRMATION").length ?? 0
  const changes = useQuery({
    queryKey: ["patch-changes", variant?.id, locale],
    queryFn: () =>
      backendRequest<{ heroId: string; sourceKind?: string }[]>(
        `/admin/patch-variants/${variant!.id}/hero-changes?locale=${encodeURIComponent(locale)}`,
      ),
    enabled: !!variant,
    staleTime: 60000,
  })
  const fromNotes = changes.data?.filter((change) => change.sourceKind === "PATCH_NOTES").length ?? 0
  return (
    <Card className="xl:col-span-2">
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
              <div className="rounded-lg border p-2.5">
                <dt className="text-xs text-muted-foreground">Tướng có thay đổi</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {changes.data ? formatNumber(changes.data.length) : "…"}
                </dd>
              </div>
              <div className="rounded-lg border p-2.5">
                <dt className="text-xs text-muted-foreground">Ghi từ ghi chú cập nhật</dt>
                <dd className="text-lg font-semibold tabular-nums">{changes.data ? formatNumber(fromNotes) : "…"}</dd>
              </div>
            </dl>
            {pending > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {pending} lịch phát hành đang chờ xác nhận áp dụng.
              </p>
            )}
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
