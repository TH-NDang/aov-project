import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { BadgeCheck, FileUp, Flag, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { LocalTime } from "@aov/ui/components/local-time"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Switch } from "@aov/ui/components/switch"
import { useSession } from "@/app/auth/auth-gate"
import { confirmAction } from "@/components/confirm-dialog"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { SearchField } from "@/components/search-field"
import { errorMessage } from "@/lib/api/errors"
import { ImportDialog } from "./import-dialog"
import type { RankingMetric, RankingRole, RankingSummary } from "./ranking-api"
import {
  DEFAULT_VIEW,
  ROLE_LABELS,
  ROLE_ORDER,
  defaultDescending,
  droppedHeroes,
  needsReview,
  nextToReview,
  rankingRows,
  roleCounts,
  viewRows,
  type RankingView,
  type SortKey,
} from "./ranking-model"
import { RankingTable } from "./ranking-table"
import { useHeroHeads, useRankingDetail, useRankingSnapshots, useSnapshotActions } from "./use-ranking"
import { ValuePanel, type OpenValue } from "./value-panel"

const NONE = "none"

function parseOpenValue(text: string | null): OpenValue | null {
  const match = text && /^([0-9a-f-]{36}):([A-Z_0-9]+)$/.exec(text)
  return match ? { heroId: match[1]!, metric: match[2] as RankingMetric } : null
}

const snapshotLabel = (snapshot: RankingSummary) => (
  <>
    <LocalTime
      value={snapshot.capturedAt}
      sourceTimeZone={snapshot.sourceTimeZone}
      format={{ dateStyle: "short", timeStyle: "short" }}
    />{" "}
    · {snapshot.modeLabel} · {snapshot.regionCode}
  </>
)

/**
 * The game's hero ranking boards as captured on a given day: one table of every hero, each number tied to the
 * screenshot it was read from, values waiting for review flagged, and a second capture to compare against.
 */
