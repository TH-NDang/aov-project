import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { creditHttpUrl, type MediaSourceInput } from "@aov/ui/lib/media-credit"
import { backendRequest, getSession } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { invalidateMediaAsset } from "./media-cache"
import { MediaSourceFields } from "./media-source-fields"

export function MediaSourceEditor({ assetId, versionId }: { assetId: string; versionId: string }) {
  const client = useQueryClient()
  const [source, setSource] = useState<MediaSourceInput>({ type: "OTHER", label: "" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  if (!getSession().actor?.capabilities.includes("media:write")) return null
  async function save() {
    if (
      !source.label.trim() ||
      (source.url && !creditHttpUrl(source.url)) ||
      (source.contactUrl && !creditHttpUrl(source.contactUrl))
    ) {
      setError("Điền tên nguồn và URL HTTP(S) hợp lệ.")
      return
    }
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await backendRequest(`/admin/media/assets/${assetId}/versions/${versionId}/sources`, {
        method: "POST",
        body: JSON.stringify(source),
      })
      await invalidateMediaAsset(client, assetId)
      setMessage("Đã bổ sung nguồn cho phiên bản ảnh này.")
      setSource({ type: "OTHER", label: "" })
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="mt-3 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">Bổ sung nguồn / chủ sở hữu</summary>
      <div className="mt-3 space-y-3">
        <MediaSourceFields value={source} onChange={setSource} disabled={busy} />
        <Button type="button" disabled={busy || !source.label.trim()} onClick={() => void save()}>
          Lưu nguồn ảnh
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  )
}
