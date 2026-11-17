import { useState } from "react"
import { isIndividualProfile, type ProfileContent, type ProfileKind } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Check, ExternalLink, Trash2 } from "lucide-react"
import { Field } from "@/features/community/components/profile-form-primitives"
import { ProfileImageField } from "./profile-image-field"
import { PlatformIcon, socialPlatforms, customSocialPlatform, platformOf, type SocialPlatformId } from "./platform-icon"
import { cn } from "@aov/ui/lib/utils"

export type ProfileQuickEditTarget =
  | { type: "image"; field: "avatarUrl" | "coverUrl" }
  | { type: "link"; index: number | null; platform?: SocialPlatformId }

export function ProfileQuickEditSheet({
  target,
  kind,
  content,
  onApply,
  onClose,
  onBusyChange,
  readOnly = false,
}: {
  target: ProfileQuickEditTarget
  kind: ProfileKind
  content: ProfileContent
  onApply: (patch: Partial<ProfileContent>) => void
  onClose: () => void
  onBusyChange: (busy: boolean) => void
  readOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [imageUrl, setImageUrl] = useState(target.type === "image" ? content[target.field] || "" : "")
  const initialPlatform =
    target.type === "link" ? socialPlatforms.find((platform) => platform.id === target.platform) : undefined
  const [link, setLink] = useState(
    target.type === "link" && target.index !== null
      ? content.links[target.index]!
      : { label: initialPlatform ? `${initialPlatform.name} ${content.name}` : "", url: "", official: false },
  )
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || platformOf(link.url))
  const isCover = target.type === "image" && target.field === "coverUrl"
  const imageLabel = isCover ? "Ảnh bìa" : isIndividualProfile(kind) ? "Ảnh chân dung" : "Logo"
  const channelLabel = kind === "CIRCUIT" ? "kênh thông tin" : "kênh liên hệ"
  const title =
    target.type === "link"
      ? readOnly
        ? `Thông tin ${channelLabel}`
        : target.index === null
          ? `Thêm ${channelLabel}`
          : `Chỉnh sửa ${channelLabel}`
      : `Chỉnh sửa ${imageLabel.toLowerCase()}`
  const apply = () => {
    if (readOnly) return
    if (target.type === "image") onApply({ [target.field]: imageUrl })
    else
      onApply({
        links:
          target.index === null
            ? [...content.links, link]
            : content.links.map((item, index) => (index === target.index ? link : item)),
      })
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {readOnly ? "Liên kết công khai của hồ sơ." : "Áp dụng để xem trên hồ sơ, sau đó lưu nháp để giữ thay đổi."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) apply()
          }}
        >
          <div className="space-y-5 px-4 pb-6">
            {target.type === "image" ? (
              <ProfileImageField
                label={imageLabel}
                shape={isCover ? "cover" : isIndividualProfile(kind) ? "portrait" : "logo"}
                subject={
                  isCover
                    ? "cover"
                    : kind === "CIRCUIT"
                      ? "circuit"
                      : kind === "PERSON"
                        ? "person"
                        : kind === "PLAYER"
                          ? "player"
                          : kind === "TEAM"
                            ? "team"
                            : "organization"
                }
                name={content.name}
                value={imageUrl}
                onChange={setImageUrl}
                onBusyChange={(value) => {
                  setBusy(value)
                  onBusyChange(value)
                }}
              />
            ) : (
              <>
                {target.index === null && !readOnly && (
                  <div className="space-y-3">
                    <p className="type-label">Chọn nền tảng</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[...socialPlatforms, customSocialPlatform].map((platform) => (
                        <button
                          key={platform.id}
                          type="button"
                          aria-pressed={selectedPlatform.id === platform.id}
                          onClick={() => {
                            setSelectedPlatform(platform)
                            setLink((current) => ({
                              ...current,
                              label: platform.id === "website" ? "" : `${platform.name} ${content.name}`,
                            }))
                          }}
                          className={cn(
                            "type-body flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
                            selectedPlatform.id === platform.id ? "border-primary bg-primary/5" : "hover:bg-muted",
                          )}
                        >
                          <PlatformIcon url={platform.url} className="size-6" />
                          <span>{platform.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Field
                  label="Tên kênh"
                  readOnly={readOnly}
                  autoFocus
                  required
                  maxLength={200}
                  value={link.label}
                  onChange={(event) => setLink({ ...link, label: event.target.value })}
                  placeholder="Ví dụ: YouTube Garena AOV"
                />
                <Field
                  label="Đường dẫn"
                  readOnly={readOnly}
                  required
                  type="url"
                  pattern="https?://.*"
                  maxLength={2048}
                  value={link.url}
                  onChange={(event) => setLink({ ...link, url: event.target.value })}
                  placeholder={selectedPlatform.url ? `${selectedPlatform.url}…` : "https://…"}
                />
                {/^https?:\/\//i.test(link.url) && (
                  <Button type="button" variant="outline" asChild>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Mở liên kết
                    </a>
                  </Button>
                )}
                <label className="type-body flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    className="size-4 accent-primary"
                    checked={!!link.official}
                    onChange={(event) => setLink({ ...link, official: event.target.checked })}
                  />
                  Kênh chính thức
                </label>
                <p className="type-meta">
                  {kind === "CIRCUIT"
                    ? "Đánh dấu khi kênh được ban tổ chức xác nhận là kênh chính thức của hệ thống giải."
                    : "Đánh dấu khi kênh do chính tổ chức, đội hoặc tuyển thủ vận hành."}
                </p>
              </>
            )}
          </div>
          <SheetFooter className="border-t">
            <div className="flex flex-wrap items-center gap-2">
              {target.type === "link" && target.index !== null && !readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => onApply({ links: content.links.filter((_, index) => index !== target.index) })}
                >
                  <Trash2 className="size-4" />
                  Gỡ kênh
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                  {readOnly ? "Đóng" : "Hủy"}
                </Button>
                {!readOnly && (
                  <Button type="submit" disabled={busy}>
                    <Check className="size-4" />
                    Áp dụng
                  </Button>
                )}
              </div>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
