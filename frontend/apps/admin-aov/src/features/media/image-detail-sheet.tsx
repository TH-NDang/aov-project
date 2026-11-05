import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { useRecords, useTournamentAccess } from "../esports/data/use-esports-data"
import { upgradeHeroImage } from "../publishing/publishing-api"
import type { Asset } from "../publishing/types"
import { invalidateMediaAsset } from "./media-cache"
import { ImageDeleteAction } from "./image-delete-action"
import { MediaSourceFields } from "./media-source-fields"
import { PageReference } from "@/features/community/page-reference"
import { MediaReferencesEditor } from "./media-references-editor"
import {
  needsNoCredit,
  ownerCandidate,
  primarySource,
  sourceGap,
  sourceGapHints,
  sourceGapLabels,
  visibleSources,
} from "./media-source-gaps"

export const imageTypes: Record<string, string> = {
  USER_AVATAR: "Avatar người dùng",
  HERO_HEAD: "Đại diện tướng",
  HERO_PORTRAIT: "Chân dung tướng",
  HERO_SPLASH: "Ảnh nền tướng",
  HERO_SKILL_ICON: "Icon kỹ năng",
  HERO_SKIN_ART: "Trang phục",
  SKIN_BADGE: "Icon bậc / nhãn trang phục",
  ITEM_ICON: "Trang bị",
  ARCANA_ICON: "Ngọc",
  SPELL_ICON: "Phụ trợ",
  ENCHANTMENT_ICON: "Phù hiệu",
  PATCH_ART: "Ảnh bản cập nhật",
  OTHER: "Khác",
}
/** Lifecycle of the image record; whether anything shows the image is the separate usage count. */
export const imageStates: Record<string, string> = {
  ACTIVE: "Còn hiệu lực",
  DEPRECATED: "Ngừng sử dụng",
  BLOCKED: "Bị khóa",
}
const usageScopes: Record<string, string> = { CURRENT: "Đang dùng", DRAFT: "Bản nháp", HISTORICAL: "Lịch sử" }
const usageOwners: Record<string, string> = {
  HERO: "Tướng",
  HERO_IMPORT: "Phiên nhập tướng",
  HERO_SKILL_IMAGE: "Ảnh kỹ năng",
  HERO_UPLOAD_SESSION: "Phiên tải ảnh tướng",
  SKIN_BADGE: "Nhãn bậc trang phục",
  ITEM: "Trang bị",
  ITEM_METADATA: "Nhóm trang bị",
  ENCHANTMENT: "Phù hiệu",
  ENCHANTMENT_METADATA: "Hệ phù hiệu",
  ARCANA: "Ngọc",
  SPELL: "Phụ trợ",
  USER_PROFILE: "Hồ sơ người dùng",
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
interface Usage {
  counts: { current: number; draft: number; historical: number }
  items: { ownerDomain: string; ownerType: string; ownerId: string; propertyRole: string; scope: string }[]
}

const date = (value: string) => new Date(value).toLocaleString("vi-VN")
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
  return {
    uses,
    checked: access.canRead,
    loading: enabled && (teams.isPending || players.isPending || tournaments.isPending),
  }
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
        <Check aria-label="Có" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <X aria-label="Thiếu" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
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
    queryKey: ["managed-image", assetId],
    enabled: !!assetId,
    queryFn: () => backendRequest<Details>(`/admin/media/assets/${assetId}`),
  })
  const usages = useQuery({
    queryKey: ["managed-image-usages", assetId],
    enabled: !!assetId,
    queryFn: () => backendRequest<Usage>(`/admin/media/assets/${assetId}/usages`),
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
  const typeLabel = data ? (imageTypes[data.semanticType] ?? data.semanticType) : ""
  const title = main?.label || typeLabel || "Chi tiết ảnh"
  const wikiUses = usages.data?.items ?? []
  const useCount = (usages.data?.counts.current ?? 0) + tournament.uses.length
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
                    value: usages.isPending || tournament.loading ? "…" : useCount ? `${useCount} nơi` : "Chưa dùng",
                    hint: tournament.checked
                      ? "Tính nơi dùng trong wiki và ở giải đấu."
                      : "Chỉ tính nơi dùng trong wiki; cần quyền xem giải đấu để tính cả giải đấu.",
                    tone: useCount ? "ok" : "muted",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-2.5" title={item.hint}>
                    <p className="type-meta">{item.label}</p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-sm font-semibold",
                        item.tone === "warn" && "text-amber-700 dark:text-amber-400",
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
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                    )}
                  >
                    {gap === "none" ? (
                      <CircleCheck
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      />
                    ) : (
                      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    )}
                    <p>
                      <span className="font-semibold">{sourceGapLabels[gap]}.</span> {sourceGapHints[gap]}
                    </p>
                  </div>
                )}
                {!data.currentVersionId && (
                  <p className="text-sm text-muted-foreground">Ảnh chưa hoàn tất upload nên chưa nhận nguồn.</p>
                )}
                {shown.map((source) => {
                  const completing = editing === "owner" && source === ownerless
                  return (
                    <div key={source.id} className="rounded-xl border px-3 py-1">
                      <div className="divide-y">
                        <Fact ok={!!source.label.trim() && !source.label.includes("Chưa xác minh")} label="Lấy từ">
                          {source.label || "—"}
                          {safeUrl(source.url) && (
                            <a
                              href={safeUrl(source.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink aria-hidden className="size-3" />
                              Mở link nguồn
                            </a>
                          )}
                        </Fact>
                        <Fact ok={!!source.ownerName?.trim()} label="Chủ sở hữu / người cần credit">
                          {source.ownerPageId ? (
                            <PageReference
                              id={source.ownerPageId}
                              label={source.ownerName?.trim() || "Hồ sơ chủ sở hữu"}
                            />
                          ) : (
                            source.ownerName?.trim() || (
                              <span className="text-amber-700 dark:text-amber-400">Chưa ghi</span>
                            )
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
                {(usages.isPending || tournament.loading) && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Đang kiểm tra…
                  </p>
                )}
                {usages.error && <p role="alert">{errorMessage(usages.error)}</p>}
                {!usages.isPending && !tournament.loading && !wikiUses.length && !tournament.uses.length && (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Chưa có nơi nào dùng ảnh này.
                    {!tournament.checked && " Chưa kiểm tra giải đấu vì tài khoản chưa có quyền xem giải đấu."}
                  </p>
                )}
                {(!!wikiUses.length || !!tournament.uses.length) && (
                  <ul className="divide-y rounded-xl border">
                    {wikiUses.map((usage, index) => (
                      <li key={`${usage.ownerId}:${index}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{usageOwners[usage.ownerType] ?? usage.ownerType}</span>
                          <span className="type-meta block truncate">
                            {usage.propertyRole} · {usage.ownerId.slice(0, 8)}
                          </span>
                        </span>
                        <Badge variant={usage.scope === "CURRENT" ? "secondary" : "outline"}>
                          {usageScopes[usage.scope] ?? usage.scope}
                        </Badge>
                      </li>
                    ))}
                    {tournament.uses.map((use) => (
                      <li key={use.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <Trophy aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 font-medium">{use.label}</span>
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                          <Link to={use.to}>
                            Mở
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      </li>
                    ))}
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
                          {date(version.createdAt)}
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
                  Tạo lúc {date(data.createdAt)} · Cập nhật {date(data.updatedAt)}
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
        Chọn file ảnh
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
