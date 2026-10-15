import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest, getSession } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, uploadHeroImage, upgradeHeroImage } from "./publishing-api"
import { resourceImage } from "./resource-import"
import { control, Field } from "./fields"
const api = createPublishingApi(backendRequest)
export function AssetPicker({
  semanticType,
  value,
  onChange,
  resourcePath,
  sourceUrl,
}: {
  semanticType: string
  value: string | null
  onChange: (value: string) => void
  resourcePath?: string | null
  sourceUrl?: string
}) {
  const alive = useRef(true)
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  }, [onChange])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [label, setLabel] = useState("Ảnh do biên tập viên cung cấp")
  const [url, setUrl] = useState(sourceUrl ?? "")
  const writable = getSession().actor?.capabilities.includes("media:write")
  const assets = useQuery({
    queryKey: ["publishing-assets", semanticType, page],
    queryFn: () => api.assets(semanticType, page),
    enabled: open,
  })
  async function upgrade(file: File) {
    if (!value) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await upgradeHeroImage(backendRequest, value, file)
      if (!alive.current) return
      await assets.refetch()
      setMessage("Đã nâng chất lượng trên cùng asset. Không cần sửa hoặc publish lại tướng.")
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  async function upload(file: File | Promise<File>) {
    setBusy(true)
    setError("")
    try {
      const id = await uploadHeroImage(backendRequest, await file, semanticType, {
        label,
        url: url || null,
        note: resourcePath ?? null,
      })
      if (!alive.current) return
      change.current(id)
      await assets.refetch()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{value ? `Asset đã chọn: ${value}` : "Chưa chọn ảnh"}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(!open)}>
        {open ? "Đóng kho ảnh" : "Chọn / tải ảnh"}
      </Button>
      {open && (
        <div className="space-y-3">
          {assets.isPending && <p role="status">Đang tải ảnh…</p>}
          {assets.isError && <p role="alert">{errorMessage(assets.error)}</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {assets.data?.items
              .filter((a) => a.state === "ACTIVE" && a.currentVersionId)
              .map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  aria-label={`Chọn ảnh ${asset.id}`}
                  aria-pressed={value === asset.id}
                  className={
                    "overflow-hidden rounded-md border p-1 " + (value === asset.id ? "ring-2 ring-primary" : "")
                  }
                  onClick={() => onChange(asset.id)}
                >
                  {asset.currentUrl && (
                    <img className="aspect-square w-full object-cover" src={asset.currentUrl} alt="" loading="lazy" />
                  )}
                  <span className="block truncate text-xs">{asset.id.slice(0, 8)}</span>
                </button>
              ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>
              Trước
            </Button>
            <span className="text-xs">Trang {page + 1}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!assets.data || (page + 1) * 20 >= assets.data.totalElements}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </Button>
          </div>
          {writable && (
            <fieldset disabled={busy} className="space-y-3 border-t pt-3">
              <Field label="Nguồn ảnh" value={label} onChange={setLabel} />
              <Field label="URL nguồn ảnh" type="url" value={url} onChange={setUrl} />
              <label className="grid gap-1 text-sm">
                Tải ảnh mới
                <input
                  className={control}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void upload(file)
                    e.target.value = ""
                  }}
                />
              </label>
              {resourcePath && (
                <Button type="button" variant="outline" onClick={() => void upload(resourceImage(resourcePath))}>
                  Nhập ảnh từ tài nguyên
                </Button>
              )}
            </fieldset>
          )}
          {busy && <p role="status">Đang tải và kiểm tra ảnh…</p>}
        </div>
      )}
      {value && writable && (
        <label className="grid gap-1 text-sm">
          Nâng chất lượng ảnh đã chọn
          <input
            className={control}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upgrade(file)
              e.target.value = ""
            }}
          />
          <span className="text-xs text-muted-foreground">
            Chỉ dùng cho cùng artwork. Artwork khác cần tạo asset mới.
          </span>
        </label>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
