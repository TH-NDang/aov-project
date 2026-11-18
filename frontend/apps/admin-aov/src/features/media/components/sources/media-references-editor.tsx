import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link2 } from "lucide-react"
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
import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { PageReferencePicker } from "@/features/community/components/page-reference-picker"
import { invalidateMediaAsset } from "../../api/media-cache"

export function MediaReferencesEditor({
  assetId,
  source,
}: {
  assetId: string
  source: MediaSourceInput & { id: string; referenceVersion: number }
}) {
  const access = useTournamentAccess()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [owner, setOwner] = useState(source.ownerPageId || null)
  const [related, setRelated] = useState(source.relatedPageId || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (!access.canRead) return null
  const changed = owner !== (source.ownerPageId || null) || related !== (source.relatedPageId || null)
  async function save() {
    if (busy || !changed) return
    setBusy(true)
    setError("")
    try {
      await backendRequest(`/admin/media/assets/${assetId}/sources/${source.id}/references`, {
        method: "PUT",
        body: JSON.stringify({ expectedVersion: source.referenceVersion, ownerPageId: owner, relatedPageId: related }),
      })
      await invalidateMediaAsset(client, assetId)
      setOpen(false)
      toast.success("Đã lưu tham chiếu ảnh.")
    } catch (cause) {
      setError(
        (cause as { code?: string }).code === "MEDIA_SOURCE_VERSION_CONFLICT"
          ? "Tham chiếu vừa được thay đổi. Đóng và tải lại ảnh trước khi lưu."
          : errorMessage(cause),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setOwner(source.ownerPageId || null)
          setRelated(source.relatedPageId || null)
          setError("")
          setOpen(true)
        }}
      >
        <Link2 className="size-4" />
        Tham chiếu hồ sơ
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tham chiếu của ảnh</DialogTitle>
            <DialogDescription>
              Chọn hồ sơ chủ sở hữu và nội dung ảnh nhắc tới. Tên ghi công và URL nguồn ảnh được giữ riêng.
            </DialogDescription>
          </DialogHeader>
          <PageReferencePicker
            label="Hồ sơ chủ sở hữu"
            value={owner}
            fallbackName={source.ownerName || ""}
            actorKey={access.actorKey}
            canWrite={!busy}
            canCreate={access.canWrite && !busy}
            onSelect={(profile) => setOwner(profile?.id || null)}
          />
          <PageReferencePicker
            label="Nội dung liên quan"
            value={related}
            actorKey={access.actorKey}
            canWrite={!busy}
            canCreate={access.canWrite && !busy}
            onSelect={(profile) => setRelated(profile?.id || null)}
          />
          {error && (
            <p role="alert" className="type-body text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="button" disabled={busy || !changed} onClick={() => void save()}>
              {busy ? "Đang lưu…" : "Lưu tham chiếu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
