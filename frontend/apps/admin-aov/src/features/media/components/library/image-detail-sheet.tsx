import { LocalTime } from "@aov/ui/components/local-time"
import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { imageTypeLabel } from "@/lib/image-types"
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  ImagePlus,
  Link2,
  Plus,
  Trophy,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"
import { creditHttpUrl, currentMediaSources, type MediaSourceInput } from "@aov/ui/lib/media-credit"
import { backendRequest, communityRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { useRecords, useTournamentAccess } from "../../../esports/data/use-esports-data"
import {
  usagePlaces,
  usageStateHints,
  usageStateLabels,
  usageStateOf,
  type MediaUsageReport,
  type UsagePlace,
} from "../../model/media-usage"
import { upgradeHeroImage } from "@/lib/api/publishing-api"
import type { Asset } from "@/lib/hero-types"
import { invalidateMediaAsset, mediaKeys } from "../../api/media-cache"
import { croppedImageTypes, FocalPointEditor } from "./focal-point-editor"
import { ImageDeleteAction } from "./image-delete-action"
import { MediaSourceFields } from "../sources/media-source-fields"
import { PageReference } from "@/features/community/components/page-reference"
import { MediaReferencesEditor } from "../sources/media-references-editor"
import {
  needsNoCredit,
  ownerCandidate,
  primarySource,
  sourceGap,
  sourceGapHints,
  sourceGapLabels,
  sourceOrigin,
  visibleSources,
} from "../../model/media-source-gaps"

/** Lifecycle of the image record; whether anything shows the image is the separate usage count. */
export const imageStates: Record<string, string> = {
  ACTIVE: "Còn hiệu lực",
  DEPRECATED: "Ngừng sử dụng",
  BLOCKED: "Bị khóa",
}

interface Version {
  id: string
  versionNo: number
  state: string
  mimeType: string
  width: number
  height: number
  sizeBytes: number
  url: string
  current: boolean
  createdAt: string
}
interface Source extends MediaSourceInput {
  /** Recorded without evidence of where the image came from; Admin words it instead of its label. */
  unverified?: boolean
  referenceVersion: number
  id: string
  versionId: string | null
}
interface Details extends Asset {
  createdAt: string
  updatedAt: string
  versions: Version[]
  provenance: Source[]
}

const safeUrl = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : undefined)
const sourceInput = (source?: MediaSourceInput): MediaSourceInput => ({
  type: source?.type ?? "OTHER",
  label: source?.label ?? "",
  ownerName: source?.ownerName ?? "",
  url: source?.url ?? "",
  contactUrl: source?.contactUrl ?? "",
  ownerPageId: source?.ownerPageId ?? null,
  relatedPageId: source?.relatedPageId ?? null,
})
function sourceProblem(source: MediaSourceInput) {
  if (!source.label.trim()) return "Điền tên nguồn."
  if ((source.url && !creditHttpUrl(source.url)) || (source.contactUrl && !creditHttpUrl(source.contactUrl)))
    return "URL phải bắt đầu bằng http:// hoặc https://."
  return ""
}

/** Teams, players and tournaments point at wiki images by URL, which carries the asset id. */
function useTournamentUses(assetId: string | null) {
  const access = useTournamentAccess()
  const enabled = !!assetId && access.canRead
  const teams = useRecords("teams", enabled)
  const players = useRecords("players", enabled)
  const tournaments = useRecords("tournaments", enabled)
  const uses = useMemo(() => {
    if (!assetId) return []
    const uses = (url?: string) => !!url && url.includes(assetId)
    return [
      ...(teams.data ?? [])
        .filter((entry) => uses(entry.content.logoUrl))
        .map((entry) => ({ id: entry.id, label: `Logo đội ${entry.content.name}`, to: "/tournaments/registry" })),
      ...(players.data ?? [])
        .filter((entry) => uses(entry.content.photoUrl))
        .map((entry) => ({
          id: entry.id,
          label: `Ảnh tuyển thủ ${entry.content.nickname}`,
          to: "/tournaments/registry?tab=players",
        })),
      ...(tournaments.data ?? [])
        .filter((entry) => uses(entry.content.logoUrl))
        .map((entry) => ({ id: entry.id, label: `Logo giải ${entry.content.name}`, to: `/tournaments/${entry.id}` })),
    ]
  }, [assetId, teams.data, players.data, tournaments.data])
  // Plans, pages and posts name images too, without a row of their own here.
  const references = useQuery({
    queryKey: mediaKeys.competitionUsage(assetId),
    enabled,
    retry: false,
    queryFn: ({ signal }) =>
      communityRequest<{ references: number }>(`/admin/media-assets/${assetId}/usage`, { signal }),
  })
  return {
    uses,
    others: Math.max(0, (references.data?.references ?? 0) - uses.length),
    checked: access.canRead && !references.isError,
    loading: enabled && (teams.isPending || players.isPending || tournaments.isPending),
    // This scan takes seconds, so it only holds back the claim that nothing uses the image.
    checking: enabled && references.isPending,
  }
}

