import { useState, type ReactNode } from "react"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { SkinBadgePicker } from "../../../media/components/badges/skin-badge-picker"
import { AssetPicker } from "../assets/asset-picker"
import { Field } from "../editing/fields"
import { languageOptions } from "../../../users/profile-preference-picker"
import { HeroAsset } from "../editing/hero-asset"
import { retainImageOptions } from "../../model/assets/image-options"
import type { Skin, Skins } from "../../api/types"
import { slugify } from "@/lib/text"
import { pickTranslation } from "@aov/ui/lib/translation-fallback"
import { NativeSelect } from "@/components/native-select"

type SkinText = Skin["translations"][number]

const TEXT_FIELDS = [
  ["name", "Tên trang phục"],
  ["description", "Mô tả"],
  ["acquisitionNote", "Cách sở hữu"],
] as const

const IMAGE_FIELDS = [
  ["PORTRAIT", "portraitAssetId", "Chân dung"],
  ["SPLASH", "artAssetId", "Ảnh bìa"],
] as const

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="type-label mb-2 text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * The hero's skins as a list of rows: each shows its picture, name and key, and opens into its fields grouped by what
 * they describe. A new skin opens at once so it can be filled in.
 */
/** Lower case, no accents, words joined by hyphens, as in "tan-thuy-thu" for the Vietnamese sailor skin name. */
export function skinSlug(text: string) {
  return slugify(text)
}

/**
 * The hero part of the skin keys, read off the keys already there: `ata-tan-thuy-thu-1` named after "tan-thuy-thu" gives
 * `ata`. Keys follow `<hero>-<name>-<number>`, so a new skin can take the same form without anyone typing it.
 */
export function skinKeyPrefix(skins: readonly Skin[]) {
  for (const skin of skins) {
    for (const text of skin.translations) {
      const tail = new RegExp(`-${skinSlug(text.name)}-\\d+$`)
      if (skinSlug(text.name) && tail.test(skin.skinKey)) return skin.skinKey.replace(tail, "")
    }
  }
  return ""
}

/** A key for a skin of this name that no other skin of the hero uses yet. */
export function nextSkinKey(skins: readonly Skin[], name: string, own?: string) {
  const prefix = skinKeyPrefix(skins)
  const base = [prefix, skinSlug(name) || "trang-phuc"].filter(Boolean).join("-")
  const used = new Set(skins.map((skin) => skin.skinKey).filter((key) => key !== own))
  let number = 1
  while (used.has(`${base}-${number}`)) number++
  return `${base}-${number}`
}

