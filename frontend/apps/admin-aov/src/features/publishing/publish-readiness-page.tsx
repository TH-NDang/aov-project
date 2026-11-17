import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ChevronRight, FilePenLine, UserRound } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { Page, PageHeader } from "@/components/page-header"
import { SearchField } from "@/components/search-field"
import { errorMessage } from "@/lib/api/errors"
import { HeroQuickView } from "./hero-catalog"
import {
  closeHeroLocation,
  heroFixLocation,
  heroLocationId,
  heroSourceLocation,
  openHeroLocation,
  patchHeroLocation,
} from "./hero-location"
import { usePublicationOverview, useContentLocale } from "./publication-overview"
import {
  filterReadinessRows,
  readinessFilter,
  readinessRows,
  readinessSummary,
  type DraftFilter,
  type ReadinessRow,
} from "./publish-readiness"
import type { PublishBlocker } from "./publish-rules"
import { createPublishingApi, publishReadinessKey } from "./publishing-api"
import {
  orderByCaptures,
  readinessCapturePatches,
  readinessSourceGaps,
  sourceGapSummary,
  sourceGapWeightLabels,
  type HeroSourceGaps,
  type SourceGap,
  type SourceGapWeight,
} from "./source-image-gaps"
import { useSourceCoverage } from "./use-source-coverage"

const api = createPublishingApi(backendRequest)
const noRows: ReadinessRow[] = []
const noGaps = new Map<string, HeroSourceGaps>()

