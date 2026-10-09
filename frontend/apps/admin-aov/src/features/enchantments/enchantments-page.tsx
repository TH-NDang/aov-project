import { useMemo } from "react"
import { Search, Sparkles, X } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@aov/ui/components/input-group"
import { Skeleton } from "@aov/ui/components/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import type { Enchantment } from "@/lib/api/types"
import { MasterDetail } from "@/components/master-detail"
import { MediaImage } from "@/components/media-image"
import { PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { useEnchantmentGroups, useEnchantments } from "@/lib/queries"
import { matchesQuery } from "@/lib/text"
import { EnchantmentEditor } from "./enchantment-editor"

const TIERS = ["I", "II", "III"] as const

export function EnchantmentsPage() {
  const groups = useEnchantmentGroups()
  const enchantments = useEnchantments()
  const [groupFilter, setGroupFilter] = useSearchParam("group", "all")
  const [search, setSearch] = useSearchParam("q")
  const [selectedId, setSelectedId] = useSearchParam("item")

  const visible = useMemo(
    () =>
      (enchantments.data ?? []).filter((item) =>
        matchesQuery(search, item.name, item.summary, item.description, item.id),
      ),
    [enchantments.data, search],
  )
  const selected = enchantments.data?.find((item) => item.id === selectedId)
  const loading = !groups.data || !enchantments.data

  return (
    <MasterDetail
      detail={
        selected ? (
          <EnchantmentEditor item={selected} group={groups.data?.find((group) => group.id === selected.groupId)} />
        ) : null
      }
      detailTitle="Chỉnh sửa phù hiệu"
      onCloseDetail={() => setSelectedId(null)}
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <PageHeader
          title="Phù hiệu"
          description="Bốn hệ phù hiệu, mỗi hệ ba cấp. Vị trí theo Excel: hàng 0–2 ứng với cấp I–III, cột từ 0."
        />
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-8 w-full sm:w-72">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên hoặc nội dung…"
              aria-label="Tìm phù hiệu"
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" onClick={() => setSearch(null)} aria-label="Xoá tìm kiếm">
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            value={groupFilter}
            onValueChange={(value) => value && setGroupFilter(value)}
            className="flex-wrap"
          >
            <ToggleGroupItem value="all">Tất cả hệ</ToggleGroupItem>
            {groups.data?.map((group) => (
              <ToggleGroupItem key={group.id} value={group.id}>
                <MediaImage path={group.icon.file} className="size-4 object-contain" />
                {group.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="ml-auto text-sm text-muted-foreground">{visible.length} phù hiệu</span>
        </div>

        {loading ? (
          <div className="grid gap-4 2xl:grid-cols-2">
            {Array.from({ length: 4 }, (_, key) => (
              <Skeleton key={key} className="h-80 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-2">
            {groups
              .data!.filter((group) => groupFilter === "all" || group.id === groupFilter)
              .map((group) => {
                const items = visible.filter((item) => item.groupId === group.id)
                if (!items.length && search) return null
                const columns = Math.max(3, ...items.map((item) => item.position.column + 1))
                return (
                  <Card key={group.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <MediaImage
                          path={group.icon.file}
                          alt={group.name}
                          className="size-12 shrink-0 object-contain"
                        />
                        <div className="min-w-0 space-y-1">
                          <CardTitle>{group.name}</CardTitle>
                          <CardDescription>{group.description}</CardDescription>
                        </div>
                      </div>
                      <CardAction className="flex items-center gap-1">
                        {group.icon.derived && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline">
                                <Sparkles /> Ảnh tái tạo
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-72">{group.icon.note}</TooltipContent>
                          </Tooltip>
                        )}
                        <Badge variant="secondary">{items.length}</Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `2.5rem repeat(${columns}, minmax(0, 1fr))` }}
                      >
                        {TIERS.map((label, row) => (
                          <div
                            key={label}
                            className="flex items-center justify-center text-xs font-medium text-muted-foreground"
                            style={{ gridRow: row + 1, gridColumn: 1 }}
                          >
                            {label}
                          </div>
                        ))}
                        {items.map((item) => (
                          <EnchantmentTile
                            key={item.id}
                            item={item}
                            active={item.id === selectedId}
                            onSelect={() => setSelectedId(item.id)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        )}
      </div>
    </MasterDetail>
  )
}

function EnchantmentTile({ item, active, onSelect }: { item: Enchantment; active: boolean; onSelect: () => void }) {
  const website = item.websitePosition
  const differs = website && (website.row !== item.position.row || website.column !== item.position.column)
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ gridRow: item.position.row + 1, gridColumn: item.position.column + 2 }}
      className={cn(
        "relative flex min-w-0 flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active && "ring-2 ring-primary",
      )}
    >
      <MediaImage path={item.image.file} alt="" className="size-11 object-contain" />
      <span className="w-full truncate text-sm font-medium">{item.name}</span>
      <span className="w-full truncate text-xs text-muted-foreground">{item.summary}</span>
      {differs && (
        <span
          role="img"
          aria-label="Vị trí trên web khác Excel"
          title="Vị trí trên web khác Excel"
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-chart-4"
        />
      )}
    </button>
  )
}
