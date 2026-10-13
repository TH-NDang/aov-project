import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, LoaderCircle, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { backendRequest } from "@/app/auth/session"
import { uploadAvatar } from "./avatar-upload"
import { profileError, saveProfile, userKeys, type UserProfile } from "./user-api"

export function ProfileForm({
  profile,
  admin = false,
  readOnly = false,
  onSaved,
  onReload,
}: {
  profile: UserProfile
  admin?: boolean
  readOnly?: boolean
  onSaved?: () => void
  onReload: () => void
}) {
  const cache = useQueryClient()
  const [draft, setDraft] = useState(profile)
  const [savedVersion, setSavedVersion] = useState(profile.version)
  const [savedAvatar, setSavedAvatar] = useState(profile.avatarAssetId)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState("")
  const [error, setError] = useState("")
  const upload = useRef<AbortController | null>(null)
  useEffect(() => {
    if (upload.current?.signal.aborted) setUploading("")
    return () => upload.current?.abort()
  }, [])
  useEffect(() => {
    setDraft((current) =>
      current.avatarAssetId === profile.avatarAssetId ? { ...current, avatarUrl: profile.avatarUrl } : current,
    )
  }, [profile.avatarAssetId, profile.avatarUrl])
  const locked = readOnly || busy || !!uploading
  const change = (field: "displayName" | "biography" | "locale" | "timeZone", value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

  async function choose(file?: File) {
    if (!file) return
    upload.current?.abort()
    const controller = new AbortController()
    upload.current = controller
    setError("")
    try {
      const result = await uploadAvatar(file, backendRequest, controller.signal, setUploading)
      if (!controller.signal.aborted)
        setDraft((current) => ({ ...current, avatarAssetId: result.assetId, avatarUrl: result.avatarUrl }))
    } catch (cause) {
      if (!controller.signal.aborted) setError(profileError(cause))
    } finally {
      if (!controller.signal.aborted) setUploading("")
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (locked) return
    setBusy(true)
    setError("")
    try {
      const saved = await saveProfile(admin ? profile.id : null, {
        displayName: draft.displayName,
        biography: draft.biography,
        locale: draft.locale,
        timeZone: draft.timeZone,
        avatarAssetId: draft.avatarAssetId,
        expectedVersion: savedVersion,
      })
      setDraft(saved)
      setSavedVersion(saved.version)
      setSavedAvatar(saved.avatarAssetId)
      await cache.invalidateQueries({ queryKey: userKeys.all })
      toast.success("Đã lưu hồ sơ.")
      onSaved?.()
    } catch (cause) {
      setError(profileError(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-wrap items-center gap-5 rounded-xl border bg-muted/30 p-5">
        <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          <UserRound className="size-10 text-muted-foreground" />
          {draft.avatarUrl && (
            <img
              key={draft.avatarUrl}
              src={draft.avatarUrl}
              alt="Ảnh đại diện"
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
              onError={(event) => {
                event.currentTarget.hidden = true
              }}
            />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="font-medium">Ảnh đại diện</p>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, WebP · tối đa 25 MB. Ảnh vuông sẽ hiển thị đẹp nhất.
          </p>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring ${locked ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}
              >
                <Camera className="size-4" /> Chọn ảnh
                <input
                  aria-label="Tải ảnh đại diện"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={locked}
                  className="sr-only"
                  onChange={(event) => {
                    void choose(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
              </label>
              {draft.avatarAssetId && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={locked}
                  onClick={() => setDraft((current) => ({ ...current, avatarAssetId: null, avatarUrl: null }))}
                >
                  Gỡ ảnh
                </Button>
              )}
            </div>
          )}
          {uploading && (
            <p role="status" className="flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              {uploading}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  upload.current?.abort()
                  setUploading("")
                  setError("Đã hủy tải ảnh. Bạn có thể chọn ảnh khác.")
                }}
              >
                Hủy
              </Button>
            </p>
          )}
          {!uploading && draft.avatarAssetId !== savedAvatar && (
            <p className="text-xs text-muted-foreground">Bấm Lưu hồ sơ để áp dụng thay đổi ảnh.</p>
          )}
        </div>
      </div>
      <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Tên hiển thị</span>
          <Input
            required
            maxLength={80}
            value={draft.displayName}
            onChange={(event) => change("displayName", event.target.value)}
          />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium">Giới thiệu</span>
          <textarea
            maxLength={1000}
            rows={4}
            value={draft.biography}
            onChange={(event) => change("biography", event.target.value)}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
          />
          <span className="block text-right text-xs text-muted-foreground">{draft.biography.length}/1000</span>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Ngôn ngữ</span>
          <Input
            required
            maxLength={35}
            list="profile-languages"
            value={draft.locale}
            onChange={(event) => change("locale", event.target.value)}
          />
          <datalist id="profile-languages">
            <option value="vi-VN" />
            <option value="en-US" />
            <option value="th-TH" />
          </datalist>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Múi giờ</span>
          <Input
            required
            maxLength={64}
            list="profile-zones"
            value={draft.timeZone}
            onChange={(event) => change("timeZone", event.target.value)}
          />
          <datalist id="profile-zones">
            {Intl.supportedValuesOf("timeZone")
              .concat("Asia/Ho_Chi_Minh", "UTC")
              .map((zone, i) => (
                <option key={`${zone}-${i}`} value={zone} />
              ))}
          </datalist>
        </label>
      </fieldset>
      {error && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" disabled={locked} onClick={onReload}>
            Bỏ bản đang sửa và tải hồ sơ mới
          </Button>
        </div>
      )}
      {!readOnly && (
        <Button type="submit" disabled={locked || !draft.displayName.trim()}>
          {busy && <LoaderCircle className="animate-spin" />}Lưu hồ sơ
        </Button>
      )}
    </form>
  )
}
