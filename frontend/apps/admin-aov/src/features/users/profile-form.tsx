import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Camera, Check, Clock3, Languages, LoaderCircle, Pencil, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { backendRequest } from "@/app/auth/session"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { ProfilePreferencePicker, languageOptions, timeZoneOptions } from "./profile-preference-picker"
import { uploadAvatar } from "./avatar-upload"
import { initialProfileDraft, readBrowserPreferences } from "./profile-preferences"
import { profileError, saveProfile, userKeys, type UserProfile } from "./user-api"
import { z } from "zod"
import { useSession } from "@/app/auth/auth-gate"
import { useLocalDraft } from "@/app/drafts/use-local-draft"
import { DraftStatus } from "@/app/drafts/draft-status"

const profileDraftSchema = z.object({
  displayName: z.string(),
  biography: z.string(),
  locale: z.string(),
  timeZone: z.string(),
  avatarAssetId: z.string().nullable(),
})
const profileFields = (profile: UserProfile) => ({
  displayName: profile.displayName,
  biography: profile.biography,
  locale: profile.locale,
  timeZone: profile.timeZone,
  avatarAssetId: profile.avatarAssetId,
})

export function ProfileForm({
  profile,
  admin = false,
  readOnly = false,
  fullWidth = false,
  onSaved,
  onReload,
}: {
  profile: UserProfile
  admin?: boolean
  readOnly?: boolean
  fullWidth?: boolean
  onSaved?: () => void
  onReload: () => void
}) {
  const cache = useQueryClient()
  const [server, setServer] = useState(profile)
  useEffect(() => setServer(profile), [profile])
  const localDraft = useLocalDraft({
    form: admin ? `profile:${profile.id}` : "profile:me",
    initialValue: profileFields(initialProfileDraft(server, admin, readBrowserPreferences())),
    schema: profileDraftSchema,
    baseVersion: server.version,
    enabled: !readOnly,
  })
  const draft = localDraft.value
  const [avatarPreview, setAvatarPreview] = useState<{ assetId: string; url: string } | null>(null)
  const canReadMedia = useSession().actor?.capabilities.includes("catalog:read")
  const avatar = useQuery({
    queryKey: ["profile-draft-avatar", draft.avatarAssetId],
    enabled: !!draft.avatarAssetId && draft.avatarAssetId !== server.avatarAssetId && canReadMedia,
    queryFn: async () => {
      const asset = await backendRequest<{
        currentVersionId: string | null
        versions: { id: string; url: string | null }[]
      }>(`/admin/media/assets/${draft.avatarAssetId}`)
      return asset.versions.find((version) => version.id === asset.currentVersionId)?.url ?? null
    },
    staleTime: 300000,
  })
  const avatarUrl =
    draft.avatarAssetId === server.avatarAssetId
      ? server.avatarUrl
      : (avatar.data ?? (avatarPreview?.assetId === draft.avatarAssetId ? avatarPreview.url : null))
  const [editingName, setEditingName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState("")
  const [error, setError] = useState("")
  const upload = useRef<AbortController | null>(null)
  useEffect(() => {
    if (upload.current?.signal.aborted) setUploading("")
    return () => upload.current?.abort()
  }, [])
  const locked = readOnly || busy || !!uploading || !localDraft.ready || localDraft.invalid || localDraft.conflict
  const change = (field: "displayName" | "biography" | "locale" | "timeZone", value: string) =>
    localDraft.update({ ...draft, [field]: value })

  async function choose(file?: File) {
    if (!file) return
    upload.current?.abort()
    const controller = new AbortController()
    upload.current = controller
    setError("")
    try {
      const result = await uploadAvatar(file, backendRequest, controller.signal, setUploading)
      if (!controller.signal.aborted) {
        localDraft.update({ ...draft, avatarAssetId: result.assetId })
        setAvatarPreview({ assetId: result.assetId, url: result.avatarUrl })
      }
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
        expectedVersion: server.version,
      })
      setServer(saved)
      localDraft.rebase(profileFields(saved), profileFields(saved), saved.version)
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
    <form onSubmit={save} className={fullWidth ? "w-full" : "overflow-hidden rounded-2xl border bg-card shadow-sm"}>
      <div
        aria-hidden="true"
        className="relative h-32 overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-800 sm:h-44"
      >
        <div className="absolute -right-12 -top-24 size-80 rounded-full border border-white/10 bg-indigo-400/10" />
        <div className="absolute right-20 top-8 size-64 rotate-45 rounded-3xl border border-white/10" />
        <div className="absolute -bottom-32 left-1/4 size-60 rounded-full bg-violet-400/10 blur-3xl" />
      </div>
      <div className={`relative space-y-7 px-5 pb-6 sm:px-8 sm:pb-8 ${fullWidth ? "mx-auto w-full max-w-3xl" : ""}`}>
        <div className="-mt-12 flex flex-wrap items-end gap-x-5 gap-y-4 sm:-mt-14">
          <div className="relative shrink-0">
            <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted shadow-sm sm:size-28">
              <UserRound className="size-10 text-muted-foreground" />
              {avatarUrl && (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt="Ảnh đại diện"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 size-full object-cover"
                  onError={(event) => {
                    event.currentTarget.hidden = true
                  }}
                />
              )}
            </div>
            {!readOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={locked}
                    aria-label="Chỉnh sửa ảnh đại diện"
                    className="absolute bottom-0 right-0 size-8 rounded-full border-2 border-card bg-background shadow-sm"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] space-y-3">
                  <p className="text-sm font-medium">Ảnh đại diện</p>
                  <p className="text-xs text-muted-foreground">PNG, JPEG, WebP · tối đa 25 MB. Nên chọn ảnh vuông.</p>
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring ${locked ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}
                  >
                    <Camera className="size-4" />
                    Chọn ảnh mới
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
                      className="w-full"
                      onClick={() => localDraft.update({ ...draft, avatarAssetId: null })}
                    >
                      Gỡ ảnh đại diện
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Bấm Lưu thay đổi để áp dụng ảnh mới.</p>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="min-w-0 basis-48 flex-1 pb-1 pt-2">
            {editingName && !readOnly ? (
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Tên hiển thị"
                  autoFocus
                  required
                  maxLength={80}
                  value={draft.displayName}
                  disabled={locked}
                  onChange={(event) => change("displayName", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      setEditingName(false)
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={locked}
                  aria-label="Xong chỉnh sửa tên"
                  onClick={() => setEditingName(false)}
                >
                  <Check />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
                  {draft.displayName || "Tên của bạn"}
                </h1>
                {!readOnly && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={locked}
                    className="size-8 shrink-0 text-muted-foreground"
                    aria-label="Chỉnh sửa tên hiển thị"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        {uploading && (
          <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            {uploading}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                upload.current?.abort()
                setUploading("")
                setError("Đã hủy tải ảnh.")
              }}
            >
              Hủy
            </Button>
          </div>
        )}
        {!uploading && draft.avatarAssetId !== server.avatarAssetId && (
          <p className="text-xs text-muted-foreground">Ảnh đại diện có thay đổi chưa lưu.</p>
        )}
        {!readOnly && <DraftStatus draft={localDraft} disabled={busy || !!uploading} />}
        <label className="block space-y-2">
          <span className="text-sm font-medium">Giới thiệu</span>
          <textarea
            aria-label="Giới thiệu"
            placeholder="Một vài điều về bạn…"
            maxLength={1000}
            rows={3}
            disabled={locked}
            value={draft.biography}
            onChange={(event) => change("biography", event.target.value)}
            className="block w-full resize-y rounded-lg border bg-background px-3 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <span className="block text-right text-xs text-muted-foreground">{draft.biography.length}/1000</span>
        </label>
        <div className="grid min-w-0 gap-5 border-t pt-6 sm:grid-cols-2">
          <ProfilePreferencePicker
            label="Ngôn ngữ"
            icon={Languages}
            value={draft.locale}
            options={languageOptions}
            disabled={locked}
            onChange={(value) => change("locale", value)}
          />
          <ProfilePreferencePicker
            label="Múi giờ"
            showTime
            icon={Clock3}
            value={draft.timeZone}
            options={timeZoneOptions}
            disabled={locked}
            onChange={(value) => change("timeZone", value)}
          />
        </div>
        {error && (
          <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !!uploading}
              onClick={() => {
                void localDraft.flush()
                onReload()
              }}
            >
              Tải hồ sơ mới để đối chiếu, giữ nháp
            </Button>
          </div>
        )}
        {!readOnly && (
          <div className="flex justify-end border-t pt-5">
            <Button type="submit" disabled={locked || !draft.displayName.trim()}>
              {busy && <LoaderCircle className="animate-spin" />}Lưu thay đổi
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
