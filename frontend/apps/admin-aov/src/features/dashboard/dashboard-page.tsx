import { useMemo } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChevronRight,
  Gem,
  Hexagon,
  History,
  ImageIcon,
  Medal,
  ScrollText,
  Shield,
  ShieldAlert,
  Swords,
  Zap,
  type LucideIcon,
} from "lucide-react"
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
import { useAudit } from "@/lib/queries"
import { formatNumber, formatRelative } from "@/lib/text"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { createPublishingApi } from "../publishing/publishing-api"
import type { PageSlice } from "../publishing/types"
import { useContentLocale } from "../publishing/publication-overview"
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
  const ruleset = rulesets.data?.find((entry) => entry.code === "aov-standard") ?? rulesets.data?.[0]
  const rulesetId = canReadHeroes ? (ruleset?.id ?? "") : ""
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
  const audit = useAudit()

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
            hint: "Danh mục backend",
            icon: Swords,
            to: "/hero",
          },
          {
            label: "Ảnh đã lưu",
            value: images.data?.totalElements,
            hint: "Thư viện Media backend",
            icon: ImageIcon,
            to: "/image-management",
          },
          {
            label: "Bậc trang phục",
            value: badges.data?.totalElements,
            hint: "Tên và icon theo ngôn ngữ",
            icon: Medal,
            to: "/hero/media?tab=badges",
          },
        ]
      : []),
    {
      label: "Trang bị",
      value: itemStats?.total,
      hint: ruleset?.code ?? "Danh mục backend",
      icon: Shield,
      to: "/items",
    },
    {
      label: "Phù hiệu",
      value: enchantments.data?.length,
      hint: `${branches.data?.length ?? "…"} hệ`,
      icon: Hexagon,
      to: "/enchantments",
    },
    { label: "Bảng ngọc", value: arcana.data?.length, hint: "Ngọc theo màu và cấp", icon: Gem, to: "/arcana" },
    { label: "Phụ trợ", value: spells.data?.length, hint: "Khả dụng và trạng thái", icon: Zap, to: "/spells" },
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
      to: itemStats?.incomplete[0] ? `/items?tab=list&item=${itemStats.incomplete[0].id}` : "/items?tab=list",
    },
    {
      title: "Công thức chưa xác nhận",
      description: "Chưa đủ dữ liệu để chốt nguyên liệu",
      count: itemStats?.unverified ?? 0,
      icon: ScrollText,
      to: itemStats?.firstUnverified ? `/items?tab=list&item=${itemStats.firstUnverified.id}` : "/items?tab=list",
    },
    ...(arcana.data && arcana.data.length === 0
      ? [
          {
            title: "Chưa có dữ liệu ngọc",
            description: "Bộ quy tắc này chưa có ngọc trong backend",
            count: 1,
            icon: Gem,
            to: "/arcana",
          },
        ]
      : []),
  ].filter((todo) => todo.count > 0)

  return (
    <Page>
      <PageHeader title="Bảng điều khiển" description="Tình trạng dữ liệu AOV Wiki và những việc cần xử lý." />
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="group rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card className="h-full gap-2 py-4 transition-colors group-hover:bg-accent/50">
              <CardHeader className="px-4">
                <CardDescription>{stat.label}</CardDescription>
                <CardAction>
                  <stat.icon className="size-4 text-muted-foreground" />
                </CardAction>
                <CardTitle className="text-2xl tabular-nums">
                  {stat.value === undefined ? <Skeleton className="h-8 w-16" /> : formatNumber(stat.value)}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs text-muted-foreground">{stat.hint}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
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
                    <Shield />
                  </EmptyMedia>
                  <EmptyTitle>Không có mục cần xử lý</EmptyTitle>
                  <EmptyDescription>Dữ liệu trang bị hiện có đã đủ các mục đang kiểm tra.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

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
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
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

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
            <CardDescription>Nhật ký thao tác quản trị (audit).</CardDescription>
          </CardHeader>
          <CardContent>
            {audit.data?.length ? (
              <ol className="space-y-3">
                {audit.data.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-sm">
                    <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{entry.action}</span> · {entry.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(entry.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <History />
                  </EmptyMedia>
                  <EmptyTitle>Chưa có thao tác nào</EmptyTitle>
                  <EmptyDescription>
                    Mọi lần lưu tướng, trang phục, portrait, trang bị, phù hiệu sẽ hiện ở đây.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}