export function RankingPage() {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<RankingView>(DEFAULT_VIEW)
  const [importing, setImporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const canWrite = useSession().actor?.capabilities.includes("hero:write") ?? false

  const snapshots = useRankingSnapshots()
  const list = useMemo(() => snapshots.data?.items ?? [], [snapshots.data])
  const selectedId = params.get("snapshot") ?? list[0]?.id ?? null
  const selected = list.find((snapshot) => snapshot.id === selectedId) ?? null
  const comparable = list.filter(
    (snapshot) =>
      snapshot.id !== selectedId &&
      snapshot.modeCode === selected?.modeCode &&
      snapshot.regionCode === selected?.regionCode,
  )
  const compareId = comparable.some((snapshot) => snapshot.id === params.get("compare")) ? params.get("compare") : null
  const detail = useRankingDetail(selectedId)
  const compare = useRankingDetail(compareId)
  const heads = useHeroHeads()
  const actions = useSnapshotActions()

  const rows = useMemo(
    () => (detail.data ? rankingRows(detail.data, compare.data ?? null) : []),
    [detail.data, compare.data],
  )
  const shown = useMemo(() => viewRows(rows, view), [rows, view])
  const counts = useMemo(() => roleCounts(rows), [rows])
  const flaggedRows = rows.filter(needsReview).length
  // The open value lives in the address, so a link can point a reviewer straight at it.
  const openText = params.get("value")
  const open = useMemo(() => parseOpenValue(openText), [openText])
  const nextOpen = useMemo(() => (detail.data ? nextToReview(detail.data, open) : null), [detail.data, open])
  const dropped = detail.data ? droppedHeroes(detail.data, compare.data) : []

  const setOpen = (value: OpenValue | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set("value", `${value.heroId}:${value.metric}`)
        else next.delete("value")
        return next
      },
      { replace: true },
    )
  const choose = (key: "snapshot" | "compare", value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key === "snapshot") {
          next.delete("compare")
          next.delete("value")
        }
        return next
      },
      { replace: true },
    )
  const sort = (key: SortKey) =>
    setView((current) =>
      current.sort === key
        ? { ...current, descending: !current.descending }
        : { ...current, sort: key, descending: defaultDescending(key) },
    )
  const confirmSnapshot = async () => {
    if (!selected) return
    setActionError(null)
    actions.confirm.mutate(selected, { onError: (error) => setActionError(errorMessage(error)) })
  }
  const deleteSnapshot = async () => {
    if (!selected) return
    const accepted = await confirmAction({
      title: "Xóa bản chụp này?",
      description: `Mọi giá trị, ghi chú duyệt và liên kết ảnh dẫn chứng của bản chụp ${selected.code} sẽ bị xóa. Ảnh gốc trong resources vẫn giữ nguyên.`,
      confirmLabel: "Xóa bản chụp",
    })
    if (!accepted) return
    setActionError(null)
    actions.remove.mutate(selected, {
      onSuccess: () => choose("snapshot", null),
      onError: (error) => setActionError(errorMessage(error)),
    })
  }

  const scope = `${selectedId}:${compareId}:${view.role}:${view.reviewOnly}:${view.query}:${view.sort}:${view.descending}:${view.byChange}`

  return (
    <Page>
      <PageHeader
        title="Thống kê đấu hạng"
        description="Bảng Phân Bậc Tướng trong game, đọc từ ảnh chụp. Bấm vào một số để xem ảnh dẫn chứng và duyệt."
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
              <FileUp className="size-4" /> Nhập bản chụp
            </Button>
            {selected && (
              <PageActionsMenu label="Thao tác với bản chụp">
                <DropdownMenuItem variant="destructive" disabled={!canWrite} onSelect={deleteSnapshot}>
                  <Trash2 className="size-4" /> Xóa bản chụp
                </DropdownMenuItem>
              </PageActionsMenu>
            )}
          </>
        }
      />

      {snapshots.isError ? (
        <p className="type-body text-destructive">{errorMessage(snapshots.error)}</p>
      ) : snapshots.isPending ? (
        <p className="type-body text-muted-foreground">Đang tải bản chụp…</p>
      ) : !selected ? (
        <div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="type-body text-muted-foreground">
            Chưa có bản chụp thống kê nào. Nhập bộ ảnh đã đọc từ resources/extracted/ranking.
          </p>
          <Button type="button" disabled={!canWrite} onClick={() => setImporting(true)}>
            <FileUp className="size-4" /> Nhập bản chụp
          </Button>
        </div>
      ) : (
        <>
          <section className="flex flex-wrap items-end gap-x-6 gap-y-3" aria-label="Bản chụp">
            <div className="grid gap-1">
              <span className="type-label text-muted-foreground">Bản chụp</span>
              <Select value={selected.id} onValueChange={(value) => choose("snapshot", value)}>
                <SelectTrigger className="w-[min(100%,26rem)]" aria-label="Bản chụp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {list.map((snapshot) => (
                    <SelectItem key={snapshot.id} value={snapshot.id}>
                      {snapshotLabel(snapshot)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <span className="type-label text-muted-foreground">So sánh với</span>
              <Select
                value={compareId ?? NONE}
                onValueChange={(value) => choose("compare", value === NONE ? null : value)}
              >
                <SelectTrigger className="w-[min(100%,20rem)]" aria-label="So sánh với" disabled={!comparable.length}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {comparable.length ? "Không so sánh" : "Chưa có bản chụp khác cùng chế độ"}
                  </SelectItem>
                  {comparable.map((snapshot) => (
                    <SelectItem key={snapshot.id} value={snapshot.id}>
                      {snapshotLabel(snapshot)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {selected.confirmedAt ? (
                <span className="inline-flex items-center gap-1.5 type-body text-[var(--aov-success)]">
                  <BadgeCheck className="size-4" /> Đã xác nhận{" "}
                  <LocalTime value={selected.confirmedAt} format={{ dateStyle: "short" }} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 type-body text-[var(--aov-warning)]">
                  <Flag className="size-4" />
                  {selected.needsReviewCount
                    ? `${selected.needsReviewCount} giá trị chờ duyệt`
                    : "Đã duyệt hết, chờ xác nhận"}
                </span>
              )}
              {!selected.confirmedAt && (
                <Button
                  type="button"
                  disabled={!canWrite || selected.needsReviewCount > 0 || actions.confirm.isPending}
                  title={selected.needsReviewCount ? "Duyệt hết các giá trị chờ duyệt trước" : undefined}
                  onClick={confirmSnapshot}
                >
                  <BadgeCheck className="size-4" /> Xác nhận bản chụp
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
              <Meta label="Chế độ">{detail.data.modeLabel}</Meta>
              <Meta label="Máy chủ">{detail.data.regionCode === "VN" ? "Việt Nam" : detail.data.regionCode}</Meta>
              <Meta label="Khoảng thời gian">{detail.data.periodLabel ?? "Game không ghi"}</Meta>
              <Meta label="Nguồn">
                {detail.data.images.length} ảnh · {detail.data.heroCount} tướng
              </Meta>
              {detail.data.sourceNote && (
                <p className="col-span-full type-meta text-muted-foreground">{detail.data.sourceNote}</p>
              )}
            </dl>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <FilterTabs label="Vai trò trên game">
              <FilterTab
                active={view.role === "ALL"}
                count={counts.ALL}
                onClick={() => setView((current) => ({ ...current, role: "ALL" }))}
              >
                Tất cả
              </FilterTab>
              {ROLE_ORDER.map((role: RankingRole) => (
                <FilterTab
                  key={role}
                  active={view.role === role}
                  count={counts[role]}
                  onClick={() => setView((current) => ({ ...current, role }))}
                >
                  {ROLE_LABELS[role]}
                </FilterTab>
              ))}
            </FilterTabs>
            <FilterTabs label="Trạng thái duyệt">
              <FilterTab
                active={view.reviewOnly}
                count={flaggedRows}
                onClick={() => setView((current) => ({ ...current, reviewOnly: !current.reviewOnly }))}
              >
                <Flag /> Tướng có giá trị chờ duyệt
              </FilterTab>
            </FilterTabs>
            {compareId && (
              <label className="flex items-center gap-2 pb-1 type-body">
                <Switch
                  checked={view.byChange}
                  onCheckedChange={(byChange) => setView((current) => ({ ...current, byChange }))}
                />
                Sắp theo mức thay đổi
              </label>
            )}
          </div>

          {detail.isError ? (
            <p className="type-body text-destructive">{errorMessage(detail.error)}</p>
          ) : !detail.data ? (
            <p className="type-body text-muted-foreground">Đang tải bản chụp…</p>
          ) : (
            <>
              <RankingTable
                detail={detail.data}
                rows={shown}
                view={view}
                heads={heads.data}
                open={open}
                scope={scope}
                onSort={sort}
                onOpen={setOpen}
              />
              {dropped.length > 0 && (
                <p className="type-meta text-muted-foreground">
                  Có ở bản so sánh nhưng không có ở bản này: {dropped.map((hero) => hero.nameOnScreen).join(", ")}.
                </p>
              )}
              <ValuePanel
                detail={detail.data}
                open={open}
                heads={heads.data}
                canWrite={canWrite}
                nextOpen={nextOpen}
                onOpen={setOpen}
                onClose={() => setOpen(null)}
              />
            </>
          )}
        </>
      )}

      <ImportDialog
        open={importing}
        snapshots={list}
        onOpenChange={setImporting}
        onImported={(id) => choose("snapshot", id)}
      />
    </Page>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className="type-body">{children}</dd>
    </div>
  )
}
