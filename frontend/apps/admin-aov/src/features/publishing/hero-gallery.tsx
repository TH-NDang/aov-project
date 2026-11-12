import { useMemo, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { confirmAction } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "./asset-picker"
import { control } from "./fields"
import { HeroAsset } from "./hero-asset"
import { usePublicationOverview } from "./publication-overview"
import { selectSkillTranslation, skillLabel } from "./hero-skills"
import type { Content } from "./types"

export type GalleryKind = "HERO_ART" | "SKIN" | "SKILL" | "STICKER" | "OTHER"
export interface GalleryImage {
  assetId: string
  kind: GalleryKind
  roles: string[]
  partKey: string | null
  partName: string | null
  current: boolean
  versions: { revisionId: string; revisionNo: number; state: string; current: boolean; patchVariantId: string | null }[]
  attachment: {
    id: string
    caption: string | null
    untilPatchVariantId: string | null
    sortOrder: number
    version: number
  } | null
}

const KINDS: { key: GalleryKind | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "HERO_ART", label: "Ảnh tướng" },
  { key: "SKIN", label: "Trang phục" },
  { key: "SKILL", label: "Kỹ năng" },
  { key: "STICKER", label: "Sticker" },
  { key: "OTHER", label: "Khác" },
]
const KIND_NAMES = Object.fromEntries(KINDS.map(({ key, label }) => [key, label])) as Record<GalleryKind, string>

const ROLE_NAMES: Record<string, string> = {
  HEAD: "Ảnh đại diện",
  PORTRAIT: "Chân dung",
  SPLASH: "Ảnh nền",
  SKIN_ART: "Ảnh trang phục",
  SKIN_HEAD: "Đại diện trang phục",
  SKIN_PORTRAIT: "Chân dung trang phục",
  SKILL_ICON: "Icon kỹ năng",
  SKILL_STATE: "Icon trạng thái kỹ năng",
  SKILL_LIBRARY: "Ảnh thư viện kỹ năng",
}

/** The upload type each kind adds, so the picker lists and uploads the right images. */
const UPLOAD_TYPES: Record<GalleryKind, { value: string; label: string }[]> = {
  HERO_ART: [
    { value: "HERO_SPLASH", label: "Ảnh nền" },
    { value: "HERO_PORTRAIT", label: "Chân dung" },
    { value: "HERO_HEAD", label: "Ảnh đại diện" },
  ],
  SKIN: [{ value: "HERO_SKIN_ART", label: "Ảnh trang phục" }],
  SKILL: [{ value: "HERO_SKILL_ICON", label: "Icon kỹ năng" }],
  STICKER: [{ value: "CHIBI_STICKER", label: "Sticker chibi" }],
  OTHER: [{ value: "OTHER", label: "Khác" }],
}

type Period = "all" | "current" | "past"
const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "Mọi thời điểm" },
  { key: "current", label: "Đang dùng" },
  { key: "past", label: "Trước đây" },
]

const role = (image: GalleryImage) => (image.roles.find((value) => value !== "GALLERY") ?? "GALLERY").split(":")[0]
const draftOnly = (image: GalleryImage) =>
  !image.current && image.versions.length > 0 && image.versions.every((version) => version.state === "DRAFT")
const inPeriod = (image: GalleryImage, period: Period) =>
  period === "all" || (period === "current" ? image.current : !image.current && !draftOnly(image))

/** How a tile is shaped: wide art across two columns, portraits tall, icons and stickers square. */
function tileShape(image: GalleryImage) {
  const place = role(image)
  if (place === "SPLASH" || place === "SKIN_ART" || (place === "GALLERY" && image.kind === "SKIN"))
    return "col-span-2 aspect-video"
  if (place === "PORTRAIT" || place === "SKIN_PORTRAIT") return "aspect-[3/4]"
  return "aspect-square"
}

export const galleryKey = (heroId: string) => ["hero-gallery", heroId] as const

/**
 * Every image of the hero in one place (ADR-027): those its versions show, the current one first and older ones after,
 * and images attached straight to the hero, such as skill icons from before a rework or stickers. Tabs split them by
 * what they show; the panel beside the grid shows the chosen one large, with where it was used.
 */
