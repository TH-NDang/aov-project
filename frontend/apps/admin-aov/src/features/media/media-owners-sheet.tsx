import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Copyright, ExternalLink, GitMerge, PencilLine, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { creditHttpUrl } from "@aov/ui/lib/media-credit"
import { errorMessage } from "@/lib/api/errors"
import { confirmAction } from "@/components/confirm-dialog"
import { useIsWide } from "@/hooks/use-media-query"
import { control } from "../publishing/fields"
import {
  mergeMediaOwner,
  refreshAfterOwnerChange,
  updateMediaOwner,
  useMediaOwners,
  type MediaOwner,
} from "./media-owners"
import { ownerKey, similarOwner } from "@/features/media/media-owner-names"
import { toast } from "sonner"

type Editing = { owner: MediaOwner; mode: "edit" | "merge" }

/** The owner catalog: one spelling per owner, renamed or merged for every image at once (ADR-017). */
export function MediaOwnersSheet({ writable, onClose }: { writable: boolean; onClose: () => void }) {
  const wide = useIsWide()
  const owners = useMediaOwners()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Editing | null>(null)
  const all = owners.data ?? []
  const key = ownerKey(query)
  const shown = key ? all.filter((owner) => ownerKey(owner.name).includes(key)) : all

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(640px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader className="gap-1 border-b">
          <SheetTitle className="type-section-title pr-8">Chủ sở hữu ảnh</SheetTitle>
          <SheetDescription>
            Mỗi chủ sở hữu có một cách viết. Đổi tên hoặc gộp ở đây sẽ áp dụng cho mọi ảnh ghi chủ sở hữu đó.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-6">
          <label className="relative block">
            <span className="sr-only">Tìm chủ sở hữu</span>
            <Search aria-hidden="true" className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <input
              className={`${control} pl-9`}
              value={query}
              placeholder="Tìm chủ sở hữu"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {owners.isPending ? (
            <p role="status" className="type-meta">
              Đang tải chủ sở hữu…
            </p>
          ) : owners.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(owners.error)}
            </p>
          ) : !shown.length ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              {all.length
                ? "Không có chủ sở hữu khớp."
                : "Chưa có chủ sở hữu nào. Tên sẽ xuất hiện khi bạn ghi nguồn ảnh."}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border" aria-label="Danh sách chủ sở hữu">
              {shown.map((owner) => {
                const contact = creditHttpUrl(owner.contactUrl)
                const similar = similarOwner(
                  owner.name,
                  all.filter((other) => other.id !== owner.id),
                )
                const open = editing?.owner.id === owner.id ? editing.mode : null
                return (
                  <li key={owner.id} className="space-y-3 p-3">
                    <div className="flex items-start gap-3">
                      <Copyright aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-semibold break-words">{owner.name}</p>
                        <p className="type-meta flex flex-wrap items-center gap-x-3">
                          <span>{owner.assetCount} ảnh</span>
                          {contact && (
                            <a
                              href={contact}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink aria-hidden="true" className="size-3" />
                              Liên hệ
                            </a>
                          )}
                        </p>
                        {similar && (
                          <p className="type-meta text-(--aov-warning)">
                            Gần giống “{similar.name}”. Gộp nếu là cùng một chủ sở hữu.
                          </p>
                        )}
                      </div>
                      {writable && !open && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Sửa ${owner.name}`}
                            title="Sửa tên, liên hệ"
                            onClick={() => setEditing({ owner, mode: "edit" })}
                          >
                            <PencilLine className="size-4" />
                          </Button>
                          {all.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Gộp ${owner.name} vào chủ sở hữu khác`}
                              title="Gộp vào chủ sở hữu khác"
                              onClick={() => setEditing({ owner, mode: "merge" })}
                            >
                              <GitMerge className="size-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {open === "edit" && <OwnerEditForm owner={owner} onDone={() => setEditing(null)} />}
                    {open === "merge" && (
                      <OwnerMergeForm
                        owner={owner}
                        targets={all.filter((other) => other.id !== owner.id)}
                        suggested={similar}
                        onDone={() => setEditing(null)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OwnerEditForm({ owner, onDone }: { owner: MediaOwner; onDone: () => void }) {
  const client = useQueryClient()
  const [name, setName] = useState(owner.name)
  const [contact, setContact] = useState(owner.contactUrl ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const unchanged = name.trim() === owner.name && (contact.trim() || null) === owner.contactUrl

  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/20 p-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const url = contact.trim() || null
        if (url && !creditHttpUrl(url)) return setError("Trang liên hệ phải bắt đầu bằng http:// hoặc https://.")
        setBusy(true)
        setError("")
        try {
          await updateMediaOwner(owner, name.trim(), url)
          await refreshAfterOwnerChange(client)
          toast.success("Đã lưu chủ sở hữu.")
          onDone()
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="grid gap-1 text-sm">
        Tên chủ sở hữu
        <input
          className={control}
          maxLength={200}
          required
          autoFocus
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Trang liên hệ
        <input
          className={control}
          type="url"
          maxLength={2048}
          value={contact}
          disabled={busy}
          placeholder="https://…"
          onChange={(event) => setContact(event.target.value)}
        />
      </label>
      <p className="type-meta">
        Áp dụng cho {owner.assetCount} ảnh. Trang liên hệ riêng của từng nguồn được giữ nguyên.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={busy || !name.trim() || unchanged}>
          {busy ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </form>
  )
}

function OwnerMergeForm({
  owner,
  targets,
  suggested,
  onDone,
}: {
  owner: MediaOwner
  targets: MediaOwner[]
  suggested?: MediaOwner
  onDone: () => void
}) {
  const client = useQueryClient()
  const [targetId, setTargetId] = useState(suggested?.id ?? targets[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const target = targets.find((candidate) => candidate.id === targetId)

  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/20 p-3"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!target) return
        const confirmed = await confirmAction({
          title: `Gộp “${owner.name}” vào “${target.name}”?`,
          description: `${owner.assetCount} ảnh đang ghi “${owner.name}” sẽ chuyển sang “${target.name}”, rồi “${owner.name}” bị xóa khỏi danh sách. Không hoàn tác được.`,
          confirmLabel: "Gộp",
        })
        if (!confirmed) return

        setBusy(true)
        setError("")
        try {
          await mergeMediaOwner(owner, target)
          await refreshAfterOwnerChange(client)
          onDone()
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="grid gap-1 text-sm">
        Gộp vào
        <select
          className={control}
          value={targetId}
          disabled={busy}
          onChange={(event) => setTargetId(event.target.value)}
        >
          {targets.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.assetCount} ảnh
            </option>
          ))}
        </select>
      </label>
      {target && (
        <p className="type-meta">
          {owner.assetCount} ảnh đang ghi “{owner.name}” sẽ chuyển sang “{target.name}”, rồi “{owner.name}” bị xóa khỏi
          danh sách.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDone}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={busy || !target}>
          {busy ? "Đang gộp…" : "Gộp"}
        </Button>
      </div>
    </form>
  )
}
