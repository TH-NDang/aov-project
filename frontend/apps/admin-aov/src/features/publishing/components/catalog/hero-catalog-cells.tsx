import { memo, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { tableFeatures, type Cell, type ReactTable } from "@tanstack/react-table"
import { ArrowUpRight, UserRound, Languages, Plus, ChevronDown } from "lucide-react"
import { useSession } from "@/app/auth/auth-gate"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { Link } from "react-router"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import { type HeroGameplayChange } from "@/lib/hero-types"
import { translationCoverage, type HeroCatalogRow } from "../../model/catalog/catalog-data"
import { type PublicationOverview } from "../../api/publication-overview"
import { LocalTime } from "@aov/ui/components/local-time"
import { formatInZone } from "@aov/ui/lib/time-zone"
import { ChangeKindBadges, HeroChangeSummary } from "../patch-changes/hero-change-badges"
import { languageOptions } from "../../../users/profile-preference-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { mediaKeys } from "@/features/media/api/media-cache"
import { pickTranslation } from "@aov/ui/lib/translation-fallback"

export const api = createPublishingApi(backendRequest)

export const features = tableFeatures({})

export type CatalogRow = HeroCatalogRow

const mobileColumnLabels: Record<string, string> = {
  changes: "Thay đổi",
  revision: "Trạng thái",
  translations: "Bản dịch",
  edited: "Sửa gần nhất",
}

export const HeroTableRow = memo(function HeroTableRow({
  active,
  cells,
  renderCell: RenderCell,
}: {
  active: boolean
  cells: Cell<typeof features, CatalogRow, unknown>[]
  renderCell: ReactTable<typeof features, CatalogRow>["FlexRender"]
}) {
  return (
    <tr
      data-active={active}
      className="group/hero-row grid grid-cols-2 items-start gap-x-4 gap-y-2 px-3 py-3 hover:bg-muted/35 data-[active=true]:bg-accent @min-[44rem]/hero-list:table-row @min-[44rem]/hero-list:h-16"
    >
      {cells.map((cell) => (
        <td
          key={cell.id}
          className={cn(
            "min-w-0 align-middle @min-[44rem]/hero-list:px-3 @min-[44rem]/hero-list:py-2",
            cell.column.id === "code" && "col-span-2",
            cell.column.id === "edited" && "@min-[44rem]/hero-list:text-right",
          )}
        >
          {cell.column.id !== "code" && (
            <span aria-hidden="true" className="type-meta mb-0.5 block @min-[44rem]/hero-list:hidden">
              {mobileColumnLabels[cell.column.id]}
            </span>
          )}
          <RenderCell cell={cell} />
        </td>
      ))}
    </tr>
  )
})

export function HeroGameplayChanges({
  hero,
  overview,
  locale,
  showPatchLabel,
  onOpen,
}: {
  hero: CatalogRow
  overview?: PublicationOverview
  locale: string
  showPatchLabel: boolean
  onOpen: (hero: CatalogRow, change: HeroGameplayChange) => void
}) {
  const [open, setOpen] = useState(false)
  const patchName = (change: HeroGameplayChange) =>
    overview?.variants.find((variant) => variant.id === change.patchVariantId)?.patchCode ?? "Patch đã ghi nhận"
  if (!hero.changes.length)
    return (
      <span className="text-xs text-muted-foreground" title="Chưa có lịch sử gameplay đã biên tập cho tướng này.">
        Chưa ghi lịch sử
      </span>
    )
  if (hero.changes.length === 1) {
    const change = hero.changes[0]
    return (
      <HeroChangeSummary
        overallKind={change.overallKind ?? null}
        summary={change.summary ?? "Mở chi tiết để xem thay đổi từng kỹ năng/chỉ số."}
        patchLabel={patchName(change)}
        showPatchLabel={showPatchLabel}
        actualLocale={change.actualLocale}
        locale={locale}
        onOpen={() => onOpen(hero, change)}
      />
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-left transition-colors hover:border-ring/50 hover:bg-accent hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring/50 data-[state=open]:bg-accent"
          aria-label={`Xem thay đổi gameplay của ${hero.code} tại ${hero.changes.length} patch`}
        >
          <span className="flex min-w-0 flex-col items-start gap-1">
            <ChangeKindBadges
              emptyLabel="Chưa đánh giá tổng thể"
              kinds={hero.changes.flatMap((change) => (change.overallKind ? [change.overallKind] : []))}
              compact
              maxVisible={6}
            />
            <span className="text-xs text-muted-foreground">{hero.changes.length} patch</span>
          </span>
          <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b p-4">
          <h3 className="font-semibold">Thay đổi gameplay trong phạm vi</h3>
          <p className="mt-1 text-xs text-muted-foreground">Xếp từ patch mới đến cũ.</p>
        </div>
        <ol className="max-h-[60dvh] divide-y overflow-y-auto">
          {hero.changes.map((change) => (
            <li key={change.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{patchName(change)}</span>
                <ChangeKindBadges
                  emptyLabel="Chưa đánh giá tổng thể"
                  kinds={change.overallKind ? [change.overallKind] : []}
                  compact
                  maxVisible={6}
                />
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {change.summary || "Đã ghi nhận thay đổi gameplay."}
              </p>
              {change.actualLocale && change.actualLocale !== locale && (
                <p className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {change.actualLocale}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                aria-label={`Xem thay đổi tại ${patchName(change)}`}
                onClick={() => {
                  setOpen(false)
                  onOpen(hero, change)
                }}
              >
                <ArrowUpRight className="size-4" />
                Xem bản đối chiếu
              </Button>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}

export function LastEdited({ value, locale }: { value?: string | null; locale: string }) {
  return (
    <LocalTime
      value={value}
      locale={locale}
      className="inline-flex max-w-full flex-wrap items-baseline gap-x-1 text-xs tabular-nums @min-[44rem]/hero-list:flex-col @min-[44rem]/hero-list:items-end"
      fallback={<span className="text-xs text-muted-foreground">Chưa ghi nhận</span>}
      label={(zone) => (
        <>
          <span className="font-medium">
            {formatInZone(value, zone, { day: "2-digit", month: "2-digit", year: "numeric" }, locale)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatInZone(value, zone, { timeStyle: "short" }, locale)}
          </span>
        </>
      )}
    />
  )
}

function useHeroPreview(hero: CatalogRow) {
  const r = hero.selectedRevision
  return useQuery({
    queryKey: publishingKeys.preview(hero.id, r?.id ?? ""),
    queryFn: () => api.read(hero.id, r!.id),
    enabled: !!r,
    staleTime: 30000,
  })
}

export function HeroHead({ hero, fallbackAssetId }: { hero: CatalogRow; fallbackAssetId?: string | null }) {
  const preview = useHeroPreview(hero)
  const assetId = preview.data?.content.MEDIA_BINDINGS?.bindings.HEAD ?? fallbackAssetId
  const [failed, setFailed] = useState(false)
  const asset = useQuery({
    queryKey: mediaKeys.assetView(assetId, "detail"),
    enabled: !!assetId,
    staleTime: 60000,
    queryFn: () => api.asset(assetId!),
  })
  const url = asset.data?.currentUrl
  useEffect(() => setFailed(false), [url])
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border/60">
      {url && !failed ? (
        <img src={url} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <UserRound aria-label="Chưa có ảnh head" className="size-5 text-muted-foreground" />
      )}
    </span>
  )
}

export function HeroText({ hero, locale, fallbackName }: { hero: CatalogRow; locale: string; fallbackName?: string }) {
  const query = useHeroPreview(hero)
  const translations = query.data?.content.PROFILE?.translations
  const text = pickTranslation(translations, locale)
  if (!hero.selectedRevision) return <span className="type-body">{fallbackName ?? hero.code}</span>
  if (query.error)
    return (
      <span className="text-xs text-destructive" title={errorMessage(query.error)}>
        {hero.code} · Chưa tải được tên
      </span>
    )
  return (
    <div>
      <p
        className="truncate text-sm leading-[18px] font-semibold underline-offset-4 group-hover/hero-action:underline group-focus-visible/hero-action:underline"
        title={text?.name ?? fallbackName}
      >
        {text?.name ?? fallbackName ?? (query.isPending ? "Đang tải…" : hero.code)}
      </p>
      {text && text.locale !== locale && <span className="text-xs text-muted-foreground">Dự phòng: {text.locale}</span>}
    </div>
  )
}

export function HeroTranslations({ hero }: { hero: CatalogRow }) {
  const query = useHeroPreview(hero)
  const canWrite = useSession().actor?.capabilities.includes("hero:write")
  if (!hero.selectedRevision) return "—"
  if (!query.data)
    return <span className="text-xs text-muted-foreground">{query.error ? "Chưa tải được" : "Đang tải…"}</span>
  const content = query.data.content
  const locales = [
    ...new Set([
      ...languageOptions.map((option) => option.value),
      ...(content.PROFILE?.translations.map((text) => text.locale) ?? []),
      ...(content.SKILLS?.skills.flatMap((skill) => skill.translations.map((text) => text.locale)) ?? []),
      ...(content.SKINS?.skins.flatMap((skin) => skin.translations.map((text) => text.locale)) ?? []),
    ]),
  ]
  const coverage = translationCoverage(content, locales)
  const complete = coverage.filter((c) => c.complete).length
  const partial = coverage.filter((c) => !c.complete && c.completed > 0).length
  const present = complete + partial
  const detail = `${present} ngôn ngữ có nội dung · ${complete} đầy đủ · ${partial} đang dịch`
  const target = coverage.find((item) => !item.completed)?.locale ?? "en-US"
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 text-xs tabular-nums transition-colors hover:border-ring/50 hover:bg-accent hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-ring/50 data-[state=open]:bg-accent"
              aria-label={`Bản dịch ${hero.code}: ${detail}`}
              title={detail}
            >
              <Languages className="size-3.5 text-muted-foreground" />
              <span className="font-semibold">{present}</span>
              <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <h3 className="font-medium">Tiến độ bản dịch</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Đếm các trường có trong bản dữ liệu này. Đủ nội dung chưa có nghĩa đã duyệt hoặc kiểm chứng nguồn.
            </p>
            <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
              {coverage.map((c) => (
                <Link
                  key={c.locale}
                  className="block rounded-lg p-2 text-sm hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                  to={`/hero/${hero.id}/translations?revision=${hero.selectedRevision!.id}&locale=${encodeURIComponent(c.locale)}`}
                >
                  <span className="flex justify-between gap-2">
                    <span>{languageOptions.find((o) => o.value === c.locale)?.label ?? c.locale}</span>
                    <span>
                      {c.completed}/{c.total}
                    </span>
                  </span>
                  <progress
                    className="mt-1 h-1.5 w-full accent-primary"
                    max={c.total}
                    value={c.completed}
                    aria-label={`Tiến độ ${c.locale}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {c.complete ? "Đủ nội dung" : c.completed ? "Đang dịch" : "Chưa dịch"}
                  </span>
                </Link>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {canWrite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer border-border/60 text-muted-foreground hover:border-ring/50 hover:text-foreground"
              >
                <Link
                  to={`/hero/${hero.id}/translations?revision=${hero.selectedRevision!.id}&locale=${encodeURIComponent(target)}`}
                  aria-label={`Thêm bản dịch ${hero.code}`}
                  title="Thêm bản dịch"
                >
                  <Plus className="size-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Thêm bản dịch</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
