import { Fragment, useMemo, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  Languages,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { Page } from "@/components/page-header"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useCollapseScrollAnchor } from "@/hooks/use-collapse-scroll-anchor"
import { errorMessage } from "@/lib/api/errors"
import { HeroAsset } from "../publishing/hero-content"
import { useContentLocale } from "../publishing/publication-overview"
import type { Request } from "../publishing/publishing-api"
import {
  characterImageKeys,
  createCharacterImageApi,
  type BadgeSkin,
  type SkinBadgeRecord,
} from "./character-image-api"
import { ImageContextControls, useImageContext } from "./character-image-context"
import { SkinBadgeEditor, badgeKindLabels } from "./skin-badge-editor"
import { SkinBadgeGroupAssignment, SkinBadgeGroupEditor } from "./skin-badge-group-editor"
import {
  badgeGroupKey,
  badgeGroupKeys,
  badgeGroupKindLabels,
  badgeGroupLabel,
  createSkinBadgeGroupsApi,
  type BadgeGroup,
} from "./skin-badge-groups-api"
import { SkinMediaDetail } from "./skin-media-detail"
import { SkinBadgeArtwork } from "./skin-badge-artwork"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, SkinBadgeRecord>()

export function BadgesPage({ request = backendRequest }: { request?: Request }) {
  const context = useImageContext(request)
  const locale = useContentLocale()
  const { actor } = useSession()
  const writable = !!actor?.capabilities.includes("hero:write")
  const api = useMemo(() => createSkinBadgeGroupsApi(request), [request])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const scrollRoot = useRef<HTMLDivElement>(null)
  const preserveCollapse = useCollapseScrollAnchor(scrollRoot, expanded)
  const [editor, setEditor] = useState<SkinBadgeRecord | null | undefined>(undefined)
  const [newGroupId, setNewGroupId] = useState<string | null>(null)
  const [groupEditor, setGroupEditor] = useState<BadgeGroup | null | undefined>(undefined)
  const [moving, setMoving] = useState<SkinBadgeRecord | null>(null)
  const [selectedSkin, setSelectedSkin] = useState<BadgeSkin | null>(null)
  const groups = useInfiniteQuery({
    queryKey: badgeGroupKeys.list(locale, context.q),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.groups(locale, context.q, pageParam, signal),
    enabled: !!context.rulesetId,
    staleTime: 60000,
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
  })
  const data = useMemo(() => groups.data?.pages.flatMap((page) => page.items) ?? [], [groups.data])
  function createBadge(groupId: string | null) {
    setNewGroupId(groupId)
    setEditor(null)
  }
  return (
    <Page className="min-h-0 min-w-0 gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <ImageContextControls context={context} placeholder="Tìm nhóm, tên hoặc mã nhãn…" />
        </div>
        {writable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setGroupEditor(null)}>
              <Plus className="size-4" />
              Tạo nhóm
            </Button>
            <Button onClick={() => createBadge(null)}>
              <Plus className="size-4" />
              Tạo nhãn
            </Button>
          </div>
        )}
      </div>
      {(groups.isError || context.rulesets.isError) && (
        <p role="alert" className="shrink-0 text-sm text-destructive">
          {errorMessage(groups.error ?? context.rulesets.error)}
        </p>
      )}
      <div
        ref={scrollRoot}
        role="region"
        aria-label="Danh sách bậc trang phục"
        tabIndex={0}
        className="relative min-h-0 min-w-0 flex-1 scroll-auto overflow-auto rounded-xl border [overflow-anchor:none]"
      >
        <div className="divide-y">
          {data.map((group) => {
            const key = badgeGroupKey(group)
            const open = expanded[key] ?? (!!context.q || !group.id)
            const name = badgeGroupLabel(group)
            return (
              <section key={key} aria-label={`Nhóm ${name}`}>
                <div
                  data-badge-group={group.code}
                  className="group sticky top-0 z-20 flex min-w-0 items-center gap-1 border-b bg-background px-3 py-1.5"
                >
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`${open ? "Thu gọn" : "Mở"} nhóm ${name}`}
                    aria-expanded={open}
                    aria-controls={`badge-group-${key}`}
                    onClick={(event) => {
                      if (open) preserveCollapse(event.currentTarget.parentElement!)
                      setExpanded((current) => ({ ...current, [key]: !open }))
                    }}
                  >
                    {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <span className="truncate font-semibold">{name}</span>
                    {group.kind && (
                      <Badge variant="outline" className="hidden shrink-0 text-xs sm:inline-flex">
                        {badgeGroupKindLabels[group.kind]}
                      </Badge>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{group.badgeCount} nhãn</span>
                  </button>
                  {writable && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                          aria-label={`Tùy chọn nhóm ${name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {group.id && (
                          <DropdownMenuItem onSelect={() => setGroupEditor(group)}>
                            <Pencil className="size-4" />
                            Sửa nhóm
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => createBadge(group.id)}>
                          <Plus className="size-4" />
                          Tạo nhãn trong nhóm
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div id={`badge-group-${key}`} hidden={!open}>
                  <BadgeGroupRows
                    group={group}
                    active={open}
                    rulesetId={context.rulesetId}
                    locale={locale}
                    q={group.matchedByGroup ? "" : context.q}
                    request={request}
                    writable={writable}
                    onEdit={setEditor}
                    onMove={setMoving}
                    onOpenSkin={setSelectedSkin}
                  />
                </div>
              </section>
            )
          })}
          {groups.isPending && !!context.rulesetId && (
            <p role="status" className="p-8 text-center text-sm text-muted-foreground">
              Đang tải nhóm nhãn…
            </p>
          )}
          {!groups.isPending && !data.length && (
            <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
              Chưa có nhóm hoặc nhãn phù hợp.
            </p>
          )}
        </div>
        <InfiniteScroll query={groups} rootRef={scrollRoot} label="Đang tải thêm nhóm nhãn…" />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {data.length} / {groups.data?.pages[0]?.totalElements ?? 0} nhóm
        </p>
      </div>
      {editor !== undefined && (
        <SkinBadgeEditor
          key={editor?.id ?? `new:${newGroupId}`}
          badge={editor}
          initialGroupId={newGroupId}
          locale={locale}
          request={request}
          onClose={() => setEditor(undefined)}
        />
      )}
      {groupEditor !== undefined && (
        <SkinBadgeGroupEditor
          key={groupEditor?.id ?? "new"}
          group={groupEditor}
          locale={locale}
          request={request}
          onClose={() => setGroupEditor(undefined)}
        />
      )}
      {moving && (
        <SkinBadgeGroupAssignment
          key={moving.id}
          badge={moving}
          locale={locale}
          request={request}
          onClose={() => setMoving(null)}
        />
      )}
      {selectedSkin && <SkinMediaDetail {...selectedSkin} request={request} onClose={() => setSelectedSkin(null)} />}
    </Page>
  )
}

function BadgeGroupRows({
  group,
  active,
  rulesetId,
  locale,
  q,
  request,
  writable,
  onEdit,
  onMove,
  onOpenSkin,
}: {
  group: BadgeGroup
  active: boolean
  rulesetId: string
  locale: string
  q: string
  request: Request
  writable: boolean
  onEdit: (badge: SkinBadgeRecord) => void
  onMove: (badge: SkinBadgeRecord) => void
  onOpenSkin: (skin: BadgeSkin) => void
}) {
  const api = useMemo(() => createSkinBadgeGroupsApi(request), [request])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const badges = useInfiniteQuery({
    queryKey: badgeGroupKeys.badges(group.id, rulesetId, locale, q),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.badges(group.id, rulesetId, locale, q, pageParam, signal),
    enabled: active && !!rulesetId,
    staleTime: 60000,
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
  })
  const data = useMemo(() => badges.data?.pages.flatMap((page) => page.items) ?? [], [badges.data])
  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "name",
          header: "Nhãn trang phục",
          cell: ({ row: { original: badge } }) => (
            <div className="group/name flex min-w-64 items-center gap-1">
              <button
                type="button"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`${expanded.has(badge.id) ? "Thu gọn" : "Xem trang phục dùng nhãn"} ${badge.code}`}
                aria-expanded={expanded.has(badge.id)}
                onClick={() =>
                  setExpanded((old) => {
                    const next = new Set(old)
                    if (next.has(badge.id)) next.delete(badge.id)
                    else next.add(badge.id)
                    return next
                  })
                }
              >
                {expanded.has(badge.id) ? (
                  <ChevronDown className="size-4 shrink-0" />
                ) : (
                  <ChevronRight className="size-4 shrink-0" />
                )}
              </button>
              <SkinBadgeArtwork badge={badge} locale={locale} request={request} />
              <div className="min-w-0 flex-1 space-y-1">
                <button
                  type="button"
                  className="block max-w-full truncate rounded-sm text-left font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() =>
                    setExpanded((old) => {
                      const next = new Set(old)
                      if (next.has(badge.id)) next.delete(badge.id)
                      else next.add(badge.id)
                      return next
                    })
                  }
                >
                  {badge.displayName && badge.displayName !== badge.code ? badge.displayName : "Chưa đặt tên"}
                </button>
              </div>
              {writable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0 sm:opacity-0 sm:group-hover/name:opacity-100 sm:group-focus-within/name:opacity-100"
                      aria-label={`Tùy chọn nhãn ${badge.code}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => onEdit(badge)}>
                      <Pencil className="size-4" />
                      Sửa tên và bản dịch
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(badge)}>
                      <FolderInput className="size-4" />
                      Chuyển nhóm
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ),
        }),
        helper.display({
          id: "kind",
          header: "Phân loại",
          cell: ({ row }) => (
            <Badge variant="outline" className="whitespace-nowrap">
              {badgeKindLabels[row.original.kind] ?? "Chưa phân loại"}
            </Badge>
          ),
        }),
        helper.display({
          id: "translations",
          header: "Bản dịch",
          cell: ({ row }) => (
            <div className="min-w-32 text-xs">
              <p className="flex items-center gap-1">
                <Languages className="size-3.5" />
                {row.original.translations.length} ngôn ngữ
              </p>
              {row.original.fallbackApplied && row.original.actualLocale ? (
                <p className="mt-1 text-amber-600 dark:text-amber-400">Đang dùng {row.original.actualLocale}</p>
              ) : (
                !row.original.translations.length && (
                  <p className="mt-1 text-muted-foreground">Chưa có tên / biểu tượng</p>
                )
              )}
            </div>
          ),
        }),
        helper.display({
          id: "usage",
          header: "Trang phục",
          cell: ({ row }) => <span className="tabular-nums">{row.original.skinCount}</span>,
        }),
      ]),
    [expanded, writable, onEdit, onMove, locale, request],
  )
  const table = useTable({ features, columns, data, getRowId: (row) => row.id })
  return (
    <div>
      {badges.isError && (
        <p role="alert" className="p-4 text-sm text-destructive">
          {errorMessage(badges.error)}
        </p>
      )}
      <div
        className="max-w-full overflow-x-auto"
        role="region"
        aria-label={`Bảng nhãn ${badgeGroupLabel(group)}`}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-3 py-2.5 font-medium ${header.column.id === "name" ? "sticky left-0 z-10 bg-muted" : ""}`}
                  >
                    <table.FlexRender header={header} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t">
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-3 py-3 ${cell.column.id === "name" ? "sticky left-0 z-[1] bg-background" : ""}`}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
                {expanded.has(row.id) && (
                  <tr className="border-t bg-muted/15">
                    <td colSpan={columns.length} className="p-4">
                      <BadgeSkins
                        id={row.id}
                        active={active}
                        rulesetId={rulesetId}
                        locale={locale}
                        request={request}
                        onOpen={onOpenSkin}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {badges.isPending && active ? (
        <p role="status" className="p-6 text-center text-sm text-muted-foreground">
          Đang tải nhãn…
        </p>
      ) : (
        !data.length &&
        !badges.isError && <p className="p-6 text-sm text-muted-foreground">Chưa có nhãn trong nhóm này.</p>
      )}
      {!!data.length && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {data.length} / {badges.data?.pages[0]?.totalElements ?? 0} nhãn
          </span>
        </div>
      )}
      <InfiniteScroll query={badges} enabled={active} label={`Đang tải thêm nhãn nhóm ${badgeGroupLabel(group)}…`} />
    </div>
  )
}

