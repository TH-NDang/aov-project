import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, ShieldAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { useSession } from "@/app/auth/auth-gate"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { backendRequest } from "@/app/auth/session"
import { AssetPicker } from "../publishing/asset-picker"
import { CharacterMediaImage } from "./character-media-image"
import { HeroImageSource } from "../publishing/hero-image-source"
import { Field } from "../publishing/fields"
import { heroPreviewKey, type Request } from "../publishing/publishing-api"
import { invalidateHeroCatalogs } from "../publishing/publishing-cache"
import { useContentLocale } from "../publishing/publication-overview"
import type { MediaRole } from "../publishing/types"
import {
  characterMediaOwners,
  imageRoles,
  ownerMainEntry,
  type CharacterMediaOwner,
} from "./character-image-viewer-data"
import { SkinBadgeLabel } from "./skin-badge-label"
import {
  createCharacterImageApi,
  imageSectionChange,
  type CharacterImageEntry,
  type CharacterImageGroup,
} from "./character-image-api"

export const imageRoleLabels: Record<MediaRole, string> = { HEAD: "Head", PORTRAIT: "Portrait", SPLASH: "Cover" }
export function imageHeroHref(group: CharacterImageGroup, entry?: CharacterImageEntry) {
  return `/hero/${group.heroId}?revision=${group.revision.id}&tab=${entry?.ownerType === "SKIN" ? "skins" : "media"}`
}
export function CharacterImageDetail({
  selected,
  role,
  onClose,
  request = backendRequest,
}: {
  selected: { group: CharacterImageGroup; entry: CharacterImageEntry }
  role: MediaRole
  onClose: () => void
  request?: Request
}) {
  return (
    <CharacterMediaViewer
      key={`${selected.group.heroId}:${selected.group.revision.id}:${selected.entry.ownerType}:${selected.entry.skinKey}:${selected.entry.assetId}`}
      heroId={selected.group.heroId}
      heroCode={selected.group.code}
      heroName={selected.group.name}
      revisionId={selected.group.revision.id}
      initialRevisionNo={selected.group.revision.revisionNo}
      initialRole={role}
      initialOwner={selected.entry}
      initialEntry={selected.entry}
      onClose={onClose}
      request={request}
    />
  )
}

