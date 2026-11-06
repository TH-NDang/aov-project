import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, GitBranch, History, Save } from "lucide-react"
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
import { warehouseApi, invalidateWarehouseCatalogs } from "./warehouse-api"
import {
  warehouseBaselineMode,
  type WarehouseKind,
  type WarehouseEntry,
  type WarehouseRevision,
} from "./warehouse-types"

const revisionLabels: Record<WarehouseRevision["cause"], string> = {
  DATA_BASELINE: "Dữ liệu nền",
  GAME_PATCH: "Cập nhật gameplay",
  TRANSLATION_UPDATE: "Bản dịch",
  CONTENT_CORRECTION: "Hiệu chỉnh",
}

export function WarehouseChangeHistory({
  kind,
  entryId,
  rulesetId,
  locale,
  onDraft,
  patchContext,
}: {
  kind: WarehouseKind
  entryId: string
  rulesetId: string
  locale: string
  onDraft?: (entry: WarehouseEntry) => void
  patchContext?: { variantId: string; sourceUrl?: string; onSaved: () => void }
}) {
  const client = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const canRecord =
    capabilities.includes("patch:write") && capabilities.includes(`${changeDomain[kind].toLowerCase()}:publish`)
  const canDraft = capabilities.includes(`${changeDomain[kind].toLowerCase()}:write`)
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
  const rows = (changes.data ?? [])
    .filter((c) => c.ownerId === entryId)
    .sort((a, b) => ordinal(b.patchVariantId) - ordinal(a.patchVariantId))
  return (
    <section className="space-y-4" aria-label="Lịch sử thay đổi danh mục">
      {!patchContext && (
        <h3 className="flex items-center gap-2 font-medium">
          <History className="size-4" />
          Lịch sử trong game
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
        <ol className="space-y-3 border-l pl-4">
          {rows.map((change) => (
            <li key={change.id} className="relative space-y-2 rounded-lg bg-muted/25 p-3">
              <span className="absolute top-5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground/60" />
              <p className="text-sm font-medium">
                {variants.find((v) => v.id === change.patchVariantId)?.patchCode ?? "Patch đã ghi nhận"}
              </p>
              <CatalogChangeBadges kinds={change.kinds} />
              <p className="whitespace-pre-wrap text-sm">
                {change.summary ??
                  (change.kinds.includes("DATA_BASELINE")
                    ? "Trạng thái đã thu thập tại mốc này; chưa khẳng định thời điểm được thêm vào game."
                    : "Snapshot cập nhật game; chưa có phân loại được xác nhận.")}
              </p>
              {change.actualLocale && change.actualLocale !== locale && (
                <p className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {change.actualLocale}</p>
              )}
              {change.sourceUrl && (
                <a
                  href={change.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  Nguồn xác minh
                  <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
      {!patchContext && !rows.length && !changes.isPending && (
        <p className="text-sm text-muted-foreground">Chưa ghi nhận lịch sử. Hồ sơ chưa rõ patch được giữ riêng.</p>
      )}
      {!patchContext && (canRecord || canDraft) && (
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          Ghi nhận thay đổi / tạo bản cập nhật
        </Button>
      )}
      {editing && (
        <div className={patchContext ? "space-y-3" : "space-y-3 rounded-xl border p-3"}>
          {patchContext && canRecord && classField}
          {patchContext && targets.length < 2 ? (
            targetRevision && (
              <p className="type-meta">
                Bản tại mốc đối chiếu · v{targetRevision.revisionNo} · {revisionLabels[targetRevision.cause]}
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
                  if (!patchContext) setPatch(revisions.find((r) => r.id === id)?.effectiveFromPatchVariantId ?? "")
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
          {!patchContext && (
            <label className="grid gap-1.5 text-sm">
              Patch ghi nhận
              <select
                aria-label="Patch ghi nhận thay đổi"
                className={control}
                value={patch}
                onChange={(e) => {
                  setPatch(e.target.value)
                  setFrom("")
                }}
              >
                <option value="">Chọn patch</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {overview.data?.seasons.find((s) => s.id === v.seasonId)?.displayName} · {v.patchCode}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canDraft && !patchContext && (
            <Button
              variant="outline"
              size="sm"
              disabled={!targetRevision || !patch || mutation.isPending}
              onClick={() =>
                void mutation
                  .mutateAsync(async () => {
                    const snapshot = await warehouseApi.read(kind, entryId, target)
                    const saved = await warehouseApi.fork(kind, snapshot, "GAME_PATCH", patch)
                    await invalidateWarehouseCatalogs(client)
                    await client.invalidateQueries({ queryKey: ["publication-overview"] })
                    onDraft?.(saved)
                    setMessage("Đã tạo nháp cập nhật game. Chỉnh sửa và xuất bản nháp trước khi xác nhận phân loại.")
                  })
                  .catch(() => {})
              }
            >
              <GitBranch className="size-4" />
              Tạo nháp cập nhật game tại patch này
            </Button>
          )}
          {canRecord && (
            <>
              {!patchContext && classField}
              {patchContext && needsComparison && comparisonRevisions.length === 1 && (
                <p className="type-meta">
                  Bản trước · v{comparisonRevisions[0].revisionNo} ·{" "}
                  {variants.find((v) => v.id === comparisonRevisions[0].effectiveFromPatchVariantId)?.patchCode ??
                    "Dữ liệu nền"}
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
                          : "Dữ liệu nền chưa rõ patch"}
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
                Link nguồn xác minh
                <input
                  aria-label="Link nguồn xác minh"
                  type="url"
                  className={control}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="https://"
                />
              </label>
              <p className="text-xs leading-5 text-muted-foreground">
                Tăng/giảm cần đánh giá tác động gameplay. Loại bỏ giữ nguyên hồ sơ quá khứ. Lịch sử đã xác nhận không bị
                kéo đổi patch.
              </p>
              {confirmed && <p className="text-xs text-muted-foreground">Patch này đã có lịch sử được xác nhận.</p>}
              {patchContext &&
                !confirmed &&
                !history.isPending &&
                (!targets.length || (needsComparison && !comparisonRevisions.length)) && (
                  <p className="type-meta">
                    Cần bản dữ liệu đã xuất bản phù hợp với loại thay đổi. Điều chỉnh gameplay cần cả bản trước và bản
                    cập nhật tại patch này.{" "}
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
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
    </section>
  )
}
