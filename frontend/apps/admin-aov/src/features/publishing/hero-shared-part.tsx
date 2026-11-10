import { useState, type MouseEvent } from "react"
import { Link, useNavigate } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { backendRequest } from "@/app/auth/session"
import { confirmDiscard } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { languageOptions } from "../users/profile-preference-picker"
import { AssetPicker } from "./asset-picker"
import { Field } from "./fields"
import { HeroAsset } from "./hero-asset"
import {
  sharedPartRevision,
  sharedTextOf,
  withCardImages,
  withSharedText,
  type CardImages,
  type SharedText,
} from "./hero-forms-model"
import { heroPageLocation } from "./hero-location"
import { createPublishingApi, heroPreviewKey, publishReadinessKey } from "./publishing-api"
import { invalidateHeroCatalogs } from "./publishing-cache"
import type { MediaRole } from "./types"

const api = createPublishingApi(backendRequest)

const CARD_IMAGES: [MediaRole, string][] = [
  ["HEAD", "Ảnh đại diện"],
  ["PORTRAIT", "Chân dung"],
  ["SPLASH", "Ảnh nền"],
]

/**
 * What every form of a hero shares (ADR-024): the name and title above all forms and the card images of the hero list.
 * It is edited from any form page instead of being a form of its own. Saving creates the holder's draft when it has
 * none, saves what changed and publishes at once, since the holder carries no gameplay to check.
 */
