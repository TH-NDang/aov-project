import { useCallback, useMemo, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { Check, ChevronDown, ChevronRight, Images, LoaderCircle, PanelRightOpen } from "lucide-react"
import { backendRequest } from "@/app/auth/session"
import { Page } from "@/components/page-header"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useCollapseScrollAnchor } from "@/hooks/use-collapse-scroll-anchor"
import { errorMessage } from "@/lib/api/errors"
import { CharacterMediaImage } from "./character-media-image"
import { useContentLocale } from "../publishing/publication-overview"
import type { MediaRole } from "../publishing/types"
import type { Request } from "../publishing/publishing-api"
import {
  characterImageKeys,
  createCharacterImageApi,
  type CharacterImageEntry,
  type CharacterImageGroup,
} from "./character-image-api"
import { ImageContextControls, useImageContext } from "./character-image-context"
import { CharacterImageDetail, imageRoleLabels } from "./character-image-detail"
import { SkinBadgeLabel } from "./skin-badge-label"
import { MediaCode } from "./media-code"

const features = tableFeatures({})
interface ImageGroupRow {
  group: CharacterImageGroup
  heroMain: CharacterImageEntry
  heroImages: CharacterImageEntry[]
  skins: CharacterImageEntry[]
  expanded: boolean
  imageCount: number
  skinCount: number
}
const imageHelper = createColumnHelper<typeof features, CharacterImageEntry>()
type OpenImage = (group: CharacterImageGroup, entry: CharacterImageEntry) => void

function MainImageMarker({ entry }: { entry: CharacterImageEntry }) {
  if (!entry.main || !entry.assetId) return null
  return (
    <span
      role="img"
      aria-label="Ảnh chính"
      title="Ảnh chính"
      className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-emerald-100 text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-emerald-300"
    >
      <Check className="size-3" strokeWidth={3} />
    </span>
  )
}

