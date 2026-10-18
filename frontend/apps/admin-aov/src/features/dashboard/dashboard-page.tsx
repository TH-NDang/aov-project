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
import {
  useArcanaStatus,
  useAudit,
  useBadges,
  useEnchantments,
  useItemCatalog,
  useItemIssues,
  usePortraits,
} from "@/lib/queries"
import { formatNumber, formatRelative } from "@/lib/text"
import { useHeroIndex } from "@/lib/use-wiki-index"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { createPublishingApi } from "../publishing/publishing-api"

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
  const { index } = useHeroIndex()
  const portraits = usePortraits()
  const catalog = useItemCatalog()
  const issues = useItemIssues()
  const enchantments = useEnchantments()
  const badges = useBadges()
  const arcana = useArcanaStatus()
  const audit = useAudit()

  const heroStats = useMemo(() => {
    if (!index) return undefined
    const skins = index.heroes.flatMap((hero) => hero.skins.filter((skin) => !skin.isDefault))
    return {
      heroes: index.heroes.length,
      skins: skins.length,
      heroPortraits: index.heroes.filter((hero) => hero.portrait).length,
      skinPortraits: skins.filter((skin) => skin.portrait).length,
      skinArt: skins.filter((skin) => skin.head && skin.cover).length,
    }
  }, [index])

  const itemStats = useMemo(() => {
    const items = catalog.data?.items
    if (!items) return undefined
    const byCategory = (catalog.data?.categories ?? []).map((category) => {
      const inCategory = items.filter((item) => item.category === category.name)
      return {
        category: category.name,
        count: inCategory.length,
        tier1: inCategory.filter((item) => item.tier === 1).length,
        tier2: inCategory.filter((item) => item.tier === 2).length,
        tier3: inCategory.filter((item) => item.tier === 3).length,
      }
    })
    return {
      total: items.length,
      settled: items.filter((item) => item.recipe.status !== "unverified").length,
      unverified: items.filter((item) => item.recipe.status === "unverified").length,
      placed: items.filter((item) =>
        item.shopPositions.every((position) => position.row !== null && position.column !== null),
      ).length,
      byCategory,
    }
  }, [catalog.data])

  const unmatched =
    index && portraits.data ? portraits.data.filter((row) => !index.owners.has(row.file)).length : undefined

  const stats: StatTile[] = [
    ...(canReadHeroes
      ? [
          {
            label: "Tướng",
            value: heroes.data?.totalElements,
            hint: "Danh mục backend",
            icon: Swords,
            to: "/publishing",
          },
        ]
      : []),
    {
      label: "Portrait trang phục",
      value: heroStats?.skinPortraits,
      hint: "Ảnh trong tài nguyên",
      icon: ImageIcon,
      to: "/portraits",
    },
    {
      label: "Portrait chưa khớp",
      value: unmatched,
      hint: "Tài nguyên chưa có nơi nhận",
      icon: ImageIcon,
      to: "/portraits?tab=unmatched",
    },
    {
      label: "Trang bị",
      value: itemStats?.total,
      hint: `Thu thập ${catalog.data?.collectedOn ?? "…"}`,
      icon: Shield,
      to: "/items",
    },
    { label: "Phù hiệu", value: enchantments.data?.length, hint: "4 hệ", icon: Hexagon, to: "/enchantments" },
    {
      label: "Bậc trang phục",
      value: badges.data?.length,
      hint: "Nhãn bậc & sự kiện",
      icon: Medal,
      to: "/media/badges",
    },
  ]

  const coverage: CoverageRow[] = [
    ...(heroStats
      ? [
          { label: "Portrait tướng trong tài nguyên", done: heroStats.heroPortraits, total: heroStats.heroes },
          { label: "Portrait trang phục trong tài nguyên", done: heroStats.skinPortraits, total: heroStats.skins },
          { label: "Head & cover trang phục trong tài nguyên", done: heroStats.skinArt, total: heroStats.skins },
        ]
      : []),
    ...(itemStats
      ? [
          { label: "Công thức trang bị đã chốt", done: itemStats.settled, total: itemStats.total },
          { label: "Vị trí shop đầy đủ", done: itemStats.placed, total: itemStats.total },
        ]
      : []),
  ]

  const todos: TodoRow[] = [
    {
      title: "Portrait chưa khớp",
      description: "Ảnh xuất từ Figma chưa gán cho tướng hay trang phục nào",
      count: unmatched ?? 0,
      icon: ImageIcon,
      to: "/portraits?tab=unmatched",
    },
    {
      title: "Trang bị cần kiểm tra",
      description: "Lệch cấp, trùng hoặc thiếu vị trí so với Excel",
      count: issues.data?.length ?? 0,
      icon: ShieldAlert,
      to: "/items?tab=review",
    },
    {
      title: "Công thức chưa xác nhận",
      description: "Chưa đủ dữ liệu để chốt nguyên liệu",
      count: itemStats?.unverified ?? 0,
      icon: ScrollText,
      to: "/items?recipe=unverified",
    },
    ...(arcana.data && arcana.data.count === 0
      ? [{ title: "Bảng ngọc chưa thu thập", description: arcana.data.note, count: 1, icon: Gem, to: "/arcana" }]
      : []),
  ].filter((todo) => todo.count > 0)

  return (
    <Page>
      <PageHeader title="Bảng điều khiển" description="Tình trạng dữ liệu AOV Wiki và những việc cần xử lý." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
            <CardDescription>Bấm để mở đúng danh sách đã lọc.</CardDescription>
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
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Độ phủ dữ liệu</CardTitle>
            <CardDescription>Tỉ lệ hoàn thiện bộ tài nguyên ảnh và dữ liệu trang bị.</CardDescription>
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
