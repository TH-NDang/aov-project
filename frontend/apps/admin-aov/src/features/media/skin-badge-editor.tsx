import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Languages, LoaderCircle, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { useIsWide } from "@/hooks/use-media-query"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../publishing/asset-picker"
import { Field, control } from "../publishing/fields"
import { languageOptions } from "../users/profile-preference-picker"
import type { Request } from "../publishing/publishing-api"
import {
  characterImageKeys,
  createCharacterImageApi,
  type BadgeKind,
  type SkinBadgeRecord,
  type SkinBadgeTranslation,
} from "./character-image-api"
import { BadgeGroupSelect } from "./skin-badge-group-editor"

export const badgeKindLabels: Record<BadgeKind, string> = {
  UNKNOWN: "Chưa phân loại",
  RARITY: "Bậc trang phục",
  EVENT: "Nhãn sự kiện",
}
export function SkinBadgeEditor({
  badge,
  locale,
  onClose,
  request = backendRequest,
  initialGroupId = null,
}: {
  badge: SkinBadgeRecord | null
  locale: string
  onClose: () => void
  request?: Request
  initialGroupId?: string | null
}) {
  const wide = useIsWide()
  const client = useQueryClient()
  const [regionCode, setRegionCode] = useState("vn")
  const regions = useQuery({
    queryKey: ["game-regions"],
    queryFn: () => createCharacterImageApi(request).regions(),
    enabled: !badge,
    staleTime: 60000,
  })
  const [kind, setKind] = useState<BadgeKind>(badge?.kind ?? "UNKNOWN")
  const [groupId, setGroupId] = useState<string | null>(initialGroupId)
  const [translations, setTranslations] = useState<SkinBadgeTranslation[]>(
    () => badge?.translations.map((text) => ({ ...text })) ?? [{ locale, displayName: "", iconAssetId: null }],
  )
  const [language, setLanguage] = useState(locale)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const translation = translations.find((text) => text.locale === language)
  const languages = Array.from(
    new Set([...languageOptions.map((option) => option.value), ...translations.map((text) => text.locale), locale]),
  )
  function update(value: Partial<SkinBadgeTranslation>) {
    setDirty(true)
    setTranslations((current) => current.map((text) => (text.locale === language ? { ...text, ...value } : text)))
  }
  function close() {
    if (!busy && !uploading && (!dirty || window.confirm("Có thay đổi nhãn chưa lưu. Đóng phần chỉnh sửa?"))) onClose()
  }
  useEffect(() => {
    if (!dirty && !busy && !uploading) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty, busy, uploading])
  async function save() {
    setError("")
    if (translations.some((text) => !text.displayName.trim())) {
      setError("Mỗi bản dịch đã thêm cần có tên hiển thị.")
      return
    }
    setBusy(true)
    try {
      const value = {
        ...(!badge ? { regionCode } : {}),
        kind,
        translations: translations.map((text) => ({ ...text, displayName: text.displayName.trim() })),
        ...(!badge ? { groupId } : {}),
      }
      await createCharacterImageApi(request).saveBadge(value, badge)
      await client.invalidateQueries({ queryKey: characterImageKeys.badges })
      onClose()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(580px,90vw)] flex-col overflow-y-auto sm:max-w-none"
            : "flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => {
          if (busy || uploading) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busy || uploading) event.preventDefault()
        }}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{badge ? "Chỉnh sửa nhãn trang phục" : "Tạo nhãn trang phục"}</SheetTitle>
          <SheetDescription>Tên và biểu tượng được lưu riêng theo từng ngôn ngữ.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          {!badge && (
            <label className="grid gap-1.5 text-sm">
              <span>Thị trường của ảnh</span>
              <select
                aria-label="Thị trường của ảnh"
                className={control}
                value={regionCode}
                disabled={busy || uploading}
                onChange={(event) => {
                  setRegionCode(event.target.value)
                  setDirty(true)
                }}
              >
                {!regions.data?.length && <option value="vn">Việt Nam</option>}
                {regions.data?.map((region) => (
                  <option key={region.id} value={region.code.toLowerCase()} disabled={!region.available}>
                    {region.displayName}
                    {!region.available ? " · Chưa hỗ trợ" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!badge && (
            <BadgeGroupSelect
              value={groupId}
              locale={locale}
              request={request}
              disabled={busy || uploading}
              onChange={(value) => {
                setGroupId(value)
                setDirty(true)
              }}
            />
          )}
          <label className="grid gap-1.5 text-sm">
            <span>Phân loại</span>
            <select
              className={control}
              value={kind}
              disabled={busy}
              onChange={(event) => {
                setKind(event.target.value as BadgeKind)
                setDirty(true)
              }}
            >
              {Object.entries(badgeKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-3 rounded-xl border p-4">
            <label className="grid gap-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Languages className="size-4" />
                Ngôn ngữ bản dịch
              </span>
              <select
                className={control}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={busy || uploading}
              >
                {languages.map((value) => (
                  <option key={value} value={value}>
                    {languageOptions.find((option) => option.value === value)?.label ?? value}
                    {translations.some((text) => text.locale === value) ? " · Đã có" : " · Chưa có"}
                  </option>
                ))}
              </select>
            </label>
            {translation ? (
              <>
                <Field
                  label="Tên hiển thị"
                  value={translation.displayName}
                  onChange={(displayName) => update({ displayName })}
                  disabled={busy}
                  maxLength={200}
                />
                <div className="space-y-2">
                  <p className="text-sm">Biểu tượng · {language}</p>
                  <AssetPicker
                    key={language}
                    semanticType="SKIN_BADGE"
                    value={translation.iconAssetId}
                    onChange={(iconAssetId) => update({ iconAssetId })}
                    onBusyChange={setUploading}
                  />
                  {translation.iconAssetId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy || uploading}
                      onClick={() => update({ iconAssetId: null })}
                    >
                      Bỏ biểu tượng của bản dịch này
                    </Button>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">
                    Bản dịch chưa có biểu tượng sẽ giữ chỗ trống, không lấy biểu tượng từ ngôn ngữ khác.
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">Chưa có bản dịch {language}.</p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setTranslations((current) => [...current, { locale: language, displayName: "", iconAssetId: null }])
                    setDirty(true)
                  }}
                >
                  <Plus className="size-4" />
                  Thêm bản dịch này
                </Button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {translations.length} bản dịch. Các ngôn ngữ khác được giữ nguyên khi lưu.
          </p>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={!dirty || busy || uploading} onClick={save}>
            {(busy || uploading) && <LoaderCircle className="size-4 animate-spin" />}Lưu nhãn trang phục
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