function ImageRowsTable({
  group,
  entries,
  role,
  skins,
  locale,
  request,
  onOpen,
}: {
  group: CharacterImageGroup
  entries: CharacterImageEntry[]
  role: MediaRole
  skins: boolean
  locale: string
  request: Request
  onOpen: OpenImage
}) {
  const columns = useMemo(
    () =>
      imageHelper.columns([
        imageHelper.display({
          id: "image",
          header: imageRoleLabels[role],
          cell: ({ row }) => (
            <button
              type="button"
              className="relative block rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Xem ${imageRoleLabels[role]} ${row.original.name}`}
              onClick={() => onOpen(group, row.original)}
            >
              <CharacterMediaImage id={row.original.assetId} alt={row.original.name} role={role} size="row" />
              <MainImageMarker entry={row.original} />
            </button>
          ),
        }),
        ...(skins
          ? [
              imageHelper.display({
                id: "name",
                header: "Trang phục",
                cell: ({ row }) => (
                  <div className="min-w-0 space-y-0.5">
                    <button
                      type="button"
                      className="group/skin flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md px-1.5 text-left font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label={`Xem chi tiết trang phục ${row.original.name}`}
                      onClick={() => onOpen(group, row.original)}
                    >
                      <span className="break-words">{row.original.name}</span>
                      <PanelRightOpen className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                    <MediaCode value={row.original.skinKey ?? group.code} label="Mã trang phục" />
                    <div className="md:hidden">
                      <SkinBadgeLabel code={row.original.rarityCode} locale={locale} request={request} />
                    </div>
                    {!row.original.assetId && row.original.main && (
                      <p className="text-xs text-muted-foreground lg:hidden">Chưa chọn ảnh chính</p>
                    )}
                    {!row.original.main && <p className="text-xs text-muted-foreground lg:hidden">Ảnh bổ sung</p>}
                  </div>
                ),
              }),
            ]
          : []),
        imageHelper.display({
          id: "file",
          header: "Tên file",
          cell: ({ row }) => (
            <div className="min-w-0 space-y-1">
              <p className="break-all font-mono text-xs text-muted-foreground" title={row.original.label ?? ""}>
                {row.original.label || (row.original.assetId ? "Chưa có tên file" : "Chưa có ảnh")}
              </p>
              {!row.original.assetId && row.original.main && (
                <p className="text-xs text-muted-foreground">Chưa chọn ảnh chính</p>
              )}
              {!row.original.main && <p className="text-[11px] text-muted-foreground">Ảnh bổ sung</p>}
            </div>
          ),
        }),
        ...(skins
          ? [
              imageHelper.display({
                id: "badge",
                header: "Bậc / Nhãn",
                cell: ({ row }) => (
                  <div className="max-w-40">
                    <SkinBadgeLabel code={row.original.rarityCode} locale={locale} request={request} />
                  </div>
                ),
              }),
            ]
          : []),
      ]),
    [group, role, skins, locale, request, onOpen],
  )
  const table = useTable({
    features,
    columns,
    data: entries,
    getRowId: (entry) => `${entry.ownerType}:${entry.skinKey ?? "base"}:${entry.assetId ?? "missing"}:${entry.main}`,
  })
  const columnClass = (id: string) =>
    id === "file" && skins ? "hidden lg:table-cell" : id === "badge" ? "hidden md:table-cell" : ""
  return (
    <table
      aria-label={`${skins ? "Ảnh trang phục" : "Ảnh tướng"} ${group.name}`}
      className="w-full table-fixed border-separate border-spacing-0 text-sm"
    >
      <colgroup>
        <col className={role === "SPLASH" ? "w-24 sm:w-36" : "w-20 sm:w-24"} />
        {skins && <col />}
        <col className={skins ? "hidden lg:table-column lg:w-[30%]" : ""} />
        {skins && <col className="hidden md:table-column md:w-44" />}
      </colgroup>
      <thead className="bg-muted/30 text-left text-[11px] text-muted-foreground">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                scope="col"
                className={`border-b px-3 py-2 font-medium ${columnClass(header.column.id)}`}
              >
                <table.FlexRender header={header} />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="group/image">
            {row.getAllCells().map((cell) => (
              <td
                key={cell.id}
                className={`border-b px-3 py-1.5 align-middle ${columnClass(cell.column.id)} ${row.original.main ? "bg-background" : "bg-muted/10"}`}
              >
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function CharacterImagesPage({
  role,
  request = backendRequest,
  searchSlot,
}: {
  role: MediaRole
  request?: Request
  /** Header slot of the image workspace; see `ImageContextControls`. */
  searchSlot?: HTMLElement | null
}) {
  const context = useImageContext(request)
  const locale = useContentLocale()
  const api = useMemo(() => createCharacterImageApi(request), [request])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const scrollRoot = useRef<HTMLDivElement>(null)
  const preserveCollapse = useCollapseScrollAnchor(scrollRoot, expanded)
  const [selected, setSelected] = useState<{ group: CharacterImageGroup; entry: CharacterImageEntry } | null>(null)
  const openImage = useCallback<OpenImage>((group, entry) => setSelected({ group, entry }), [])
  const toggle = useCallback(
    (heroId: string, header: HTMLElement) => {
      if (expanded.has(heroId)) preserveCollapse(header)
      setExpanded((current) => {
        const next = new Set(current)
        if (next.has(heroId)) next.delete(heroId)
        else next.add(heroId)
        return next
      })
    },
    [expanded, preserveCollapse],
  )
  const images = useInfiniteQuery({
    queryKey: characterImageKeys.list(context.rulesetId, role, locale, context.q),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.groups(context.rulesetId, role, locale, context.q, pageParam, signal),
    enabled: !!context.rulesetId,
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
  })
  const data = useMemo<ImageGroupRow[]>(
    () =>
      images.data?.pages
        .flatMap((page) => page.items)
        .map((group) => {
          const base = group.entries.filter((entry) => entry.ownerType === "HERO")
          const heroMain = base.find((entry) => entry.main) ?? {
            ownerType: "HERO" as const,
            skinKey: null,
            name: group.name,
            assetId: null,
            label: null,
            main: true,
            rarityCode: null,
          }
          const heroImages = [heroMain, ...base.filter((entry) => entry !== heroMain)]
          const skins = group.entries.filter((entry) => entry.ownerType === "SKIN")
          const open = expanded.has(group.heroId)
          return {
            group,
            heroMain,
            heroImages,
            skins,
            expanded: open,
            imageCount: new Set([...heroImages, ...skins].map((entry) => entry.assetId).filter(Boolean)).size,
            skinCount: new Set(skins.map((entry) => entry.skinKey)).size,
          }
        }) ?? [],
    [images.data, expanded],
  )
  return (
    <Page className="min-h-0 min-w-0 gap-3 overflow-hidden">
      <ImageContextControls
        className="shrink-0"
        context={context}
        placeholder="Tìm tướng hoặc mã tướng…"
        searchSlot={searchSlot}
      />
      {(images.isError || context.rulesets.isError) && (
        <p role="alert" className="shrink-0 text-sm text-destructive">
          {errorMessage(images.error ?? context.rulesets.error)}
        </p>
      )}
      <div
        ref={scrollRoot}
        role="region"
        aria-label={`Danh sách ảnh ${imageRoleLabels[role]}`}
        tabIndex={0}
        className="relative min-h-0 min-w-0 flex-1 scroll-auto overflow-auto rounded-xl border [overflow-anchor:none]"
      >
        <div aria-label={`Nhóm tướng · ${imageRoleLabels[role]}`} className="divide-y">
          {data.map((row) => (
            <section key={row.group.heroId} aria-label={`Nhóm ảnh ${row.group.name}`}>
              <div
                data-hero-identity={row.group.code}
                className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b bg-background px-3 py-1.5"
              >
                <button
                  type="button"
                  className="relative shrink-0 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Xem ${imageRoleLabels[role]} chính ${row.group.name}`}
                  onClick={() => openImage(row.group, row.heroMain)}
                >
                  <CharacterMediaImage id={row.heroMain.assetId} alt={row.group.name} role={role} size="header" />
                  <MainImageMarker entry={row.heroMain} />
                </button>
                <button
                  type="button"
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`${row.expanded ? "Thu gọn" : "Mở nhóm ảnh"} ${row.group.name}`}
                  aria-expanded={row.expanded}
                  aria-controls={`hero-images-${role}-${row.group.heroId}`}
                  onClick={(event) => toggle(row.group.heroId, event.currentTarget.parentElement!)}
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-semibold">{row.group.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Images className="size-3.5" />
                        {row.imageCount} ảnh
                      </span>
                      <span>{row.skinCount} trang phục</span>
                      {!row.heroMain.assetId && <span>Chưa chọn ảnh chính</span>}
                    </span>
                  </span>
                  {row.expanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                <div className="hidden max-w-40 shrink-0 font-mono sm:block">
                  <MediaCode value={row.group.code} label="Mã tướng" plain />
                </div>
              </div>
              {row.expanded && (
                <div id={`hero-images-${role}-${row.group.heroId}`} className="min-w-0 space-y-2 bg-muted/10">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs text-muted-foreground">
                    <span>
                      Bản {row.group.revision.revisionNo} ·{" "}
                      {row.group.revision.state === "DRAFT" ? "Bản nháp" : "Đã xuất bản"}
                    </span>
                    <div className="sm:hidden">
                      <MediaCode value={row.group.code} label="Mã tướng" plain />
                    </div>
                  </div>
                  {row.heroImages.length > 1 && (
                    <section aria-label={`Nhóm ảnh bổ sung ${row.group.name}`}>
                      <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">Ảnh tướng bổ sung</h3>
                      <ImageRowsTable
                        group={row.group}
                        entries={row.heroImages.filter((entry) => entry !== row.heroMain)}
                        role={role}
                        skins={false}
                        locale={locale}
                        request={request}
                        onOpen={openImage}
                      />
                    </section>
                  )}
                  <section aria-label={`Nhóm ảnh trang phục ${row.group.name}`}>
                    <h3 className="sr-only">Trang phục · {row.skinCount}</h3>
                    {row.skins.length ? (
                      <ImageRowsTable
                        group={row.group}
                        entries={row.skins}
                        role={role}
                        skins
                        locale={locale}
                        request={request}
                        onOpen={openImage}
                      />
                    ) : (
                      <p className="px-3 pb-3 text-sm text-muted-foreground">Chưa có trang phục trong bản này.</p>
                    )}
                  </section>
                </div>
              )}
            </section>
          ))}
        </div>
        {images.isPending && !!context.rulesetId ? (
          <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải ảnh…
          </p>
        ) : (
          !data.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {context.rulesetId
                ? "Chưa có tướng phù hợp trong bộ quy tắc này."
                : "Tạo bộ quy tắc và nhập tướng để quản lý ảnh."}
            </p>
          )
        )}
        <InfiniteScroll query={images} rootRef={scrollRoot} label="Đang tải thêm tướng…" />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Đã tải {data.length} / {images.data?.pages[0]?.totalElements ?? 0} tướng
        </p>
      </div>
      {selected && (
        <CharacterImageDetail
          key={`${selected.group.revision.id}:${selected.entry.ownerType}:${selected.entry.skinKey}:${selected.entry.assetId}`}
          role={role}
          selected={selected}
          request={request}
          onClose={() => setSelected(null)}
        />
      )}
    </Page>
  )
}