const placeStateStyles: Record<UsagePlace["state"], "secondary" | "outline"> = {
  SHOWN: "secondary",
  DRAFT_ONLY: "outline",
  HISTORY_ONLY: "outline",
  STORED_ONLY: "outline",
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-label tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Fact({ ok, label, children }: { ok: boolean; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      {ok ? (
        <Check aria-label="Có" className="mt-0.5 size-4 shrink-0 text-(--aov-success)" />
      ) : (
        <X aria-label="Thiếu" className="mt-0.5 size-4 shrink-0 text-(--aov-warning)" />
      )}
      <div className="min-w-0 flex-1">
        <p className="type-meta">{label}</p>
        <div className="mt-0.5 text-sm break-words">{children}</div>
      </div>
    </div>
  )
}

function SourceForm({
  initial,
  focusOwner,
  submitLabel,
  onCancel,
  onSave,
}: {
  initial: MediaSourceInput
  focusOwner?: boolean
  submitLabel: string
  onCancel: () => void
  onSave: (source: MediaSourceInput) => Promise<void>
}) {
  const [source, setSource] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/20 p-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const problem = sourceProblem(source)
        if (problem) return setError(problem)
        setBusy(true)
        setError("")
        try {
          await onSave(source)
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setBusy(false)
        }
      }}
    >
      <MediaSourceFields value={source} onChange={setSource} disabled={busy} autoFocusOwner={focusOwner} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={busy || !source.label.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function ImageDetailSheet({
  assetId,
  writable,
  wide,
  startWith = null,
  onClose,
  onDeleted,
}: {
  assetId: string | null
  writable: boolean
  wide: boolean
  /** Opens straight into completing the owner or adding a source. */
  startWith?: "owner" | "new" | null
  onClose: () => void
  onDeleted?: (assetId: string) => void
}) {
  const client = useQueryClient()
  const [editing, setEditing] = useState<"owner" | "new" | null>(writable ? startWith : null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [upgradeError, setUpgradeError] = useState("")
  const details = useQuery({
    queryKey: mediaKeys.assetView(assetId, "managed"),
    enabled: !!assetId,
    queryFn: () => backendRequest<Details>(`/admin/media/assets/${assetId}`),
  })
  const usages = useQuery({
    queryKey: mediaKeys.managedUsages(assetId),
    enabled: !!assetId,
    queryFn: () => backendRequest<MediaUsageReport>(`/admin/media/assets/${assetId}/usages`),
  })
  const tournament = useTournamentUses(assetId)
  const data = details.data
  const current = data?.versions.find((version) => version.current)
  const sources = currentMediaSources(data?.provenance ?? [], data?.currentVersionId)
  const shown = visibleSources(sources)
  const gap = sourceGap(sources)
  const userImage = needsNoCredit(data?.semanticType)
  const main = primarySource(sources)
  const ownerless = ownerCandidate(shown)
  const typeLabel = data ? imageTypeLabel(data.semanticType) : ""
  const title = main?.label || typeLabel || "Chi tiết ảnh"
  const places = usagePlaces(usages.data?.items ?? [])
  const competitionCount = tournament.uses.length + tournament.others
  const shownCount = places.filter((place) => place.state === "SHOWN").length + competitionCount
  const usageState = usageStateOf(places, competitionCount)
  const active = data?.state === "ACTIVE"

  function close() {
    if (upgrading || deleting) return
    setEditing(null)
    setUpgradeOpen(false)
    setUpgradeError("")
    onClose()
  }
  async function addSource(source: MediaSourceInput) {
    if (!data?.currentVersionId) return
    await backendRequest(`/admin/media/assets/${data.id}/versions/${data.currentVersionId}/sources`, {
      method: "POST",
      body: JSON.stringify({
        ...source,
        label: source.label.trim(),
        ownerName: source.ownerName?.trim() || null,
        url: source.url?.trim() || null,
        contactUrl: source.contactUrl?.trim() || null,
      }),
    })
    await invalidateMediaAsset(client, data.id)
    setEditing(null)
    toast.success("Đã lưu nguồn ảnh.")
  }
  async function upgrade(file: File, source: MediaSourceInput) {
    if (!data) return
    const problem = sourceProblem(source)
    if (problem) return setUpgradeError(problem)
    setUpgrading(true)
    setUpgradeError("")
    try {
      await upgradeHeroImage(backendRequest, data.id, file, fetch, source)
      await invalidateMediaAsset(client, data.id)
      setUpgradeOpen(false)
      toast.success("Đã thêm phiên bản mới.")
    } catch (cause) {
      setUpgradeError(errorMessage(cause))
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <Sheet open={!!assetId} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(640px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader className="gap-1 border-b">
          <SheetTitle className="type-section-title pr-8 break-words">{data ? title : "Chi tiết ảnh"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {typeLabel && <span>{typeLabel}</span>}
            {assetId && (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground"
                title="Sao chép mã ảnh"
                onClick={() => {
                  void navigator.clipboard?.writeText(assetId)
                  toast.success("Đã sao chép mã ảnh.")
                }}
              >
                {assetId.slice(0, 8)}
                <Copy aria-hidden className="size-3" />
              </button>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-4 pb-6">
          {details.isPending && <p role="status">Đang tải chi tiết…</p>}
          {details.error && <p role="alert">{errorMessage(details.error)}</p>}
          {data && (
            <>
              <div className="overflow-hidden rounded-xl border bg-muted/20">
                {current ? (
                  <img src={current.url} alt={title} className="mx-auto max-h-72 w-full object-contain p-3" />
                ) : (
                  <p className="p-6 text-center text-sm text-muted-foreground">Ảnh chưa có phiên bản đang sử dụng.</p>
                )}
              </div>
              {current && croppedImageTypes.has(data.semanticType) && (
                <FocalPointEditor assetId={data.id} writable={writable && active} />
              )}
              <div className="grid grid-cols-3 gap-2" aria-label="Tóm tắt ảnh">
                {[
                  {
                    label: "Trạng thái",
                    value: imageStates[data.state] ?? data.state,
                    hint: "Ảnh chưa bị ngừng hay khóa. Có đang được dùng hay không xem ở Nơi dùng.",
                    tone: active ? "ok" : "warn",
                  },
                  userImage
                    ? {
                        label: "Nguồn",
                        value: "Không cần",
                        hint: "Ảnh đại diện thuộc về người dùng tải lên.",
                        tone: "muted",
                      }
                    : {
                        label: "Nguồn",
                        value: sourceGapLabels[gap],
                        hint: sourceGapHints[gap],
                        tone: gap === "none" ? "ok" : "warn",
                      },
                  {
                    label: "Nơi dùng",
                    value:
                      usages.isPending || tournament.loading
                        ? "…"
                        : shownCount
                          ? `${shownCount} nơi`
                          : usageStateLabels[usageState],
                    hint: `${usageStateHints[usageState]} ${
                      tournament.checked
                        ? "Tính cả Wiki, giải đấu và trang cộng đồng."
                        : "Chỉ tính trong Wiki vì chưa đọc được dữ liệu giải đấu."
                    }`,
                    tone: shownCount ? "ok" : usageState === "STORED_ONLY" ? "warn" : "muted",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-2.5" title={item.hint}>
                    <p className="type-meta">{item.label}</p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-sm font-semibold",
                        item.tone === "warn" && "text-(--aov-warning)",
                        item.tone === "muted" && "text-muted-foreground",
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <Section
                title="Nguồn ảnh"
                aside={
                  writable &&
                  data.currentVersionId &&
                  editing === null && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing("new")}>
                      <Plus className="size-3.5" />
                      Thêm nguồn khác
                    </Button>
                  )
                }
              >
                {userImage ? (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Ảnh đại diện do người dùng tự tải lên nên không cần ghi nguồn hay chủ sở hữu.
                  </p>
                ) : (
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-sm",
                      gap === "none"
                        ? "border-(--aov-success)/30 bg-(--aov-success-soft)"
                        : "border-(--aov-warning)/30 bg-(--aov-warning-soft) text-(--aov-warning)",
                    )}
                  >
                    {gap === "none" ? (
                      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-(--aov-success)" />
                    ) : (
                      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    )}
                    <p>
                      <span className="font-semibold">{sourceGapLabels[gap]}.</span> {sourceGapHints[gap]}
                    </p>
                  </div>
                )}
                {!data.currentVersionId && (
                  <p className="text-sm text-muted-foreground">Ảnh chưa tải lên xong nên chưa nhận nguồn.</p>
                )}
                {shown.map((source) => {
                  const completing = editing === "owner" && source === ownerless
                  return (
                    <div key={source.id} className="rounded-xl border px-3 py-1">
                      <div className="divide-y">
                        <Fact ok={!!source.label.trim() && !source.unverified} label="Lấy từ">
                          {sourceOrigin(source) || "—"}
                          {safeUrl(source.url) && (
                            <a
                              href={safeUrl(source.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink aria-hidden className="size-3" />
                              Mở liên kết nguồn
                            </a>
                          )}
                        </Fact>
                        <Fact ok={!!source.ownerName?.trim()} label="Chủ sở hữu / người cần ghi công">
                          {source.ownerPageId ? (
                            <PageReference
                              id={source.ownerPageId}
                              label={source.ownerName?.trim() || "Hồ sơ chủ sở hữu"}
                            />
                          ) : (
                            source.ownerName?.trim() || <span className="text-(--aov-warning)">Chưa ghi</span>
                          )}
                        </Fact>
                        {source.relatedPageId && (
                          <Fact ok label="Nội dung liên quan">
                            <PageReference id={source.relatedPageId} />
                          </Fact>
                        )}
                        {safeUrl(source.contactUrl) && (
                          <Fact ok label="Liên hệ bên cung cấp">
                            <a
                              href={safeUrl(source.contactUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {source.contactUrl}
                            </a>
                          </Fact>
                        )}
                        {source.note && <p className="py-2 text-xs text-muted-foreground">{source.note}</p>}
                        {writable && active && (
                          <div className="py-2">
                            <MediaReferencesEditor assetId={data.id} source={source} />
                          </div>
                        )}
                      </div>
                      {writable && source === ownerless && !completing && editing === null && (
                        <div className="border-t py-2">
                          <Button size="sm" onClick={() => setEditing("owner")}>
                            <UserRound className="size-3.5" />
                            Bổ sung chủ sở hữu
                          </Button>
                        </div>
                      )}
                      {completing && (
                        <div className="border-t py-3">
                          <SourceForm
                            initial={sourceInput(source)}
                            focusOwner
                            submitLabel="Lưu chủ sở hữu"
                            onCancel={() => setEditing(null)}
                            onSave={addSource}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
                {!shown.length && data.currentVersionId && editing === null && (
                  <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Chưa có thông tin nguồn.
                    {writable && (
                      <Button size="sm" className="mt-3 flex mx-auto" onClick={() => setEditing("new")}>
                        <Plus className="size-3.5" />
                        Thêm nguồn
                      </Button>
                    )}
                  </div>
                )}
                {editing === "new" && (
                  <SourceForm
                    initial={sourceInput()}
                    submitLabel="Lưu nguồn"
                    onCancel={() => setEditing(null)}
                    onSave={addSource}
                  />
                )}
              </Section>

              <Section title="Nơi dùng">
                {(usages.isPending || tournament.loading || tournament.checking) && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Đang kiểm tra…
                  </p>
                )}
                {usages.error && <p role="alert">{errorMessage(usages.error)}</p>}
                {!usages.isPending && !tournament.loading && (
                  <p className="type-meta">
                    Mỗi vị trí đếm một lần dù có trong nhiều bản, và chỉ tính là đang hiển thị khi nơi đó thật sự hiện
                    ảnh.
                  </p>
                )}
                {!usages.isPending &&
                  !tournament.loading &&
                  !tournament.checking &&
                  !places.length &&
                  !competitionCount && (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Chưa có nơi nào dùng ảnh này.
                      {!tournament.checked && " Chưa kiểm tra giải đấu vì chưa đọc được dữ liệu giải đấu."}
                    </p>
                  )}
                {(!!places.length || !!competitionCount) && (
                  <ul className="divide-y rounded-xl border">
                    {places.map((place) => (
                      <li key={place.key} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium break-words">{place.title}</span>
                          <span className="type-meta block">
                            {place.detail}
                            {!!place.draft && ` · ${place.draft} bản nháp`}
                            {!!place.historical && ` · ${place.historical} bản cũ`}
                          </span>
                          {place.note && <span className="type-meta block">{place.note}</span>}
                        </span>
                        <Badge variant={placeStateStyles[place.state]}>{usageStateLabels[place.state]}</Badge>
                        {place.href && (
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                            <Link to={place.href}>
                              Mở
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                    {tournament.uses.map((use) => (
                      <li key={use.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <Trophy aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 font-medium">{use.label}</span>
                        <Badge variant="secondary">{usageStateLabels.SHOWN}</Badge>
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                          <Link to={use.to}>
                            Mở
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      </li>
                    ))}
                    {tournament.others > 0 && (
                      <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <Trophy aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 font-medium">
                          {tournament.others} bản ghi khác ở giải đấu hoặc trang cộng đồng
                        </span>
                      </li>
                    )}
                  </ul>
                )}
              </Section>

              <Section
                title={`Phiên bản (${data.versions.length})`}
                aside={
                  writable &&
                  active &&
                  !upgradeOpen && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setUpgradeOpen(true)}>
                      <ImagePlus className="size-3.5" />
                      Tải phiên bản rõ hơn
                    </Button>
                  )
                }
              >
                {upgradeOpen && (
                  <UpgradePanel
                    initial={sourceInput(main)}
                    busy={upgrading}
                    error={upgradeError}
                    onCancel={() => {
                      setUpgradeOpen(false)
                      setUpgradeError("")
                    }}
                    onUpload={upgrade}
                  />
                )}
                <ul className="divide-y rounded-xl border">
                  {data.versions.map((version) => (
                    <li key={version.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">Phiên bản {version.versionNo}</span>
                        <span className="type-meta block">
                          {version.width} × {version.height} · {(version.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                          <LocalTime value={version.createdAt} />
                        </span>
                      </span>
                      {version.current && <Badge variant="secondary">Đang hiển thị</Badge>}
                      {safeUrl(version.url) && (
                        <Button asChild variant="ghost" size="icon" className="size-7">
                          <a href={safeUrl(version.url)} target="_blank" rel="noreferrer" title="Mở ảnh gốc">
                            <ExternalLink className="size-3.5" />
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="type-meta">
                  Tạo lúc <LocalTime value={data.createdAt} /> · Cập nhật <LocalTime value={data.updatedAt} />
                </p>
              </Section>
            </>
          )}
        </div>
        {data && writable && (
          <div className="shrink-0 border-t bg-background px-4 py-3">
            <ImageDeleteAction
              key={data.id}
              asset={{ ...data, currentUrl: current?.url ?? null }}
              label={title}
              versionCount={data.versions.length}
              disabled={upgrading || editing !== null}
              onBusyChange={setDeleting}
              onDeleted={() => {
                onDeleted?.(data.id)
                onClose()
              }}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Uploading a clearer copy of the same picture; its source starts from the current one. */
function UpgradePanel({
  initial,
  busy,
  error,
  onCancel,
  onUpload,
}: {
  initial: MediaSourceInput
  busy: boolean
  error: string
  onCancel: () => void
  onUpload: (file: File, source: MediaSourceInput) => void
}) {
  const [source, setSource] = useState(initial)
  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <p className="text-sm">
        Chỉ dùng cho bản rõ hơn của <span className="font-semibold">cùng hình</span>. Hình khác cần tạo ảnh mới. Nguồn
        dưới đây lấy theo nguồn hiện tại; sửa nếu bản mới lấy từ nơi khác.
      </p>
      <MediaSourceFields value={source} onChange={setSource} disabled={busy} />
      <label className="grid gap-1.5 text-sm font-medium">
        Chọn tệp ảnh
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          className="text-sm font-normal"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file, source)
            event.target.value = ""
          }}
        />
      </label>
      {busy && (
        <p role="status" className="text-sm">
          Đang tải phiên bản mới, hãy giữ trang mở…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </div>
  )
}
