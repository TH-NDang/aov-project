import { useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { backendRequest } from "@/app/auth/session"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { HeroAsset } from "../publishing/hero-content"
import { control } from "../publishing/fields"
import type { Request } from "../publishing/publishing-api"
import { createCharacterImageApi } from "./character-image-api"
import {
  badgeGroupKey,
  badgeGroupKeys,
  badgeGroupLabel,
  createSkinBadgeGroupsApi,
  type BadgeGroup,
} from "./skin-badge-groups-api"

export function SkinBadgePicker({
  value,
  onChange,
  locale,
  request = backendRequest,
}: {
  value: string | null
  onChange: (value: string | null) => void
  locale: string
  request?: Request
}) {
  const api = useMemo(() => createCharacterImageApi(request), [request])
  const groupsApi = useMemo(() => createSkinBadgeGroupsApi(request), [request])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const selected = useQuery({
    queryKey: ["skin-badges", "selected", locale, value],
    queryFn: ({ signal }) => api.badges("", locale, value!, 0, signal),
    enabled: !!value,
    staleTime: 60000,
  })
  const groups = useInfiniteQuery({
    queryKey: badgeGroupKeys.list(locale, q),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => groupsApi.groups(locale, q, pageParam, signal),
    enabled: open,
    staleTime: 60000,
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
  })
  const current = selected.data?.items.find((badge) => badge.code === value)
  const items = groups.data?.pages.flatMap((page) => page.items) ?? []
  const choose = (code: string | null) => {
    onChange(code)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-10 w-full justify-between text-left"
          aria-label="Chọn bậc trang phục"
        >
          <span className="flex min-w-0 items-center gap-2">
            {current && <HeroAsset id={current.iconAssetId} className="size-7 rounded" />}
            <span className="truncate">
              {current?.displayName && current.displayName !== current.code
                ? current.displayName
                : value
                  ? "Chưa đặt tên"
                  : "Chưa chọn bậc / nhãn"}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-2">
        <input
          autoFocus
          aria-label="Tìm bậc trang phục"
          placeholder="Tìm nhóm, tên hoặc mã nhãn…"
          className={control}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          maxLength={100}
        />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => choose(null)}
          >
            Không gắn nhãn
          </Button>
          {items.map((group) => {
            const key = badgeGroupKey(group)
            const groupOpen = expanded[key] ?? (!!q || !group.id)
            return (
              <div key={key} className="rounded-md border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md bg-muted/40 px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`${groupOpen ? "Thu gọn" : "Mở"} nhóm nhãn ${badgeGroupLabel(group)}`}
                  aria-expanded={groupOpen}
                  onClick={() => setExpanded((current) => ({ ...current, [key]: !groupOpen }))}
                >
                  {groupOpen ? (
                    <ChevronDown className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{badgeGroupLabel(group)}</span>
                  <span className="text-xs text-muted-foreground">{group.badgeCount}</span>
                </button>
                <div hidden={!groupOpen}>
                  <PickerGroup
                    group={group}
                    active={open && groupOpen}
                    value={value}
                    locale={locale}
                    q={group.matchedByGroup ? "" : q}
                    request={request}
                    onChoose={choose}
                  />
                </div>
              </div>
            )
          })}
          {groups.isPending && (
            <p role="status" className="p-3 text-sm text-muted-foreground">
              Đang tải nhóm nhãn…
            </p>
          )}
          {groups.isError && (
            <p role="alert" className="p-3 text-sm text-destructive">
              Không tải được nhóm nhãn.
            </p>
          )}
          {!groups.isPending && !items.length && (
            <p className="p-3 text-sm text-muted-foreground">Chưa có nhãn phù hợp.</p>
          )}
          <InfiniteScroll query={groups} enabled={open} label="Đang tải thêm nhóm nhãn…" />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PickerGroup({
  group,
  active,
  value,
  locale,
  q,
  request,
  onChoose,
}: {
  group: BadgeGroup
  active: boolean
  value: string | null
  locale: string
  q: string
  request: Request
  onChoose: (code: string) => void
}) {
  const api = useMemo(() => createSkinBadgeGroupsApi(request), [request])
  const badges = useInfiniteQuery({
    queryKey: badgeGroupKeys.badges(group.id, "", locale, q),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.badges(group.id, "", locale, q, pageParam, signal),
    enabled: active,
    staleTime: 60000,
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
  })
  const items = badges.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <div className="p-1">
      {items.map((badge) => (
        <button
          key={badge.id}
          type="button"
          className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => onChoose(badge.code)}
        >
          <HeroAsset id={badge.iconAssetId} className="size-9 rounded-md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {badge.displayName && badge.displayName !== badge.code ? badge.displayName : "Chưa đặt tên"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {badge.fallbackApplied && badge.actualLocale ? `Bản dịch ${badge.actualLocale}` : ""}
            </span>
          </span>
          {value === badge.code && <Check className="size-4" />}
        </button>
      ))}
      {badges.isPending && active && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          Đang tải nhãn…
        </p>
      )}
      {badges.isError && (
        <p role="alert" className="p-3 text-sm text-destructive">
          Không tải được nhãn trong nhóm.
        </p>
      )}
      {!badges.isPending && !items.length && <p className="p-3 text-sm text-muted-foreground">Nhóm chưa có nhãn.</p>}
      <InfiniteScroll query={badges} enabled={active} label={`Đang tải thêm nhãn nhóm ${badgeGroupLabel(group)}…`} />
    </div>
  )
}