export function HeroSharedPart({
  holder,
  locale,
  canWrite,
  canPublish,
  disabled,
}: {
  holder: { id: string; code: string }
  locale: string
  canWrite: boolean
  canPublish: boolean
  disabled?: boolean
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<SharedText | null>(null)
  const [images, setImages] = useState<CardImages>({})
  const [note, setNote] = useState("")
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState<MediaRole | null>(null)
  const revisions = useQuery({
    queryKey: ["publishing-revisions", holder.id],
    queryFn: () => api.revisions(holder.id),
  })
  const current = sharedPartRevision(revisions.data ?? [])
  const read = useQuery({
    queryKey: heroPreviewKey(holder.id, current?.id ?? ""),
    queryFn: () => api.read(holder.id, current!.id),
    enabled: !!current,
    staleTime: Infinity,
  })
  const content = read.data?.content
  const saved = sharedTextOf(content?.PROFILE, locale)
  const shown = text ?? saved
  const cards = content?.MEDIA_BINDINGS?.bindings ?? {}
  const draft = current?.state === "DRAFT" ? current : undefined
  const imagesChanged = CARD_IMAGES.some(([role]) => !!images[role] && images[role] !== cards[role])
  const textChanged = !!text && (text.name.trim() !== saved.name || text.title.trim() !== saved.title)
  const dirty = textChanged || imagesChanged || !!note.trim()
  const language = languageOptions.find((option) => option.value === locale)?.label ?? locale

  const reset = () => {
    setText(null)
    setImages({})
    setNote("")
    setPicking(null)
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Phần chung chưa có phiên bản nào.")
      const changeNote = note.trim()
      let revision = draft ?? (await api.fork(current, "CONTENT_CORRECTION", null))
      // Changes go onto what the draft holds now, so a draft opened elsewhere keeps its other edits.
      const base = (await api.read(holder.id, revision.id)).content
      if (textChanged)
        revision = await api.save(revision, "PROFILE", withSharedText(base.PROFILE, locale, shown), changeNote)
      if (imagesChanged)
        revision = await api.save(revision, "MEDIA_BINDINGS", withCardImages(base.MEDIA_BINDINGS, images), changeNote)
      return canPublish ? api.publish(revision, changeNote) : revision
    },
    onSuccess: () => {
      toast.success(canPublish ? "Đã xuất bản phần chung" : "Đã lưu bản nháp phần chung")
      reset()
      setOpen(false)
    },
    // A failed publish can leave a draft behind; the next save picks it up.
    onSettled: () =>
      Promise.all([
        invalidateHeroCatalogs(client),
        client.invalidateQueries({ queryKey: ["publishing-revisions", holder.id] }),
        client.invalidateQueries({ queryKey: ["publishing-preview", holder.id] }),
        client.invalidateQueries({ queryKey: ["hero-forms"] }),
        client.invalidateQueries({ queryKey: publishReadinessKey }),
      ]),
  })
  const busy = save.isPending || uploading

  async function leave() {
    if (busy) return false
    if (
      dirty &&
      !(await confirmDiscard({
        title: "Bỏ thay đổi phần chung?",
        description: "Tên, danh hiệu hoặc ảnh vừa sửa chưa được lưu.",
      }))
    )
      return false
    reset()
    save.reset()
    setOpen(false)
    return true
  }
  async function openHolderPage(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    if (current && (await leave())) void navigate(heroPageLocation(holder.id, new URLSearchParams(), current.id))
  }

  const summary = [saved.name, saved.title].filter(Boolean).join(" · ")
  if (!canWrite) return summary ? <p className="type-meta">Phần chung: {summary}</p> : null

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 max-w-full gap-1.5 px-2.5"
        disabled={disabled || !content}
        title="Sửa tên, danh hiệu và ảnh thẻ dùng chung cho mọi dạng"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4 shrink-0" />
        <span className="type-body shrink-0">Phần chung</span>
        {summary && <span className="type-meta truncate">· {summary}</span>}
        {draft && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Có bản nháp đang mở" />}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : void leave())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Phần chung của {saved.name || holder.code}</DialogTitle>
            <DialogDescription>
              Tên, danh hiệu và ảnh thẻ dùng chung cho mọi dạng: Wiki hiện chúng trong danh sách tướng và ở đầu trang
              tướng. {canPublish ? "Lưu là xuất bản ngay." : "Lưu vào bản nháp; người có quyền xuất bản sẽ xuất bản."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="hero-shared-part"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate()
            }}
          >
            {draft && (
              <p className="type-meta rounded-md border bg-muted/40 px-3 py-2">
                Phần chung đang có bản nháp #{draft.revisionNo}.{" "}
                {canPublish ? "Lưu sẽ xuất bản cả những thay đổi khác trong bản nháp đó." : "Lưu vào bản nháp đó."}
              </p>
            )}
            <p className="type-meta">Đang sửa nội dung {language}.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Tên tướng"
                value={shown.name}
                required
                disabled={busy}
                onChange={(name) => setText({ ...shown, name })}
              />
              <Field
                label="Danh hiệu"
                value={shown.title}
                disabled={busy}
                onChange={(title) => setText({ ...shown, title })}
              />
            </div>
            <fieldset disabled={save.isPending} className="space-y-3">
              <legend className="type-label mb-2">Ảnh thẻ</legend>
              {/* One picker at a time: each carries its own upload and credit fields. */}
              <div className="grid grid-cols-3 gap-3">
                {CARD_IMAGES.map(([role, label]) => (
                  <div key={role} className="min-w-0 space-y-1.5">
                    <HeroAsset
                      id={images[role] ?? cards[role]}
                      alt={label}
                      className="aspect-square w-full rounded-md border"
                      frameAspectRatio={1}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <span className="type-meta truncate">
                        {label}
                        {images[role] && images[role] !== cards[role] ? " · mới" : ""}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={picking === role ? "secondary" : "ghost"}
                        aria-expanded={picking === role}
                        aria-label={`Đổi ${label.toLowerCase()}`}
                        className="h-7 px-2"
                        disabled={uploading && picking !== role}
                        onClick={() => setPicking(picking === role ? null : role)}
                      >
                        Đổi
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {picking && (
                <AssetPicker
                  key={picking}
                  semanticType={`HERO_${picking}`}
                  value={images[picking] ?? cards[picking] ?? null}
                  onChange={(assetId) => setImages((previous) => ({ ...previous, [picking]: assetId }))}
                  onBusyChange={setUploading}
                />
              )}
            </fieldset>
            <Field label="Ghi chú thay đổi (tùy chọn)" value={note} disabled={busy} onChange={setNote} />
            {save.isError && (
              <p role="alert" className="type-body text-destructive">
                {errorMessage(save.error)}
              </p>
            )}
          </form>
          <DialogFooter className="items-center gap-2 sm:justify-between">
            <Link
              to={current ? heroPageLocation(holder.id, new URLSearchParams(), current.id) : "#"}
              onClick={(event) => void openHolderPage(event)}
              className="type-body text-primary underline-offset-4 hover:underline"
            >
              Trang phục chung, giá và lịch sử
            </Link>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void leave()}>
                Hủy
              </Button>
              <Button
                type="submit"
                form="hero-shared-part"
                disabled={busy || !(textChanged || imagesChanged) || !shown.name.trim()}
              >
                {save.isPending ? "Đang lưu…" : canPublish ? "Lưu và xuất bản" : "Lưu bản nháp"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