export function PublishReadinessPage() {
  const [params, setParams] = useSearchParams()
  const locale = useContentLocale()
  const overview = usePublicationOverview()
  const heroes = useQuery({ queryKey: publishReadinessKey, queryFn: ({ signal }) => api.publishReadiness(signal) })
  const rows = useMemo(
    () => (heroes.data && overview.data ? readinessRows(heroes.data, overview.data, locale) : noRows),
    [heroes.data, overview.data, locale],
  )
  const filter = readinessFilter(params)
  const summary = useMemo(() => readinessSummary(rows), [rows])
  const patchesFor = useCallback((patches: string[]) => readinessCapturePatches(rows, patches), [rows])
  const coverage = useSourceCoverage(patchesFor)
  const captureSets = coverage.status === "ready" ? coverage : null
  const sourceGaps = useMemo(
    () => (captureSets ? readinessSourceGaps(rows, captureSets.patches, captureSets.heroes, locale) : noGaps),
    [rows, captureSets?.patches, captureSets?.heroes, locale],
  )
  const captureSummary = useMemo(() => sourceGapSummary(sourceGaps), [sourceGaps])
  const checkedAgainst = useMemo(
    () => (captureSets ? readinessCapturePatches(rows, captureSets.patches) : []),
    [rows, captureSets?.patches],
  )
  const byCaptures = filter.captures && !!captureSets
  const matching = useMemo(() => {
    const filtered = filterReadinessRows(rows, filter)
    return byCaptures ? orderByCaptures(filtered, sourceGaps) : filtered
  }, [rows, filter.q, filter.unpublished, filter.draft, byCaptures, sourceGaps])
  const revealed = useRevealedRows(matching, JSON.stringify(filter))
  const heroId = heroLocationId(params.get("hero"))
  const openedHero = heroes.data?.find((hero) => hero.id === heroId) ?? null
  const failure = heroes.error ?? overview.error
  const showRulesets = (overview.data?.rulesets.length ?? 0) > 1

  function update(patch: Record<string, string>) {
    setParams((current) => patchHeroLocation(current, patch), { replace: true, preventScrollReset: true })
  }
  function open(next: (current: URLSearchParams) => URLSearchParams) {
    setParams(next, { preventScrollReset: true })
  }
  const toggleDraft = (value: DraftFilter) => update({ draft: filter.draft === value ? "" : value })

  return (
    <Page className="@container min-w-0">
      <PageHeader
        title="Sẵn sàng xuất bản"
        search={
          <SearchField
            placement="header"
            label="Tìm tướng"
            placeholder="Tìm tên hoặc mã tướng…"
            shortcut
            value={filter.q}
            onChange={(q) => update({ q })}
          />
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/hero">
              <ArrowLeft className="size-4" /> Danh sách tướng
            </Link>
          </Button>
        }
      />
      <section className="@container/readiness admin-panel min-w-0 overflow-hidden">
        <div className="space-y-3 border-b border-border/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h2 className="type-section-title">Tình trạng xuất bản</h2>
              <span className="type-meta tabular-nums" role="status">
                {matching.length} / {summary.total} tướng
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo tình trạng xuất bản">
              <FilterToggle
                label="Chưa xuất bản"
                count={summary.unpublished}
                active={filter.unpublished}
                onToggle={() => update({ published: filter.unpublished ? "" : "false" })}
              />
              <FilterToggle
                label="Sẵn sàng xuất bản"
                count={summary.ready}
                active={filter.draft === "ready"}
                onToggle={() => toggleDraft("ready")}
              />
              <FilterToggle
                label="Còn thiếu"
                count={summary.blocked}
                active={filter.draft === "blocked"}
                onToggle={() => toggleDraft("blocked")}
              />
              {captureSets && (
                <FilterToggle
                  label="Cần chụp ảnh gốc"
                  count={captureSummary.heroes}
                  active={filter.captures}
                  onToggle={() => update({ captures: filter.captures ? "" : "missing" })}
                />
              )}
            </div>
          </div>
          <p className="type-meta">
            Cùng điều kiện với nút Xuất bản trong trang tướng. Máy chủ vẫn kiểm tra lại khi xuất bản.
            {rows.length > 0 &&
              ` ${summary.readyUnpublished} tướng chưa xuất bản đã có bản nháp sẵn sàng; ${summary.noDraft} không có bản nháp.`}
          </p>
          <CaptureOverview state={coverage} patches={checkedAgainst} summary={captureSummary} />
          {summary.blockers.length > 0 && (
            <div className="space-y-1">
              <h3 className="type-label">Thiếu nhiều nhất</h3>
              <ul className="type-body flex flex-col gap-0.5">
                {summary.blockers.map((blocker) => (
                  <li key={blocker.message} className="flex gap-2">
                    <span className="w-6 shrink-0 text-right font-semibold tabular-nums">{blocker.count}</span>
                    <span>{blocker.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {failure && !rows.length ? (
          <div role="alert" className="p-8 text-center">
            <p className="type-body text-destructive">{errorMessage(failure)}</p>
            <Button
              variant="ghost"
              onClick={() => {
                if (heroes.isError) void heroes.refetch()
                if (overview.isError) void overview.refetch()
              }}
            >
              Thử lại
            </Button>
          </div>
        ) : !heroes.data || !overview.data ? (
          <p role="status" className="type-meta p-8 text-center">
            Đang tải tình trạng xuất bản…
          </p>
        ) : (
          <>
            <div
              className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              role="region"
              aria-label="Tình trạng xuất bản từng tướng"
              tabIndex={0}
            >
              <table className="block w-full @min-[44rem]/readiness:table @min-[44rem]/readiness:table-fixed">
                <caption className="sr-only">
                  Từng tướng với bản đã xuất bản, bản nháp đang mở và những gì còn thiếu. Chọn một mục còn thiếu để mở
                  đúng phần cần sửa.
                </caption>
                <colgroup className="hidden @min-[44rem]/readiness:table-column-group">
                  {(captureSets
                    ? ["w-[18%]", "w-[13%]", "w-[13%]", "w-[24%]", "w-[32%]"]
                    : ["w-[24%]", "w-[20%]", "w-[20%]", "w-[36%]"]
                  ).map((width, index) => (
                    <col key={index} className={width} />
                  ))}
                </colgroup>
                <thead className="sr-only bg-muted @min-[44rem]/readiness:not-sr-only @min-[44rem]/readiness:table-header-group">
                  <tr>
                    {[
                      "Tướng",
                      "Đã xuất bản",
                      "Bản nháp",
                      "Còn thiếu để xuất bản",
                      ...(captureSets ? ["Ảnh gốc cần chụp"] : []),
                    ].map((title) => (
                      <th key={title} scope="col" className="type-label h-10 px-3 py-2 text-left text-muted-foreground">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="block divide-y divide-border/60 @min-[44rem]/readiness:table-row-group">
                  {revealed.rows.map((row) => (
                    <ReadinessTableRow
                      key={row.rowKey}
                      row={row}
                      active={row.heroId === heroId}
                      ruleset={
                        showRulesets
                          ? overview.data.rulesets.find((rule) => rule.id === row.rulesetId)?.code
                          : undefined
                      }
                      onOpen={(revisionId) => open((current) => openHeroLocation(current, row.heroId, revisionId))}
                      onFix={(blocker) =>
                        open((current) => heroFixLocation(current, row.heroId, row.draft!.id, blocker.key))
                      }
                      captures={
                        captureSets ? { sources: sourceGaps.get(row.rowKey), pending: captureSets.pending } : undefined
                      }
                      onOpenGap={(gap) =>
                        open((current) =>
                          heroSourceLocation(current, row.heroId, row.draft?.id ?? row.published?.id, gap),
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!matching.length && (
              <div className="grid justify-items-center gap-2 p-12 text-center">
                <p className="type-body text-muted-foreground">Không có tướng phù hợp với tìm kiếm và bộ lọc.</p>
                <Button variant="outline" onClick={() => update({ q: "", published: "", draft: "", captures: "" })}>
                  Xóa bộ lọc
                </Button>
              </div>
            )}
            <div className="flex justify-center px-3 py-3" aria-live="polite">
              {revealed.loader.hasNextPage ? (
                <InfiniteScroll query={revealed.loader} label="Đang hiện thêm tướng…" />
              ) : matching.length > 0 ? (
                <span className="type-meta">Đã hiện tất cả kết quả</span>
              ) : null}
            </div>
          </>
        )}
      </section>
      <HeroQuickView
        heroId={heroId}
        hero={openedHero}
        ruleset=""
        onClose={() => setParams((current) => closeHeroLocation(current), { replace: true, preventScrollReset: true })}
      />
    </Page>
  )
}

function FilterToggle({
  label,
  count,
  active,
  onToggle,
}: {
  label: string
  count: number
  active: boolean
  onToggle: () => void
}) {
  return (
    <Button type="button" size="sm" variant={active ? "secondary" : "outline"} aria-pressed={active} onClick={onToggle}>
      {label}
      <span className="type-label tabular-nums">{count}</span>
    </Button>
  )
}

const columnLabels = ["Đã xuất bản", "Bản nháp", "Còn thiếu", "Ảnh gốc cần chụp"]
const cellClass = "min-w-0 align-top @min-[44rem]/readiness:px-3 @min-[44rem]/readiness:py-2"

function ReadinessTableRow({
  row,
  active,
  ruleset,
  onOpen,
  onFix,
  captures,
  onOpenGap,
}: {
  row: ReadinessRow
  active: boolean
  ruleset?: string
  onOpen: (revisionId?: string) => void
  onFix: (blocker: PublishBlocker) => void
  /** Absent where the capture sets cannot be read. */
  captures?: { sources?: HeroSourceGaps; pending: boolean }
  onOpenGap: (gap: SourceGap) => void
}) {
  return (
    <tr
      data-active={active}
      className="group/hero-row grid grid-cols-2 items-start gap-x-4 gap-y-2 px-3 py-3 hover:bg-muted/35 data-[active=true]:bg-accent @min-[44rem]/readiness:table-row"
    >
      <td className={cn(cellClass, "col-span-2")}>
        <button
          type="button"
          className="group/hero-action flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md py-1 text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={`Xem tướng ${row.code}`}
          onClick={() => onOpen(row.draft?.id ?? row.published?.id)}
        >
          <ReadinessHead url={row.headUrl} />
          <span className="min-w-0 flex-1">
            <span className="type-body block truncate underline-offset-4 group-hover/hero-action:underline">
              {row.name}
            </span>
            <span className="type-meta block truncate">
              {row.code}
              {ruleset && ` · ${ruleset}`}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
        </button>
      </td>
      <td className={cellClass}>
        <ColumnLabel index={0} />
        {row.published ? (
          <RevisionState
            tone="published"
            label="Đã xuất bản"
            detail={`${row.publishedPatch?.patchCode ?? "Chưa rõ patch"} · #${row.published.revisionNo}`}
          />
        ) : (
          <span className="type-meta">Chưa xuất bản</span>
        )}
      </td>
      <td className={cellClass}>
        <ColumnLabel index={1} />
        {row.draft ? (
          <RevisionState
            tone="draft"
            label="Bản nháp"
            detail={`${row.draftPatch?.patchCode ?? "Chưa gắn patch"} · #${row.draft.revisionNo}`}
          />
        ) : (
          <span className="type-meta">{row.revisions.length ? "Không có bản nháp" : "Chưa có phiên bản"}</span>
        )}
      </td>
      <td className={cn(cellClass, "col-span-2 @min-[44rem]/readiness:col-auto")}>
        <ColumnLabel index={2} />
        {row.status === "READY" ? (
          <div className="flex flex-wrap items-center gap-2">
            <RevisionState tone="published" label="Sẵn sàng xuất bản" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Mở bản nháp ${row.code}`}
              onClick={() => onOpen(row.draft!.id)}
            >
              <FilePenLine aria-hidden className="size-3.5" /> Mở bản nháp
            </Button>
          </div>
        ) : row.status === "BLOCKED" ? (
          <ul className="space-y-1">
            {row.blockers.map((blocker) => (
              <li key={blocker.message}>
                <BlockerAction row={row} blocker={blocker} onFix={onFix} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="type-meta">Không có gì chờ xuất bản</span>
        )}
      </td>
      {captures && (
        <td className={cn(cellClass, "col-span-2 @min-[44rem]/readiness:col-auto")}>
          <ColumnLabel index={3} />
          {captures.sources ? (
            <SourceGapCell sources={captures.sources} onOpen={onOpenGap} />
          ) : (
            <span className="type-meta">
              {!row.draft && !row.published
                ? "Chưa có phiên bản để đối chiếu"
                : captures.pending
                  ? "Đang đọc bộ ảnh gốc…"
                  : "Không có bộ ảnh gốc"}
            </span>
          )}
        </td>
      )}
    </tr>
  )
}

function ColumnLabel({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className="type-meta mb-0.5 block @min-[44rem]/readiness:hidden">
      {columnLabels[index]}
    </span>
  )
}

function RevisionState({ tone, label, detail }: { tone: "published" | "draft"; label: string; detail?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <Badge
        variant="outline"
        className={cn(
          "gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
          tone === "draft"
            ? "border-(--aov-warning)/20 bg-(--aov-warning-soft) text-(--aov-warning)"
            : "border-(--aov-success)/20 bg-(--aov-success-soft) text-(--aov-success)",
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {label}
      </Badge>
      {detail && (
        <p className="type-meta truncate tabular-nums" title={detail}>
          {detail}
        </p>
      )}
    </div>
  )
}

function BlockerAction({
  row,
  blocker,
  onFix,
}: {
  row: ReadinessRow
  blocker: PublishBlocker
  onFix: (blocker: PublishBlocker) => void
}) {
  const className =
    "type-body flex w-full cursor-pointer gap-2 rounded-md text-left underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  const content = (
    <>
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-(--aov-warning)" />
      {blocker.message}
    </>
  )
  return blocker.key === "PATCH" && row.patchLink ? (
    <Link className={className} to={row.patchLink.to}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} onClick={() => onFix(blocker)}>
      {content}
    </button>
  )
}

function ReadinessHead({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
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

function CaptureOverview({
  state,
  patches,
  summary,
}: {
  state: ReturnType<typeof useSourceCoverage>
  patches: string[]
  summary: ReturnType<typeof sourceGapSummary>
}) {
  if (state.status === "unavailable" || state.status === "loading") return null
  if (state.status === "error")
    return (
      <p role="alert" className="type-meta text-destructive">
        {state.message}
      </p>
    )
  return (
    <div className="space-y-1">
      <h3 className="type-label">Ảnh gốc cần chụp</h3>
      <p className="type-meta">
        {patches.length
          ? `Đối chiếu với bộ ảnh patch ${patches.join(", ")}. Trang tự đọc lại khi có ảnh hoặc bản rà soát mới.`
          : "Chưa có bộ ảnh gốc nào trong thư mục resources."}
      </p>
      {summary.groups.length > 0 && (
        <ul className="type-body flex flex-col gap-0.5">
          {summary.groups.map((item) => (
            <li key={item.group} className="flex gap-2">
              <span className="w-6 shrink-0 text-right font-semibold tabular-nums">{item.count}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const weightTone: Record<SourceGapWeight, string> = {
  UNBLOCKS: "border-(--aov-success)/20 bg-(--aov-success-soft) text-(--aov-success)",
  MISSING_DATA: "border-(--aov-warning)/20 bg-(--aov-warning-soft) text-(--aov-warning)",
  UNCHECKED: "border-border bg-muted text-muted-foreground",
  MINOR: "border-border bg-muted text-muted-foreground",
}

function SourceGapCell({ sources, onOpen }: { sources: HeroSourceGaps; onOpen: (gap: SourceGap) => void }) {
  if (sources.group === "COMPLETE") return <span className="type-meta">Đủ ảnh để đối chiếu</span>
  const main = sources.gaps.filter((gap) => gap.weight !== "MINOR")
  const minor = sources.gaps.filter((gap) => gap.weight === "MINOR")
  const list = (gaps: SourceGap[]) => (
    <ul className="space-y-2">
      {gaps.map((gap) => (
        <li key={gap.key}>
          <SourceGapItem gap={gap} onOpen={() => onOpen(gap)} />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="space-y-2">
      {sources.revisionPatch && (
        <p className="type-meta">
          Bản đang xem ở patch {sources.revisionPatch}, chưa có bộ ảnh riêng; đối chiếu với bộ {sources.patchCode}.
        </p>
      )}
      {main.length > 0 && list(main)}
      {minor.length > 0 &&
        (main.length ? (
          <details className="group/minor">
            <summary className="type-meta cursor-pointer underline-offset-4 hover:underline">
              {minor.length} mục nên xem lại
            </summary>
            <div className="pt-2">{list(minor)}</div>
          </details>
        ) : (
          list(minor)
        ))}
    </div>
  )
}

function SourceGapItem({ gap, onOpen }: { gap: SourceGap; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="group/gap flex w-full cursor-pointer gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      title={gap.files.length ? `Ảnh hiện có: ${gap.files.join(", ")}` : undefined}
      onClick={onOpen}
    >
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="type-body">
            <span className="font-semibold underline-offset-4 group-hover/gap:text-primary group-hover/gap:underline">
              {gap.title}
            </span>
          </span>
          <Badge variant="outline" className={cn("rounded-md px-1.5 py-0 text-xs font-medium", weightTone[gap.weight])}>
            {sourceGapWeightLabels[gap.weight]}
          </Badge>
        </span>
        <span className="type-body block">{gap.capture}</span>
        <span className="type-meta block">
          {gap.problem} {gap.data} {gap.checks}
        </span>
      </span>
    </button>
  )
}