export function HeroGallery({
  heroId,
  name,
  locale,
  content,
  canWrite,
  reloadKey,
}: {
  heroId: string
  name: string
  locale: string
  content: Content
  canWrite: boolean
  /** Changes when the open version's images change, so the gallery reads them again. */
  reloadKey: string
}) {
  const gallery = useQuery({
    queryKey: [...galleryKey(heroId), locale, reloadKey],
    queryFn: () =>
      backendRequest<{ items: GalleryImage[] }>(
        `/admin/heroes/${encodeURIComponent(heroId)}/gallery?locale=${encodeURIComponent(locale)}`,
      ),
  })
  const overview = usePublicationOverview()
  const [kind, setKind] = useState<GalleryKind | "ALL">("ALL")
  const [period, setPeriod] = useState<Period>("all")
  const [chosen, setChosen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const items = useMemo(() => gallery.data?.items ?? [], [gallery.data])
  const patchName = (id: string | null | undefined) => {
    const variant = overview.data?.variants.find((item) => item.id === id)
    return variant ? variant.patchTitle || variant.patchCode : null
  }
  const counts = (key: GalleryKind | "ALL") =>
    items.filter((image) => (key === "ALL" || image.kind === key) && inPeriod(image, period)).length
  const shown = items.filter((image) => (kind === "ALL" || image.kind === kind) && inPeriod(image, period))
  const selected = shown.find((image) => image.assetId === chosen) ?? shown[0]

  if (gallery.isPending) return <p className="type-meta">Đang tải thư viện ảnh…</p>
  if (gallery.isError)
    return (
      <p role="alert" className="type-body text-destructive">
        {errorMessage(gallery.error)}
      </p>
    )

  return (
    <div className="min-w-0 space-y-3" aria-label="Thư viện ảnh của tướng">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Loại ảnh" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {KINDS.filter(({ key }) => key === "ALL" || counts(key) > 0 || kind === key).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={kind === key}
              onClick={() => setKind(key)}
              className={cn(
                "type-body inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 transition-colors",
                kind === key ? "border-primary bg-primary/10 text-foreground" : "hover:bg-muted/60",
              )}
            >
              {label}
              <span className="type-meta tabular-nums">{counts(key)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Thời điểm"
            className={cn(control, "h-8 w-auto")}
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
          >
            {PERIODS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {canWrite && (
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
              <ImagePlus aria-hidden className="size-4" /> Thêm ảnh
            </Button>
          )}
        </div>
      </div>

      {shown.length ? (
        <div className="grid min-w-0 gap-4 @min-[760px]:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
          {selected && (
            <GalleryDetail
              key={selected.assetId}
              heroId={heroId}
              image={selected}
              name={name}
              patchName={patchName}
              canWrite={canWrite}
              content={content}
              locale={locale}
            />
          )}
          <ul
            aria-label="Ảnh"
            className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 @min-[760px]:order-first"
          >
            {shown.map((image) => (
              <li key={image.assetId} className={tileShape(image)}>
                <button
                  type="button"
                  aria-pressed={selected?.assetId === image.assetId}
                  aria-label={`Xem ${imageTitle(image, name)}`}
                  onClick={() => setChosen(image.assetId)}
                  className={cn(
                    "relative block size-full overflow-hidden rounded-lg border bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring",
                    selected?.assetId === image.assetId && "ring-2 ring-primary",
                  )}
                >
                  <HeroAsset id={image.assetId} alt="" className="size-full rounded-none" />
                  <TileBadge image={image} patchName={patchName} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="type-meta rounded-lg border border-dashed p-4">
          {items.length ? "Không có ảnh nào khớp bộ lọc." : "Tướng chưa có ảnh nào."}
        </p>
      )}

      {canWrite && (
        <AddToGallery
          open={adding}
          onOpenChange={setAdding}
          heroId={heroId}
          content={content}
          locale={locale}
          onAdded={(assetId) => {
            setKind("ALL")
            setPeriod("all")
            setChosen(assetId)
          }}
        />
      )}
    </div>
  )
}

/** A short word on the picture when it is not what readers see today. */
function TileBadge({ image, patchName }: { image: GalleryImage; patchName: (id: string | null) => string | null }) {
  const until = image.attachment?.untilPatchVariantId
  const label = image.current
    ? null
    : draftOnly(image)
      ? "Bản nháp"
      : until
        ? `Trước ${patchName(until) ?? "patch"}`
        : image.versions.length
          ? "Bản cũ"
          : null
  if (!label) return null
  // A dark strip over the artwork, so the word reads on any picture.
  return (
    <span className="type-meta absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-0.5 text-left text-white">
      {label}
    </span>
  )
}

function imageTitle(image: GalleryImage, name: string) {
  if (image.attachment?.caption) return image.attachment.caption
  const place = role(image)
  const what = place === "GALLERY" ? KIND_NAMES[image.kind] : (ROLE_NAMES[place] ?? place)
  return [image.partName ?? (place === "HEAD" || place === "PORTRAIT" || place === "SPLASH" ? name : null), what]
    .filter(Boolean)
    .join(" · ")
}

/** The chosen image large, what it is, which versions used it, and for an attached one, how to change it. */
function GalleryDetail({
  heroId,
  image,
  name,
  patchName,
  canWrite,
  content,
  locale,
}: {
  heroId: string
  image: GalleryImage
  name: string
  patchName: (id: string | null) => string | null
  canWrite: boolean
  content: Content
  locale: string
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const attachment = image.attachment
  const remove = useMutation({
    mutationFn: () =>
      backendRequest(`/admin/heroes/${heroId}/gallery/${attachment!.id}?expectedVersion=${attachment!.version}`, {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: galleryKey(heroId) }),
    onError: (failure) => setError(errorMessage(failure)),
  })
  const status = image.current
    ? "Đang dùng"
    : draftOnly(image)
      ? "Chỉ có ở bản nháp"
      : attachment?.untilPatchVariantId
        ? `Dùng trước ${patchName(attachment.untilPatchVariantId) ?? "patch đã chọn"}`
        : image.versions.length
          ? "Chỉ còn ở bản cũ"
          : "Gắn thêm vào tướng"

  return (
    <aside aria-label="Ảnh đang xem" className="min-w-0 space-y-3 rounded-xl border p-3 @min-[760px]:self-start">
      <HeroAsset
        id={image.assetId}
        alt={imageTitle(image, name)}
        className="w-full"
        naturalAspectRatio={tileShape(image).includes("aspect-video") ? 16 / 9 : 1}
        preview
      />
      <div className="space-y-1">
        <p className="type-section-title break-words">{imageTitle(image, name)}</p>
        <p className="type-meta">
          {KIND_NAMES[image.kind]} · {status}
        </p>
      </div>
      {image.versions.length > 0 && (
        <div className="space-y-1">
          <p className="type-label text-muted-foreground">Có trong</p>
          <ul className="type-body space-y-0.5">
            {image.versions.map((version) => (
              <li key={version.revisionId}>
                Bản {version.revisionNo} ·{" "}
                {version.state === "DRAFT" ? "Bản nháp" : version.current ? "Đang hiệu lực" : "Bản cũ"}
                {patchName(version.patchVariantId) ? ` · ${patchName(version.patchVariantId)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {attachment && !editing && canWrite && (
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil aria-hidden className="size-4" /> Sửa mô tả
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={async () => {
              const accepted = await confirmAction({
                title: "Bỏ ảnh khỏi thư viện của tướng?",
                description: "Ảnh vẫn còn trong Quản lý ảnh; chỉ bỏ liên kết với tướng này.",
                confirmLabel: "Bỏ khỏi thư viện",
              })
              if (accepted) remove.mutate()
            }}
          >
            <Trash2 aria-hidden className="size-4" /> Bỏ khỏi thư viện
          </Button>
        </div>
      )}
      {attachment && editing && (
        <AttachmentForm
          heroId={heroId}
          content={content}
          locale={locale}
          initial={{
            kind: image.kind,
            caption: attachment.caption ?? "",
            partKey: image.partKey ?? "",
            untilPatchVariantId: attachment.untilPatchVariantId ?? "",
          }}
          submitLabel="Lưu"
          onCancel={() => setEditing(false)}
          onSubmit={async (value) => {
            await backendRequest(`/admin/heroes/${heroId}/gallery/${attachment.id}`, {
              method: "PUT",
              body: JSON.stringify({ expectedVersion: attachment.version, ...value }),
            })
            await queryClient.invalidateQueries({ queryKey: galleryKey(heroId) })
            setEditing(false)
          }}
        />
      )}
      {error && (
        <p role="alert" className="type-body text-destructive">
          {error}
        </p>
      )}
    </aside>
  )
}

type AttachmentValue = { kind: GalleryKind; caption: string; partKey: string; untilPatchVariantId: string }

/** What an attached image is: its kind, a caption, the skill or skin it shows, and the patch it belongs before. */
function AttachmentForm({
  content,
  locale,
  initial,
  lockedKind = false,
  submitLabel,
  onCancel,
  onSubmit,
  children,
}: {
  heroId: string
  content: Content
  locale: string
  initial: AttachmentValue
  lockedKind?: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (value: {
    kind: GalleryKind
    caption: string | null
    partKey: string | null
    untilPatchVariantId: string | null
  }) => Promise<void>
  children?: (kind: GalleryKind) => ReactNode
}) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const overview = usePublicationOverview()
  const variants = [...(overview.data?.variants ?? [])].sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  const parts =
    value.kind === "SKILL"
      ? (content.SKILLS?.skills ?? []).map((skill) => ({
          key: skill.skillKey,
          label: [skillLabel(skill), selectSkillTranslation(skill, locale)?.name].filter(Boolean).join(" · "),
        }))
      : value.kind === "SKIN"
        ? (content.SKINS?.skins ?? []).map((skin) => ({
            key: skin.skinKey,
            label:
              skin.translations.find((text) => text.locale === locale)?.name ??
              skin.translations[0]?.name ??
              skin.skinKey,
          }))
        : []

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setError("")
        try {
          await onSubmit({
            kind: value.kind,
            caption: value.caption.trim() || null,
            partKey: value.partKey || null,
            untilPatchVariantId: value.untilPatchVariantId || null,
          })
        } catch (failure) {
          setError(errorMessage(failure))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="grid gap-1.5">
        <span className="type-label">Loại</span>
        <select
          className={control}
          value={value.kind}
          disabled={busy || lockedKind}
          onChange={(event) => setValue({ ...value, kind: event.target.value as GalleryKind, partKey: "" })}
        >
          {KINDS.filter(({ key }) => key !== "ALL").map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {children?.(value.kind)}
      <label className="grid gap-1.5">
        <span className="type-label">Mô tả ngắn</span>
        <input
          className={control}
          maxLength={500}
          placeholder="Ví dụ: Icon Chiêu 1 trước khi làm lại"
          value={value.caption}
          disabled={busy}
          onChange={(event) => setValue({ ...value, caption: event.target.value })}
        />
      </label>
      {parts.length > 0 && (
        <label className="grid gap-1.5">
          <span className="type-label">{value.kind === "SKILL" ? "Kỹ năng" : "Trang phục"}</span>
          <select
            className={control}
            value={value.partKey}
            disabled={busy}
            onChange={(event) => setValue({ ...value, partKey: event.target.value })}
          >
            <option value="">Không gắn</option>
            {parts.map((part) => (
              <option key={part.key} value={part.key}>
                {part.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1.5">
        <span className="type-label">Dùng trước patch</span>
        <select
          className={control}
          value={value.untilPatchVariantId}
          disabled={busy}
          onChange={(event) => setValue({ ...value, untilPatchVariantId: event.target.value })}
        >
          <option value="">Không rõ / không áp dụng</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.patchTitle || variant.patchCode}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="type-body text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Đang lưu…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Attaches an image from the library, or a new upload, straight to the hero; no draft is needed. */
function AddToGallery({
  open,
  onOpenChange,
  heroId,
  content,
  locale,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  heroId: string
  content: Content
  locale: string
  onAdded: (assetId: string) => void
}) {
  const queryClient = useQueryClient()
  const [assetId, setAssetId] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState<Record<GalleryKind, string>>({
    HERO_ART: "HERO_SPLASH",
    SKIN: "HERO_SKIN_ART",
    SKILL: "HERO_SKILL_ICON",
    STICKER: "CHIBI_STICKER",
    OTHER: "OTHER",
  })
  const [missing, setMissing] = useState(false)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setAssetId(null)
          setMissing(false)
        }
      }}
    >
      <SheetContent side="right" className="w-[min(480px,94vw)] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Thêm ảnh vào thư viện của tướng</SheetTitle>
          <SheetDescription>Có hiệu lực ngay, không cần tạo bản nháp hay xuất bản lại tướng.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <AttachmentForm
            heroId={heroId}
            content={content}
            locale={locale}
            initial={{ kind: "SKILL", caption: "", partKey: "", untilPatchVariantId: "" }}
            submitLabel="Thêm vào thư viện"
            onCancel={() => onOpenChange(false)}
            onSubmit={async (value) => {
              if (!assetId) {
                setMissing(true)
                return
              }
              await backendRequest(`/admin/heroes/${heroId}/gallery`, {
                method: "POST",
                body: JSON.stringify({ assetId, ...value }),
              })
              await queryClient.invalidateQueries({ queryKey: galleryKey(heroId) })
              onAdded(assetId)
              onOpenChange(false)
              setAssetId(null)
            }}
          >
            {(kind) => (
              <div className="grid gap-2">
                {UPLOAD_TYPES[kind].length > 1 && (
                  <label className="grid gap-1.5">
                    <span className="type-label">Loại ảnh trong kho</span>
                    <select
                      className={control}
                      value={uploadType[kind]}
                      onChange={(event) => {
                        setUploadType({ ...uploadType, [kind]: event.target.value })
                        setAssetId(null)
                      }}
                    >
                      {UPLOAD_TYPES[kind].map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <span className="type-label">Ảnh</span>
                <AssetPicker
                  key={uploadType[kind]}
                  semanticType={uploadType[kind]}
                  value={assetId}
                  onChange={(id) => {
                    setAssetId(id)
                    setMissing(false)
                  }}
                />
                {missing && (
                  <p role="alert" className="type-body text-destructive">
                    Chọn hoặc tải một ảnh trước.
                  </p>
                )}
              </div>
            )}
          </AttachmentForm>
        </div>
      </SheetContent>
    </Sheet>
  )
}
