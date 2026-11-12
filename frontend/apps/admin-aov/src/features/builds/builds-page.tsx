import { useMemo, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { BadgeCheck, FileUp, Flag, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { LocalTime } from "@aov/ui/components/local-time"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { cn } from "@aov/ui/lib/utils"
import { useSession } from "@/app/auth/auth-gate"
import { confirmAction } from "@/components/confirm-dialog"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { SearchField } from "@/components/search-field"
import { errorMessage } from "@/lib/api/errors"
import type { BuildHero, CaptureSummary } from "./builds-api"
import { RESULT_LABELS, heroRows, nextHeroToReview, openBuilds, sameAs, type HeroView } from "./builds-model"
import { BuildCard } from "./build-card"
import { useBuildReferences } from "./build-references"
import { ImportDialog } from "./import-dialog"
import { useBuildCapture, useBuildCaptures, useCaptureActions, useHeroHeads } from "./use-builds"

const captureLabel = (capture: CaptureSummary) => (
  <>
    <LocalTime
      value={capture.capturedAt}
      sourceTimeZone={capture.sourceTimeZone}
      format={{ dateStyle: "short", timeStyle: "short" }}
    />{" "}
    · {capture.sourceLabel} · {capture.regionCode}
  </>
)

function HeroFace({ hero, heads, className }: { hero: BuildHero; heads?: Map<string, string>; className?: string }) {
  const url = hero.heroCode ? heads?.get(hero.heroCode) : undefined
  return url ? (
    <img src={url} alt="" className={cn("size-8 shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted type-label",
        className,
      )}
    >
      {hero.nameOnScreen.slice(0, 1)}
    </span>
  )
}

/**
 * The game's recommended builds per hero as captured on a given day (ADR-026): the heroes on the left, the chosen hero's
 * builds on the right, each next to the part of the screenshot it was read from.
 */
export function BuildsPage() {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<HeroView>({ query: "", reviewOnly: false })
  const [importing, setImporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("hero:write")
  const canPublish = capabilities.includes("hero:publish")

  const captures = useBuildCaptures()
  const list = useMemo(() => captures.data?.items ?? [], [captures.data])
  const selectedId = params.get("capture") ?? list[0]?.id ?? null
  const selected = list.find((capture) => capture.id === selectedId) ?? null
  const detail = useBuildCapture(selectedId)
  const heads = useHeroHeads()
  const references = useBuildReferences()
  const actions = useCaptureActions()

  const rows = useMemo(() => (detail.data ? heroRows(detail.data, view) : []), [detail.data, view])
  const flaggedHeroes = detail.data ? detail.data.heroes.filter((hero) => openBuilds(hero) > 0).length : 0
  const heroId = params.get("hero")
  const hero =
    detail.data?.heroes.find((entry) => entry.heroId === heroId) ??
    detail.data?.heroes.find((entry) => openBuilds(entry) > 0) ??
    detail.data?.heroes[0] ??
    null
  const next = detail.data && hero ? nextHeroToReview(detail.data, hero.heroId) : null
  const duplicates = useMemo(() => (hero ? sameAs(hero.builds) : new Map<string, number>()), [hero])

  const choose = (key: "capture" | "hero", value: string | null) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        if (value) updated.set(key, value)
        else updated.delete(key)
        if (key === "capture") updated.delete("hero")
        return updated
      },
      { replace: true },
    )
  const confirmCapture = () => {
    if (!selected) return
    setActionError(null)
    actions.confirm.mutate(selected, { onError: (error) => setActionError(errorMessage(error)) })
  }
  const deleteCapture = async () => {
    if (!selected) return
    const accepted = await confirmAction({
      title: "Xóa lần chụp này?",
      description: `Mọi bộ, ghi chú duyệt và liên kết ảnh dẫn chứng của lần chụp ${selected.code} sẽ bị xóa. Ảnh gốc trong resources vẫn giữ nguyên.`,
      confirmLabel: "Xóa lần chụp",
    })
    if (!accepted) return
    setActionError(null)
    actions.remove.mutate(selected, {
      onSuccess: () => choose("capture", null),
      onError: (error) => setActionError(errorMessage(error)),
    })
  }

  return (
    <Page>
      <PageHeader
        title="Build đề cử"
        description="Bộ đồ game đề cử cho từng tướng, đọc từ ảnh màn Chuẩn bị. Bộ chờ duyệt có ô chưa nhận ra."
        search={
          <SearchField
            placement="header"
            label="Tìm tướng"
            placeholder="Tìm tướng…"
            value={view.query}
            onChange={(query) => setView((current) => ({ ...current, query }))}
          />
        }
        actions={
          <>
            <Button type="button" variant="outline" disabled={!canWrite} onClick={() => setImporting(true)}>
              <FileUp className="size-4" /> Nhập lần chụp
            </Button>
            {selected && (
              <PageActionsMenu label="Thao tác với lần chụp">
                <DropdownMenuItem variant="destructive" disabled={!canWrite} onSelect={deleteCapture}>
                  <Trash2 className="size-4" /> Xóa lần chụp
                </DropdownMenuItem>
              </PageActionsMenu>
            )}
          </>
        }
      />

      {captures.isError ? (
        <p className="type-body text-destructive">{errorMessage(captures.error)}</p>
      ) : captures.isPending ? (
        <p className="type-body text-muted-foreground">Đang tải lần chụp…</p>
      ) : !selected ? (
        <div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="type-body text-muted-foreground">
            Chưa có lần chụp build nào. Nhập bộ ảnh đã đọc từ resources/extracted/builds.
          </p>
          <Button type="button" disabled={!canWrite} onClick={() => setImporting(true)}>
            <FileUp className="size-4" /> Nhập lần chụp
          </Button>
        </div>
      ) : (
        <>
          <section className="flex flex-wrap items-end gap-x-6 gap-y-3" aria-label="Lần chụp">
            <div className="grid gap-1">
              <span className="type-label text-muted-foreground">Lần chụp</span>
              <Select value={selected.id} onValueChange={(value) => choose("capture", value)}>
                <SelectTrigger className="w-[min(100%,26rem)]" aria-label="Lần chụp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {list.map((capture) => (
                    <SelectItem key={capture.id} value={capture.id}>
                      {captureLabel(capture)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {selected.confirmedAt ? (
                <span className="inline-flex items-center gap-1.5 type-body text-[var(--aov-success)]">
                  <BadgeCheck className="size-4" /> Đã xác nhận, đang hiện trên Wiki từ{" "}
                  <LocalTime value={selected.confirmedAt} format={{ dateStyle: "short" }} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 type-body text-[var(--aov-warning)]">
                  <Flag className="size-4" />
                  {selected.needsReviewCount
                    ? `${selected.needsReviewCount} bộ chờ duyệt`
                    : "Đã duyệt hết, chờ xác nhận"}
                </span>
              )}
              {!selected.confirmedAt && (
                <Button
                  type="button"
                  disabled={!canPublish || selected.needsReviewCount > 0 || actions.confirm.isPending}
                  title={
                    !canPublish
                      ? "Cần quyền xuất bản tướng"
                      : selected.needsReviewCount
                        ? "Duyệt hết các bộ chờ duyệt trước"
                        : undefined
                  }
                  onClick={confirmCapture}
                >
                  <BadgeCheck className="size-4" /> Xác nhận lần chụp
                </Button>
              )}
            </div>
          </section>
          {actionError && <p className="type-body text-destructive">{actionError}</p>}

          {detail.data && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
              <Meta label="Chụp lúc">
                <LocalTime value={detail.data.capturedAt} sourceTimeZone={detail.data.sourceTimeZone} />
              </Meta>
              <Meta label="Nguồn">{detail.data.sourceLabel}</Meta>
              <Meta label="Máy chủ">{detail.data.regionCode === "VN" ? "Việt Nam" : detail.data.regionCode}</Meta>
              <Meta label="Bản cập nhật">{detail.data.patchCode ?? "Chưa biết"}</Meta>
              <Meta label="Số lượng">
                {detail.data.heroCount} tướng · {detail.data.buildCount} bộ
              </Meta>
              {detail.data.sourceNote && <p className="col-span-full type-meta">{detail.data.sourceNote}</p>}
            </dl>
          )}

          {detail.isError ? (
            <p className="type-body text-destructive">{errorMessage(detail.error)}</p>
          ) : !detail.data ? (
            <p className="type-body text-muted-foreground">Đang tải lần chụp…</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
              <nav aria-label="Tướng trong lần chụp" className="grid content-start gap-2">
                <FilterTabs label="Lọc tướng">
                  <FilterTab
                    active={!view.reviewOnly}
                    count={detail.data.heroes.length}
                    onClick={() => setView((current) => ({ ...current, reviewOnly: false }))}
                  >
                    Tất cả
                  </FilterTab>
                  <FilterTab
                    active={view.reviewOnly}
                    count={flaggedHeroes}
                    onClick={() => setView((current) => ({ ...current, reviewOnly: true }))}
                  >
                    <Flag /> Chờ duyệt
                  </FilterTab>
                </FilterTabs>
                <ul className="hidden max-h-[70svh] overflow-y-auto rounded-lg border lg:block">
                  {rows.map((entry) => {
                    const open = openBuilds(entry)
                    const current = entry.heroId === hero?.heroId
                    return (
                      <li key={entry.heroId}>
                        <button
                          type="button"
                          aria-current={current || undefined}
                          className={cn(
                            "flex w-full items-center gap-2 px-2.5 py-1.5 text-left type-body hover:bg-muted",
                            current && "bg-muted",
                          )}
                          onClick={() => choose("hero", entry.heroId)}
                        >
                          <HeroFace hero={entry} heads={heads.data} />
                          <span className="min-w-0 flex-1 truncate">{entry.nameOnScreen}</span>
                          {open > 0 && (
                            <span className="inline-flex items-center gap-0.5 type-meta text-[var(--aov-warning)]">
                              <Flag className="size-3.5" />
                              {open}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                  {!rows.length && <li className="px-2.5 py-2 type-body text-muted-foreground">Không có tướng nào.</li>}
                </ul>
                <Select value={hero?.heroId ?? ""} onValueChange={(value) => choose("hero", value)}>
                  <SelectTrigger className="lg:hidden" aria-label="Tướng">
                    <SelectValue placeholder="Chọn tướng" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((entry) => (
                      <SelectItem key={entry.heroId} value={entry.heroId}>
                        {entry.nameOnScreen}
                        {openBuilds(entry) ? ` · ${openBuilds(entry)} chờ duyệt` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </nav>

              {hero && (
                <section className="grid content-start gap-3" aria-labelledby="build-hero-title">
                  <header className="flex flex-wrap items-center gap-3">
                    <HeroFace hero={hero} heads={heads.data} className="size-10" />
                    <div className="min-w-0">
                      <h2 id="build-hero-title" className="type-section-title">
                        {hero.nameOnScreen}
                      </h2>
                      <p className="type-meta">
                        {RESULT_LABELS[hero.result]} · {hero.builds.length} bộ · thứ tự chụp {hero.captureOrder}
                      </p>
                    </div>
                    {next && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={() => choose("hero", next.heroId)}
                      >
                        <Flag className="size-4" /> Tướng chờ duyệt tiếp theo: {next.nameOnScreen}
                      </Button>
                    )}
                  </header>
                  {[...hero.builds]
                    .sort((a, b) => a.position - b.position)
                    .map((build) => (
                      <BuildCard
                        key={build.id}
                        captureId={detail.data!.id}
                        build={build}
                        sameAs={duplicates.get(build.id)}
                        references={references}
                        canWrite={canWrite}
                      />
                    ))}
                </section>
              )}
            </div>
          )}
        </>
      )}

      <ImportDialog
        open={importing}
        captures={list}
        onOpenChange={setImporting}
        onImported={(id) => choose("capture", id)}
      />
    </Page>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="type-meta">{label}</dt>
      <dd className="type-body">{children}</dd>
    </div>
  )
}
