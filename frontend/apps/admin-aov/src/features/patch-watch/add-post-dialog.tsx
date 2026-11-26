import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { Label } from "@aov/ui/components/label"
import { NativeSelect } from "@/components/native-select"
import { Segmented } from "@/components/segmented"
import { errorMessage } from "@/lib/api/errors"
import { patchWatchApi, patchWatchKeys, type AddPost } from "./patch-watch-api"
import {
  CHANNEL_LABELS,
  isWebAddress,
  REGION_LABELS,
  type PatchNoteChannel,
  type PatchNoteRegion,
} from "./patch-watch-model"

const REGIONS = Object.keys(REGION_LABELS) as PatchNoteRegion[]
const CHANNELS = (Object.keys(CHANNEL_LABELS) as PatchNoteChannel[]).map(
  (channel) => [channel, CHANNEL_LABELS[channel]] as const,
)
const EMPTY: AddPost = { url: "", title: "", region: "VN", channel: "OFFICIAL" }

/** Adds a post from a page the watch does not read, such as a Facebook post about the Vietnamese test server. */
export function AddPostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">{open && <AddPostForm onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function AddPostForm({ onClose }: { onClose: () => void }) {
  const cache = useQueryClient()
  const [post, setPost] = useState<AddPost>(EMPTY)
  const add = useMutation({
    mutationFn: () => patchWatchApi.add({ ...post, url: post.url.trim(), title: post.title.trim() }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: patchWatchKeys.all })
      onClose()
    },
    meta: { silent: true, successMessage: "Đã thêm bài." },
  })
  const urlValid = isWebAddress(post.url)
  const ready = urlValid && !!post.title.trim()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (ready) add.mutate()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Thêm bài cập nhật</DialogTitle>
        <DialogDescription>Cho bài ở trang chưa được theo dõi.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <Label htmlFor="pw-add-url">Liên kết</Label>
        <Input
          id="pw-add-url"
          type="url"
          inputMode="url"
          required
          placeholder="https://"
          value={post.url}
          aria-invalid={!!post.url && !urlValid}
          onChange={(event) => setPost((current) => ({ ...current, url: event.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pw-add-title">Tiêu đề</Label>
        <Input
          id="pw-add-title"
          required
          maxLength={500}
          value={post.title}
          onChange={(event) => setPost((current) => ({ ...current, title: event.target.value }))}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pw-add-region">Khu vực</Label>
          <NativeSelect
            id="pw-add-region"
            value={post.region}
            onChange={(event) => setPost((current) => ({ ...current, region: event.target.value as PatchNoteRegion }))}
          >
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {REGION_LABELS[region]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Segmented
          label="Máy chủ"
          value={post.channel}
          options={CHANNELS}
          onChange={(channel) => setPost((current) => ({ ...current, channel }))}
        />
      </div>

      {add.error && (
        <p role="alert" className="type-body text-destructive">
          {errorMessage(add.error)}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={!ready || add.isPending}>
          {add.isPending && <Loader2 className="size-4 animate-spin" />} Thêm bài
        </Button>
      </DialogFooter>
    </form>
  )
}