export function HeroSkinsEditor({
  value,
  locale,
  onChange,
  focusKey,
  savedKeys,
}: {
  value: Skins
  locale: string
  onChange: (value: Skins) => void
  /** Opened from one skin's pencil: only that skin is shown until the editor asks for all of them. */
  focusKey?: string | null
  /** Keys already saved; they stay as they are because videos, prices and links point at them. */
  savedKeys?: ReadonlySet<string>
}) {
  const focusIndex = focusKey ? value.skins.findIndex((skin) => skin.skinKey === focusKey) : -1
  const [showAll, setShowAll] = useState(focusIndex < 0)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set(focusIndex < 0 ? [] : [focusIndex]))
  const setSkin = (index: number, change: (skin: Skin) => Skin) =>
    onChange({ ...value, skins: value.skins.map((skin, n) => (n === index ? change(skin) : skin)) })
  const setText = (index: number, textIndex: number, change: Partial<SkinText>) =>
    setSkin(index, (skin) => {
      const translations = skin.translations.map((text, n) => (n === textIndex ? { ...text, ...change } : text))
      const name = (translations.find((text) => text.locale === "vi-VN") ?? translations[0])?.name ?? ""
      const skinKey = savedKeys?.has(skin.skinKey) ? skin.skinKey : nextSkinKey(value.skins, name, skin.skinKey)
      return { ...skin, translations, skinKey }
    })
  const toggle = (index: number, next: boolean) =>
    setOpen((current) => {
      if (current.has(index) === next) return current
      const updated = new Set(current)
      if (next) updated.add(index)
      else updated.delete(index)
      return updated
    })

  function add() {
    onChange({
      ...value,
      skins: [
        ...value.skins,
        {
          skinKey: nextSkinKey(value.skins, ""),
          displayOrder: value.skins.length,
          artAssetId: null,
          rarityCode: null,
          translations: [{ locale, name: "", description: null, acquisitionNote: null }],
        },
      ],
    })
    toggle(value.skins.length, true)
    setShowAll(true)
  }

  async function remove(index: number, name: string) {
    const confirmed = await confirmAction({
      title: `Bỏ trang phục ${name}?`,
      description: "Trang phục chỉ rời khỏi bản nháp khi bạn lưu phần này; Hủy sẽ giữ lại như cũ.",
      confirmLabel: "Bỏ trang phục",
      cancelLabel: "Giữ lại",
    })
    if (!confirmed) return
    onChange({
      ...value,
      skins: value.skins.filter((_, n) => n !== index).map((skin, displayOrder) => ({ ...skin, displayOrder })),
    })
    // Rows after the removed one move up, so whatever was open no longer matches its index.
    setOpen(new Set())
  }

  return (
    <div className="@container space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showAll ? (
          <p className="type-meta">
            {value.skins.length ? `${value.skins.length} trang phục · bấm một dòng để mở` : "Chưa có trang phục."}
          </p>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            Xem tất cả {value.skins.length} trang phục
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={add}>
          <Plus className="size-4" />
          Thêm trang phục
        </Button>
      </div>
      <ul className="grid gap-2">
        {value.skins.map((skin, index) => {
          if (!showAll && index !== focusIndex) return null
          const text = pickTranslation(skin.translations, locale)
          const name = text?.name.trim() || skin.skinKey || `Trang phục ${index + 1}`
          return (
            <li key={index}>
              <details
                open={open.has(index)}
                onToggle={(event) => toggle(index, event.currentTarget.open)}
                className="group/skin rounded-lg border bg-card"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <HeroAsset
                    id={skin.portraitAssetId ?? skin.artAssetId}
                    className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-muted"
                    frameAspectRatio={3 / 4}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="type-body block truncate">
                      {text?.name.trim() ? (
                        <strong className="font-semibold">{text.name}</strong>
                      ) : (
                        <span className="text-muted-foreground">Chưa đặt tên</span>
                      )}
                    </span>
                    <span className="type-meta block truncate font-mono">{skin.skinKey || "Chưa có khóa"}</span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open/skin:rotate-180" />
                </summary>
                {/* Closed rows keep no fields mounted, so a long list stays quick to type in. */}
                {open.has(index) && (
                  <div className="space-y-6 border-t px-3 py-4">
                    <Group title="Nhận dạng">
                      <div className="grid gap-3 @min-[600px]:grid-cols-2">
                        <div className="grid content-start gap-1.5 text-sm">
                          <span>Khóa trang phục</span>
                          <code className="w-fit max-w-full truncate rounded-md bg-muted px-2 py-1.5">
                            {skin.skinKey}
                          </code>
                          <span className="type-meta">
                            {savedKeys?.has(skin.skinKey)
                              ? "Đã lưu nên giữ nguyên: video, giá và liên kết đều dùng khóa này."
                              : "Tự tạo theo tên tiếng Việt."}
                          </span>
                        </div>
                        <label className="grid gap-1.5 text-sm">
                          Bậc / nhãn trang phục
                          <SkinBadgePicker
                            value={skin.rarityCode}
                            locale={locale}
                            onChange={(rarityCode) => setSkin(index, (row) => ({ ...row, rarityCode }))}
                          />
                        </label>
                      </div>
                    </Group>
                    <Group title="Tên và mô tả">
                      {skin.translations.map((row, textIndex) => (
                        <div key={textIndex} className="space-y-3 rounded-lg border p-3">
                          <div className="grid gap-3 @min-[600px]:grid-cols-[10rem_minmax(0,1fr)]">
                            <label className="grid gap-1.5 text-sm">
                              Ngôn ngữ
                              <NativeSelect
                                className="w-full"
                                required
                                value={row.locale}
                                onChange={(event) => setText(index, textIndex, { locale: event.target.value })}
                              >
                                {!row.locale && <option value="">Chọn ngôn ngữ</option>}
                                {languageOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                    // One text per language: a language another text of this skin uses is taken.
                                    disabled={skin.translations.some(
                                      (other, n) => n !== textIndex && other.locale === option.value,
                                    )}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </NativeSelect>
                            </label>
                            <Field
                              label={TEXT_FIELDS[0][1]}
                              required
                              value={row.name}
                              onChange={(next) => setText(index, textIndex, { name: next })}
                            />
                          </div>
                          {TEXT_FIELDS.slice(1).map(([key, label]) => (
                            <Field
                              key={key}
                              label={label}
                              multiline={key === "description"}
                              richTextLocale={row.locale}
                              value={row[key] ?? ""}
                              onChange={(next) =>
                                setText(
                                  index,
                                  textIndex,
                                  key === "description" ? { description: next } : { acquisitionNote: next },
                                )
                              }
                            />
                          ))}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSkin(index, (row) => ({
                            ...row,
                            translations: [
                              ...row.translations,
                              { locale: "", name: "", description: null, acquisitionNote: null },
                            ],
                          }))
                        }
                      >
                        <Plus className="size-4" />
                        Thêm bản dịch trang phục
                      </Button>
                    </Group>
                    <Group title="Ảnh">
                      <div className="grid gap-4 @min-[600px]:grid-cols-2">
                        {IMAGE_FIELDS.map(([role, key, label]) => (
                          <div key={role} className="min-w-0 space-y-2">
                            <p className="type-label">{label}</p>
                            <AssetPicker
                              semanticType="HERO_SKIN_ART"
                              value={skin[key] ?? null}
                              onChange={(assetId) =>
                                setSkin(index, (row) => ({
                                  ...row,
                                  [key]: assetId,
                                  images: retainImageOptions(row.images, role, row[key], assetId),
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </Group>
                    <div className="flex justify-end border-t pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void remove(index, name)}
                      >
                        <Trash2 className="size-4" />
                        Bỏ trang phục
                      </Button>
                    </div>
                  </div>
                )}
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
