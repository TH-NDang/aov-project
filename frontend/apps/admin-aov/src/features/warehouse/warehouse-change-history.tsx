import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, History, PenLine, Save } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { ActionStrip } from "@/components/action-strip"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { control } from "../publishing/fields"
import { usePublicationOverview } from "../publishing/publication-overview"
import {
  CatalogChangeBadges,
  catalogChangeKinds,
  useCatalogChanges,
  changeDomain,
  type CatalogChangeKind,
} from "./catalog-changes"
import { ChangeKindSelect } from "../publishing/change-kind-select"
import { CAUSE_NAMES } from "../publishing/version-causes"
import { warehouseApi, invalidateWarehouseCatalogs } from "./warehouse-api"
import { warehouseBaselineMode, type WarehouseKind, type WarehouseRevision } from "./warehouse-types"

const revisionLabels: Record<WarehouseRevision["cause"], string> = CAUSE_NAMES

export function WarehouseChangeHistory({
  kind,
  entryId,
  rulesetId,
  locale,
  patchContext,
  currentRevisionId,
}: {
  kind: WarehouseKind
  entryId: string
  rulesetId: string
  locale: string
  patchContext?: { variantId: string; sourceUrl?: string; onSaved: () => void }
  /** The version on screen, marked on the timeline. */
  currentRevisionId?: string
}) {
  const client = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const canRecord =
    capabilities.includes("patch:write") && capabilities.includes(`${changeDomain[kind].toLowerCase()}:publish`)
  const changes = useCatalogChanges(kind, rulesetId, locale)
  const overview = usePublicationOverview()
  const history = useQuery({
    queryKey: ["warehouse", "history", kind, entryId],
    queryFn: () => warehouseApi.revisions(kind, entryId),
  })
  const [selectedTarget, setTarget] = useState("")
  const [patch, setPatch] = useState(patchContext?.variantId ?? "")
  const [selectedFrom, setFrom] = useState("")
  const [classification, setClassification] = useState<CatalogChangeKind>("UPDATED")
  const [summary, setSummary] = useState("")
  const [source, setSource] = useState(patchContext?.sourceUrl ?? "")
  const [message, setMessage] = useState("")
  const [editing, setEditing] = useState(!!patchContext)
  const mutation = useMutation({ mutationFn: (action: () => Promise<void>) => action() })
  const revisions = (history.data ?? []).filter(
    (revision) =>
      revision.rulesetId === rulesetId && revision.state === "PUBLISHED" && !(kind === "spells" && revision.archived),
  )
  const variants =
    overview.data?.variants
      .filter((v) => v.rulesetId === rulesetId && v.status === "PUBLISHED")
      .sort((a, b) => a.rulesetOrdinal - b.rulesetOrdinal) ?? []
  const ordinal = (id: string | null) => variants.find((v) => v.id === id)?.rulesetOrdinal ?? -1
  const needsComparison = !["ADDED", "DATA_BASELINE", "REMOVED"].includes(classification)
  const eligibleTarget = (revision: WarehouseRevision) => {
    if (!["GAME_PATCH", "DATA_BASELINE"].includes(revision.cause)) return false
    const at = revision.effectiveFromPatchVariantId
    if (classification === "REMOVED")
      return at
        ? ordinal(at) >= 0 && ordinal(at) <= ordinal(patch)
        : (kind === "items" || kind === "spells") && warehouseBaselineMode(revision) === "initial"
    return (
      at === patch &&
      (!needsComparison || revision.cause === "GAME_PATCH") &&
      (classification !== "DATA_BASELINE" || revision.cause === "DATA_BASELINE")
    )
  }
  const targets = patchContext ? revisions.filter(eligibleTarget) : revisions
  const target = targets.some((r) => r.id === selectedTarget)
    ? selectedTarget
    : patchContext && targets.length === 1
      ? targets[0].id
      : ""
  const targetRevision = targets.find((r) => r.id === target)
  const comparisonRevisions = revisions.filter((revision) => {
    if (revision.id === target || ordinal(patch) < 0) return false
    if (!revision.effectiveFromPatchVariantId)
      return (kind === "items" || kind === "spells") && !!warehouseBaselineMode(revision) && ordinal(patch) > 0
    return (
      ordinal(revision.effectiveFromPatchVariantId) >= 0 &&
      ordinal(revision.effectiveFromPatchVariantId) < ordinal(patch)
    )
  })
  const confirmed = changes.data?.some((c) => c.ownerId === entryId && c.patchVariantId === patch && c.confirmed)
  const from =
    patchContext && needsComparison && comparisonRevisions.length === 1 ? comparisonRevisions[0].id : selectedFrom
  const targetAllowed = targetRevision && eligibleTarget(targetRevision)
  const classField = patchContext ? (
    <fieldset className="min-w-0 space-y-1">
      <legend className="type-label">Phân loại</legend>
      <ActionStrip aria-label="Phân loại thay đổi">
        {Object.entries(catalogChangeKinds)
          .filter(([key]) => key !== "DATA_BASELINE")
          .map(([key, { label, icon: Icon }]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={classification === key ? "secondary" : "ghost"}
              aria-pressed={classification === key}
              onClick={() => setClassification(key as CatalogChangeKind)}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Button>
          ))}
      </ActionStrip>
    </fieldset>
  ) : (
    <label className="grid gap-1.5 text-sm">
      Phân loại
      <ChangeKindSelect
        ariaLabel="Phân loại thay đổi"
        className="w-full"
        options={Object.entries(catalogChangeKinds).map(
          ([kind, config]) => [kind as CatalogChangeKind, config.label] as const,
        )}
        value={classification}
        onChange={(kind) => {
          if (kind) setClassification(kind)
        }}
      />
    </label>
  )
  const variantName = (id: string) => {
    const variant = variants.find((v) => v.id === id)
    return variant ? variant.patchTitle || variant.patchCode : undefined
  }
  const seasonName = (id: string) =>
    overview.data?.seasons.find((season) => season.id === variants.find((v) => v.id === id)?.seasonId)?.displayName
  // One node per patch, newest first: the versions published (or drafted) there and the change recorded for it.
  const shown = (history.data ?? []).filter(
    (revision) =>
      revision.rulesetId === rulesetId &&
      (revision.state === "PUBLISHED" || revision.state === "DRAFT") &&
      !(kind === "spells" && revision.archived),
  )
  const nodeKeys = [
    ...new Set([
      ...shown.map((revision) => revision.effectiveFromPatchVariantId ?? ""),
      ...(changes.data ?? []).filter((c) => c.ownerId === entryId).map((c) => c.patchVariantId ?? ""),
    ]),
  ].sort((a, b) => (a ? ordinal(a) : -2) - (b ? ordinal(b) : -2) || 0)
  const nodes = nodeKeys.reverse().map((key) => ({
    key: key || "unscoped",
    patchId: key || null,
    revisions: shown
      .filter((revision) => (revision.effectiveFromPatchVariantId ?? "") === key)
      .sort((a, b) => b.revisionNo - a.revisionNo),
    changes: (changes.data ?? []).filter((c) => c.ownerId === entryId && (c.patchVariantId ?? "") === key),
  }))
  const recordForm = (
    <>
      {patchContext && canRecord && classField}
      {patchContext && targets.length < 2 ? (
        targetRevision && (
          <p className="type-meta">
            Bản ở patch này · v{targetRevision.revisionNo} · {revisionLabels[targetRevision.cause]}
          </p>
        )
      ) : (
        <label className="grid gap-1.5 text-sm">
          Bản dữ liệu đã xuất bản
          <select
            aria-label="Bản dữ liệu đã xuất bản"
            className={control}
            value={target}
            onChange={(event) => {
              const id = event.target.value
              setTarget(id)
              setFrom("")
            }}
          >
            <option value="">Chọn bản dữ liệu</option>
            {targets.map((r) => (
              <option key={r.id} value={r.id}>
                v{r.revisionNo} · {revisionLabels[r.cause]} ·{" "}
                {variants.find((v) => v.id === r.effectiveFromPatchVariantId)?.patchCode ?? "Chưa rõ patch"}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* On the timeline the form opens under one patch, so the patch is that node's. */}
      {canRecord && (
        <>
          {!patchContext && classField}
          {patchContext && needsComparison && comparisonRevisions.length === 1 && (
            <p className="type-meta">
              Bản trước · v{comparisonRevisions[0].revisionNo} ·{" "}
              {variants.find((v) => v.id === comparisonRevisions[0].effectiveFromPatchVariantId)?.patchCode ??
                "Nhập dữ liệu, chưa rõ patch"}
            </p>
          )}
          {(!patchContext || (needsComparison && comparisonRevisions.length > 1)) && (
            <label className="grid gap-1.5 text-sm">
              Bản trước để đối chiếu
              <select
                aria-label="Bản trước để đối chiếu"
                className={control}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                <option value="">{needsComparison ? "Chọn bản trước" : "Chưa có / không áp dụng"}</option>
                {comparisonRevisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.revisionNo} ·{" "}
                    {r.effectiveFromPatchVariantId
                      ? variants.find((v) => v.id === r.effectiveFromPatchVariantId)?.patchCode
                      : "Nhập dữ liệu, chưa rõ patch"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1.5 text-sm">
            Tóm tắt · {locale}
            <textarea
              aria-label="Tóm tắt thay đổi"
              className={control}
              maxLength={4000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            Liên kết nguồn xác minh
            <input
              aria-label="Liên kết nguồn xác minh"
              type="url"
              className={control}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://"
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            Tăng/giảm cần đánh giá tác động gameplay. Loại bỏ giữ nguyên hồ sơ quá khứ. Lịch sử đã xác nhận không bị kéo
            đổi patch.
          </p>
          {confirmed && <p className="text-xs text-muted-foreground">Patch này đã có lịch sử được xác nhận.</p>}
          {patchContext &&
            !confirmed &&
            !history.isPending &&
            (!targets.length || (needsComparison && !comparisonRevisions.length)) && (
              <p className="type-meta">
                Cần bản dữ liệu đã xuất bản phù hợp với loại thay đổi. Điều chỉnh gameplay cần cả bản trước và bản cập
                nhật tại patch này.{" "}
                <Link className="underline" to={`/${kind}?item=${entryId}&patch=${patch}&show=all`}>
                  Mở hồ sơ trong kho
                </Link>
              </p>
            )}
          <Button
            size="sm"
            disabled={
              !targetAllowed ||
              !patch ||
              (needsComparison && !comparisonRevisions.some((revision) => revision.id === from)) ||
              !summary.trim() ||
              !/^https?:\/\/\S+$/i.test(source.trim()) ||
              confirmed ||
              mutation.isPending
            }
            onClick={() =>
              void mutation
                .mutateAsync(async () => {
                  await backendRequest(`/admin/${kind}/${entryId}/changes`, {
                    method: "POST",
                    body: JSON.stringify({
                      patchVariantId: patch,
                      toRevisionId: target,
                      fromRevisionId: !patchContext || needsComparison ? from || null : null,
                      kinds: [classification],
                      translations: [{ locale, text: summary }],
                      sourceUrl: source.trim(),
                    }),
                  })
                  await invalidateWarehouseCatalogs(client)
                  await client.invalidateQueries({ queryKey: ["publication-overview"] })
                  setMessage("Đã xác nhận lịch sử thay đổi.")
                  setEditing(false)
                  patchContext?.onSaved()
                })
                .catch(() => {})
            }
          >
            <Save className="size-4" />
            Xác nhận lịch sử
          </Button>
        </>
      )}
    </>
  )
  return (
    <section className="space-y-4" aria-label="Lịch sử thay đổi danh mục">
      {!patchContext && (
        <h3 className="flex items-center gap-2 font-medium">
          <History className="size-4" />
          Dòng thời gian theo patch
        </h3>
      )}
      {(changes.isPending || history.isPending) && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải lịch sử…
        </p>
      )}
      {(changes.error || history.error || mutation.error) && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(changes.error ?? history.error ?? mutation.error)}
        </p>
      )}
      {!patchContext && (
        <ol className="space-y-3 border-l pl-4" aria-label="Dòng thời gian theo patch">
          {nodes.map((node) => (
            <li key={node.key} className="relative space-y-2 rounded-lg bg-muted/25 p-3">
              <span
                aria-hidden
                className={`absolute top-4 -left-[1.3rem] size-2 rounded-full ${node.revisions.some((r) => r.id === currentRevisionId) ? "bg-primary" : "bg-muted-foreground/60"}`}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="type-body font-semibold">
                  {node.patchId ? (variantName(node.patchId) ?? "Patch đã ghi nhận") : "Chưa rõ patch"}
                </p>
                {node.patchId && <span className="type-meta">{seasonName(node.patchId)}</span>}
              </div>
              {node.revisions.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Các bản ở mốc này">
                  {node.revisions.map((revision) => (
                    <li
                      key={revision.id}
                      className={`type-meta rounded-md border px-2 py-0.5 ${revision.id === currentRevisionId ? "border-primary text-primary" : ""}`}
                    >
                      Bản {revision.revisionNo} · {revisionLabels[revision.cause]}
                      {revision.state === "DRAFT" ? " · nháp" : ""}
                      {revision.id === currentRevisionId ? " · đang mở" : ""}
                    </li>
                  ))}
                </ul>
              )}
              {node.changes.map((change) => (
                <div key={change.id} className="space-y-1.5">
                  <CatalogChangeBadges kinds={change.kinds} />
                  <p className="type-body whitespace-pre-wrap">
                    {change.summary ??
                      (change.kinds.includes("DATA_BASELINE")
                        ? "Số liệu thu thập ở patch này; chưa rõ được thêm vào game lúc nào."
                        : "Bản cập nhật theo patch; chưa phân loại thay đổi.")}
                  </p>
                  {change.actualLocale && change.actualLocale !== locale && (
                    <p className="type-meta">Ngôn ngữ dự phòng: {change.actualLocale}</p>
                  )}
                  {change.sourceUrl && (
                    <a
                      href={change.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="type-meta inline-flex items-center gap-1 text-primary"
                    >
                      Nguồn xác minh
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))}
              {!node.changes.length && node.patchId && <p className="type-meta">Chưa ghi nhận thay đổi ở patch này.</p>}
              {canRecord &&
                node.patchId &&
                !node.changes.some((change) => change.confirmed) &&
                (editing && patch === node.patchId ? (
                  <div className="space-y-3 rounded-xl border bg-background p-3">{recordForm}</div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const at = revisions.find((revision) => revision.effectiveFromPatchVariantId === node.patchId)
                      setPatch(node.patchId!)
                      setTarget(at?.id ?? "")
                      setFrom("")
                      setEditing(true)
                    }}
                  >
                    <PenLine className="size-4" />
                    Ghi nhận thay đổi
                  </Button>
                ))}
            </li>
          ))}
        </ol>
      )}
      {!patchContext && !nodes.length && !changes.isPending && !history.isPending && (
        <p className="type-meta">Chưa có bản nào được xuất bản.</p>
      )}
      {editing && patchContext && (
        <div className={patchContext ? "space-y-3" : "space-y-3 rounded-xl border p-3"}>{recordForm}</div>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
    </section>
  )
}