export function CharacterMediaViewer({
  heroId,
  heroCode,
  heroName,
  revisionId,
  initialRole,
  initialOwner,
  initialEntry,
  initialRevisionNo,
  fullPageTab,
  onClose,
  request = backendRequest,
}: {
  heroId: string
  heroCode?: string
  heroName?: string
  revisionId: string
  initialRole: MediaRole
  initialOwner: Pick<CharacterImageEntry, "ownerType" | "skinKey">
  initialEntry?: CharacterImageEntry
  initialRevisionNo?: number
  fullPageTab?: "skins" | "media"
  onClose: () => void
  request?: Request
}) {
  const wide = useIsWide()
  const client = useQueryClient()
  const api = createCharacterImageApi(request)
  const locale = useContentLocale()
  const { actor } = useSession()
  const canWrite = !!actor?.capabilities.includes("hero:write")
  const preview = useQuery({
    queryKey: heroPreviewKey(heroId, revisionId),
    queryFn: () => api.read(heroId, revisionId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const owners = useMemo(
    () => (preview.data ? characterMediaOwners(preview.data, locale, heroName ?? heroCode ?? "Tướng") : []),
    [preview.data, locale, heroName, heroCode],
  )
  const [selection, setSelection] = useState({ ...initialOwner, role: initialRole, clicked: initialEntry ?? null })
  const role = selection.role
  const owner = owners.find((item) => item.ownerType === selection.ownerType && item.skinKey === selection.skinKey)
  const primary = owner ? ownerMainEntry(owner, role) : null
  const entry: CharacterImageEntry = primary
    ? selection.clicked
      ? {
          ...primary,
          assetId: selection.clicked.assetId,
          label:
            selection.clicked.label ??
            owner?.images[role]?.find((image) => image.assetId === selection.clicked?.assetId)?.label ??
            null,
          main: selection.clicked.assetId === primary.assetId,
        }
      : primary
    : (selection.clicked ?? {
        ...selection,
        name: selection.skinKey ?? heroName ?? heroCode ?? "Tướng",
        assetId: null,
        label: null,
        main: true,
        rarityCode: null,
      })
  const displayHeroName = owners[0]?.name ?? heroName ?? heroCode ?? "Tướng"
  const [assetId, setAssetId] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [main, setMain] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const busy = uploading || saving
  const dirty = !!assetId
  const editable = canWrite && preview.data?.revision.state === "DRAFT" && !!owner
  useEffect(() => {
    if (!busy && !dirty) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [busy, dirty])
  function close() {
    if (!busy && (!dirty || window.confirm("Ảnh đã chọn chưa được lưu vào bản nháp. Đóng phần chỉnh sửa?"))) onClose()
  }
  function switchImage(nextOwner: CharacterMediaOwner, nextRole: MediaRole) {
    if (busy || (dirty && !window.confirm("Ảnh vừa chọn chưa lưu. Chuyển sang ảnh khác và bỏ lựa chọn này?"))) return
    setSelection({ ownerType: nextOwner.ownerType, skinKey: nextOwner.skinKey, role: nextRole, clicked: null })
    setAssetId(null)
    setLabel("")
    setMain(false)
    setError("")
  }
  async function save(id: string, fileLabel: string | null, asMain: boolean) {
    if (!preview.data || preview.isFetching || !editable) return
    setSaving(true)
    setError("")
    try {
      const change = imageSectionChange(preview.data, entry, role, id, fileLabel, asMain)
      await api.save(
        preview.data.revision,
        change.section,
        change.value,
        asMain ? `Select main ${role} image` : `Add ${role} image option`,
      )
      await Promise.all([
        invalidateHeroCatalogs(client),
        client.invalidateQueries({ queryKey: heroPreviewKey(heroId, revisionId) }),
      ])
      onClose()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(640px,94vw)] flex-col overflow-y-auto sm:max-w-none"
            : "flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>
            {entry.name} · {imageRoleLabels[role]}
          </SheetTitle>
          <SheetDescription>
            {displayHeroName} / {entry.ownerType === "HERO" ? "Ảnh tướng" : "Trang phục"} · Bản{" "}
            {preview.data?.revision.revisionNo ?? initialRevisionNo ?? "…"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              variant="outline"
              className={
                entry.main ? "gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""
              }
            >
              {entry.main && <Check className="size-3" />}
              {entry.main ? "Ảnh chính" : "Ảnh bổ sung"}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link
                to={`/hero/${heroId}?revision=${revisionId}&tab=${fullPageTab ?? (entry.ownerType === "SKIN" ? "skins" : "media")}`}
                aria-disabled={busy}
                onClick={(event) => {
                  if (busy || (dirty && !window.confirm("Ảnh vừa chọn chưa lưu. Mở trang tướng và bỏ lựa chọn này?"))) {
                    event.preventDefault()
                    return
                  }
                  setAssetId(null)
                  setLabel("")
                  setMain(false)
                }}
              >
                <ArrowUpRight className="size-4" />
                {busy ? "Chờ xử lý ảnh hoàn tất" : "Mở trang tướng"}
              </Link>
            </Button>
          </div>
          {entry.ownerType === "SKIN" && <SkinBadgeLabel code={entry.rarityCode} locale={locale} request={request} />}
          <section
            aria-label="Ảnh đang xem"
            className="flex h-[var(--character-preview-height)] items-center justify-center [--character-preview-height:clamp(16rem,46dvh,25rem)]"
          >
            <CharacterMediaImage id={entry.assetId} alt={entry.name} preview role={role} size="detail" />
          </section>
          {owner && (
            <section className="space-y-2" aria-label="Loại ảnh chính của đối tượng đang xem">
              <h3 className="text-xs font-medium text-muted-foreground">Ảnh chính của {entry.name}</h3>
              <div className="grid grid-cols-3 gap-2">
                {imageRoles.map((candidateRole) => (
                  <button
                    key={candidateRole}
                    type="button"
                    aria-label={`Xem ảnh chính ${imageRoleLabels[candidateRole]} của ${entry.name}`}
                    aria-pressed={role === candidateRole && entry.main}
                    disabled={busy}
                    className={`grid min-w-0 justify-items-center gap-1.5 rounded-lg border p-2 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${role === candidateRole && entry.main ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => switchImage(owner, candidateRole)}
                  >
                    <span className="flex h-16 w-full items-center justify-center">
                      <CharacterMediaImage
                        id={owner.main[candidateRole]}
                        alt={`${entry.name} ${imageRoleLabels[candidateRole]}`}
                        role={candidateRole}
                        size="switcher"
                      />
                    </span>
                    <span>{imageRoleLabels[candidateRole]}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!!owners.length && (
            <section className="space-y-2" aria-label="Tướng và trang phục liên quan">
              <h3 className="text-xs font-medium text-muted-foreground">
                Tướng & trang phục · Ảnh chính {imageRoleLabels[role]}
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2" tabIndex={0}>
                {owners.map((candidate) => (
                  <button
                    key={`${candidate.ownerType}:${candidate.skinKey}`}
                    type="button"
                    aria-label={`Xem ảnh chính ${imageRoleLabels[role]} · ${candidate.name}`}
                    aria-pressed={candidate.ownerType === entry.ownerType && candidate.skinKey === entry.skinKey}
                    disabled={busy}
                    className={`grid w-24 shrink-0 gap-1.5 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${candidate.ownerType === entry.ownerType && candidate.skinKey === entry.skinKey ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => switchImage(candidate, role)}
                  >
                    <span className="flex h-20 items-center justify-center">
                      <CharacterMediaImage id={candidate.main[role]} alt={candidate.name} role={role} size="related" />
                    </span>
                    <span className="truncate" title={candidate.name}>
                      {candidate.ownerType === "HERO" ? `${candidate.name} · Tướng` : candidate.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="space-y-2 text-sm">
            <p className="break-all font-mono text-xs text-muted-foreground">{entry.label || "Chưa có tên file"}</p>
            <HeroImageSource assetId={entry.assetId} />
          </div>
          {preview.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Đang lấy bản mới nhất…
            </p>
          )}
          {(preview.isError || error) && (
            <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
              {error || errorMessage(preview.error)}
            </p>
          )}
          {preview.data && !owner && (
            <p role="alert" className="text-sm text-destructive">
              Không tìm thấy đối tượng trong bản này. Chọn ảnh tướng hoặc trang phục còn tồn tại để tiếp tục.
            </p>
          )}
          {preview.data && owner && !editable && (
            <div className="flex gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                {preview.data.revision.state !== "DRAFT"
                  ? "Bản đã xuất bản được giữ nguyên. Mở trang tướng để tạo hoặc tiếp tục bản nháp trước khi thay ảnh."
                  : "Bạn cần quyền chỉnh sửa tướng để thay đổi ảnh."}
              </p>
            </div>
          )}
          {editable && (
            <div className="space-y-5 border-t pt-4">
              {entry.assetId && !entry.main && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy || preview.isFetching}
                  onClick={() => save(entry.assetId!, entry.label, true)}
                >
                  <Check className="size-4" />
                  Dùng ảnh này làm ảnh chính
                </Button>
              )}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-medium">
                  <ImagePlus className="size-4" />
                  Thêm ảnh vào {entry.ownerType === "HERO" ? "tướng" : "trang phục"}
                </h3>
                <AssetPicker
                  key={`${entry.ownerType}:${entry.skinKey}:${role}`}
                  semanticType={
                    entry.ownerType === "SKIN"
                      ? "HERO_SKIN_ART"
                      : role === "HEAD"
                        ? "HERO_HEAD"
                        : role === "PORTRAIT"
                          ? "HERO_PORTRAIT"
                          : "HERO_SPLASH"
                  }
                  value={assetId}
                  onChange={setAssetId}
                  onUploaded={(_, fileName) => setLabel(fileName)}
                  onBusyChange={setUploading}
                />
                <Field
                  label="Tên file / nhãn phân biệt"
                  value={label}
                  onChange={setLabel}
                  placeholder="Ví dụ: airi-portrait-2.png"
                  maxLength={255}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={main} onChange={(event) => setMain(event.target.checked)} />
                  Đặt ảnh vừa thêm làm ảnh chính
                </label>
                <p className="text-xs leading-5 text-muted-foreground">
                  Các ảnh hiện có được giữ lại. Ảnh bổ sung chỉ hiển thị chính khi bạn chọn làm ảnh chính.
                </p>
                <Button
                  className="w-full"
                  disabled={!assetId || busy || preview.isFetching}
                  onClick={() => assetId && save(assetId, label.trim() || null, main)}
                >
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}Lưu vào
                  bản nháp
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