function BadgeSkins({
  id,
  active,
  rulesetId,
  locale,
  request,
  onOpen,
}: {
  id: string
  active: boolean
  rulesetId: string
  locale: string
  request: Request
  onOpen: (skin: BadgeSkin) => void
}) {
  const api = useMemo(() => createCharacterImageApi(request), [request])
  const query = useInfiniteQuery({
    queryKey: characterImageKeys.badgeSkins(id, rulesetId, locale),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.badgeSkins(id, rulesetId, locale, pageParam, signal),
    enabled: active && !!rulesetId,
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
  })
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trang phục đang dùng</h3>
      {query.isPending && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải trang phục…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(query.error)}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {query.data?.pages
          .flatMap((page) => page.items)
          .map((skin) => (
            <button
              key={`${skin.revisionId}:${skin.skinKey}`}
              type="button"
              aria-label={`Xem trang phục ${skin.skinName}`}
              className="group flex min-w-0 items-center gap-3 rounded-lg border bg-background p-2 text-left hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => onOpen(skin)}
            >
              <HeroAsset id={skin.artAssetId} alt={skin.skinName} className="h-12 w-20 shrink-0 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{skin.skinName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {skin.heroName} · {skin.heroCode}
                </span>
              </span>
            </button>
          ))}
      </div>
      {query.data?.pages[0]?.totalElements === 0 && (
        <p className="text-sm text-muted-foreground">Chưa gắn cho trang phục nào trong bộ quy tắc này.</p>
      )}
      <InfiniteScroll query={query} enabled={active} label="Đang tải thêm trang phục…" />
    </div>
  )
}
