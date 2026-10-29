import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ImageCredit } from "@aov/ui/components/image-credit"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { backendRequest } from "@/app/auth/session"
import { ImagePreview } from "@/components/image-preview"
import { MediaSourceEditor } from "./media-source-editor"
import type { AssetProvenance } from "../publishing/types"

interface ContactAsset {
  versions: { id: string; url: string }[]
  provenance: AssetProvenance[]
}
export function ContactImage({ assetId, versionId }: { assetId: string; versionId: string }) {
  const [open, setOpen] = useState(false)
  const asset = useQuery({
    queryKey: ["media-contact-asset", assetId],
    queryFn: () => backendRequest<ContactAsset>(`/admin/media/assets/${assetId}`),
    enabled: open,
  })
  const version = asset.data?.versions.find((entry) => entry.id === versionId)
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm">Ảnh liên quan · phiên bản {versionId}</summary>
      {open && (
        <div className="mt-3 space-y-3">
          {asset.isPending && <p role="status">Đang tải ảnh liên quan…</p>}
          {asset.error && (
            <p role="alert">
              Không tải được ảnh.{" "}
              <button type="button" className="underline" onClick={() => void asset.refetch()}>
                Thử lại
              </button>
            </p>
          )}
          {version && (
            <ImagePreview
              src={version.url}
              alt="Ảnh trong yêu cầu liên hệ"
              className="h-48 w-48"
              overlay={<ImageCredit sources={currentMediaSources(asset.data?.provenance ?? [], versionId)} />}
            >
              <img
                className="h-full w-full rounded-lg object-contain"
                src={version.url}
                alt="Ảnh trong yêu cầu liên hệ"
              />
            </ImagePreview>
          )}
          {asset.data && !version && <p>Không tìm thấy phiên bản ảnh trong yêu cầu.</p>}
          {version && <MediaSourceEditor key={`${assetId}:${versionId}`} assetId={assetId} versionId={versionId} />}
        </div>
      )}
    </details>
  )
}
