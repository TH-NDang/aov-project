import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { ImageIcon, PencilLine, Upload } from "lucide-react"
import { errorMessage } from "@/lib/api/errors"
import { gameModeApi, gameModeKeys, uploadModeImage } from "./game-mode-api"

/**
 * The mode's art stays in view on the guide page and can be replaced there. A new picture goes into the mode's draft,
 * opening one when only a published version exists, so readers see it once the mode is published.
 */
export function ModeArtCard({ modeId, canWrite }: { modeId: string; canWrite: boolean }) {
  const client = useQueryClient()
  const mode = useQuery({
    queryKey: gameModeKeys.mode(modeId),
    queryFn: ({ signal }) => gameModeApi.current(modeId, signal),
  })
  const [preview, setPreview] = useState<string>()
  const change = useMutation({
    mutationFn: async (file: File) => {
      const artAssetId = await uploadModeImage(file, "GAME_MODE_ART", {
        type: "GAME_CLIENT",
        label: "Ảnh chế độ trong Liên Quân Mobile",
        note: `Uploaded mode art: ${file.name}`,
      })
      let current = mode.data!
      if (current.revision.state !== "DRAFT") current = await gameModeApi.createDraft(modeId, "Đổi ảnh chế độ")
      return gameModeApi.update(
        modeId,
        current.revision.id,
        current.revision.version,
        { ...current.content, artAssetId },
        "Đổi ảnh chế độ",
      )
    },
    onMutate: (file) => setPreview(URL.createObjectURL(file)),
    onSuccess: (next) => {
      client.setQueryData(gameModeKeys.mode(modeId), next)
      void client.invalidateQueries({ queryKey: gameModeKeys.list })
    },
    onError: () => setPreview(undefined),
    meta: { silent: true },
  })

  const data = mode.data
  const art = data?.content.artAssetId ? data.images[data.content.artAssetId]?.url : undefined
  const src = preview ?? art
  const draft = data?.revision.state === "DRAFT"

  return (
    <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="relative aspect-video bg-muted">
        {src ? (
          <img src={src} alt={`Ảnh chế độ ${data?.content.name ?? ""}`} className="size-full object-cover" />
        ) : (
          <span className="type-meta flex size-full flex-col items-center justify-center gap-1 text-(--aov-warning)">
            <ImageIcon className="size-6" aria-hidden="true" />
            Chế độ chưa có ảnh
          </span>
        )}
        {change.isPending && <span className="absolute inset-0 bg-background/60" aria-hidden="true" />}
      </div>
      <div className="grid content-center gap-2 p-4">
        <div className="grid gap-0.5">
          <span className="type-meta">Ảnh chế độ</span>
          <h2 className="type-section-title">{data?.content.name ?? "…"}</h2>
          <p className="type-meta">
            {draft
              ? "Ảnh đổi ở đây được lưu vào bản nháp của chế độ; xuất bản chế độ để người đọc thấy."
              : "Đổi ảnh sẽ mở một bản nháp mới cho chế độ."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`type-label inline-flex h-8 items-center gap-1.5 rounded-md border px-3 ${
              canWrite && data && !change.isPending ? "cursor-pointer hover:bg-muted" : "pointer-events-none opacity-50"
            }`}
          >
            <Upload className="size-4" />
            {change.isPending ? "Đang tải ảnh…" : src ? "Đổi ảnh" : "Tải ảnh lên"}
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              disabled={!canWrite || !data || change.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) change.mutate(file)
              }}
            />
          </label>
          <Link
            to={`/game-modes/${modeId}`}
            className="type-label inline-flex h-8 items-center gap-1.5 rounded-md border px-3 hover:bg-muted"
          >
            <PencilLine className="size-4" />
            Sửa thông tin chế độ
          </Link>
        </div>
        {change.isSuccess && <p className="type-meta text-(--aov-success)">Đã lưu ảnh mới vào bản nháp của chế độ.</p>}
        {change.isError && <p className="type-meta text-destructive">{errorMessage(change.error)}</p>}
      </div>
    </section>
  )
}
