import { Field } from "./fields"
import { ReferenceLanguage, WithReference } from "../warehouse/warehouse-translation-panel"
import { useEffect, useRef, useState } from "react"
import { Button } from "@aov/ui/components/button"
import {
  missingTranslationFields,
  translationSource,
  sectionTextFields,
  type TranslationField,
  type TranslatableSection,
} from "./hero-translation-model"
import { Check, CircleDashed } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { HeroAsset } from "./hero-content"
import { translationLanguageLabel } from "./hero-translation-notice"
import type { Content, Profile, Skills, Skins } from "./types"

export type { TranslatableSection } from "./hero-translation-model"
type TextRow = {
  locale: string
  name: string
  title?: string | null
  summary?: string | null
  lore?: string | null
  description?: string | null
  acquisitionNote?: string | null
}
type TextField = Exclude<keyof TextRow, "locale">
const labels: Record<TextField, string> = {
  name: "Tên",
  title: "Danh hiệu",
  summary: "Giới thiệu",
  lore: "Cốt truyện",
  description: "Mô tả",
  acquisitionNote: "Cách sở hữu",
}

export function updateTranslation(
  section: TranslatableSection,
  value: NonNullable<Content[TranslatableSection]>,
  key: string,
  locale: string,
  field: TextField,
  text: string,
): NonNullable<Content[TranslatableSection]> {
  function replace<T extends TextRow>(rows: T[], empty: T): T[] {
    const current = rows.find((row) => row.locale === locale)
    const next = { ...(current ?? empty), [field]: text }
    return current ? rows.map((row) => (row.locale === locale ? next : row)) : [...rows, next]
  }
  if (section === "PROFILE") {
    const profile = value as Profile
    return {
      ...profile,
      translations: replace(profile.translations, { locale, name: "", title: null, summary: null, lore: null }),
    }
  }
  if (section === "SKILLS") {
    const skills = value as Skills
    return {
      ...skills,
      skills: skills.skills.map((skill) =>
        skill.skillKey !== key
          ? skill
          : {
              ...skill,
              translations: replace(skill.translations, { locale, name: "", description: "" }),
            },
      ),
    }
  }
  const skins = value as Skins
  return {
    ...skins,
    skins: skins.skins.map((skin) =>
      skin.skinKey !== key
        ? skin
        : {
            ...skin,
            translations: replace(skin.translations, { locale, name: "", description: null, acquisitionNote: null }),
          },
    ),
  }
}

/**
 * Writes one language of a hero part. The page shows only that language; each field opens a floating box with the
 * same text in a language the hero already has, English first, so translating needs no second column.
 */
export function TranslationEditor({
  section,
  value,
  sourceLocale,
  targetLocale,
  onChange,
  focusKey,
  focusField,
  onClearFocus,
}: {
  section: TranslatableSection
  value: NonNullable<Content[TranslatableSection]>
  sourceLocale: string
  targetLocale: string
  onChange: (value: NonNullable<Content[TranslatableSection]>) => void
  focusKey?: string
  focusField?: TranslationField
  onClearFocus?: () => void
}) {
  const editor = useRef<HTMLDivElement>(null)
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [activeRow, setActiveRow] = useState("")
  useEffect(() => {
    if (!focusKey || !focusField) return
    const group = [...(editor.current?.querySelectorAll<HTMLElement>("[data-translation-key]") ?? [])].find(
      (node) => node.dataset.translationKey === focusKey,
    )
    const field = [...(group?.querySelectorAll<HTMLElement>("[data-translation-field]") ?? [])].find(
      (node) => node.dataset.translationField === focusField,
    )
    field?.scrollIntoView?.({ block: "center", behavior: "smooth" })
    field
      ?.querySelector<HTMLElement>('input:not([type="color"]):not([type="hidden"]), textarea, [contenteditable="true"]')
      ?.focus({ preventScroll: true })
  }, [section, focusKey, focusField, targetLocale, sourceLocale])
  let groups: { key: string; label: string; rows: TextRow[]; fields: TextField[]; image?: string | null }[]
  if (section === "PROFILE")
    groups = [
      {
        key: "profile",
        label: "Thông tin tướng",
        rows: (value as Profile).translations,
        fields: ["name", "title", "summary", "lore"],
      },
    ]
  else if (section === "SKILLS")
    groups = (value as Skills).skills.map((skill) => ({
      key: skill.skillKey,
      label: skill.skillKey,
      rows: skill.translations,
      fields: ["name", "description"],
      image: skill.iconAssetId,
    }))
  else
    groups = (value as Skins).skins.map((skin) => ({
      key: skin.skinKey,
      label: skin.skinKey,
      rows: skin.translations,
      fields: ["name", "description", "acquisitionNote"],
      image: skin.artAssetId,
    }))
  const selectedGroup = groups.some((group) => group.key === focusKey) ? focusKey : undefined
  const shown = groups
    .filter((group) => !selectedGroup || group.key === selectedGroup)
    .map((group) => {
      const missing = missingTranslationFields(group.rows, targetLocale, group.fields)
      const fields = group.fields.filter(
        (field) =>
          !onlyMissing ||
          missing.some((entry) => entry.field === field) ||
          activeRow === `${group.key}:${field}` ||
          (group.key === selectedGroup && field === focusField),
      )
      return { ...group, missing, fields }
    })
    .filter((group) => group.fields.length)
  return (
    <div ref={editor} className="space-y-6" aria-label="Đối chiếu bản dịch">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="type-body flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(event) => {
              setActiveRow("")
              setOnlyMissing(event.target.checked)
            }}
          />
          Chỉ hiện phần chưa dịch
        </label>
        {selectedGroup && onClearFocus && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFocus}>
            Xem tất cả nội dung trong nhóm
          </Button>
        )}
      </div>
      {!groups.length && <p className="text-sm text-muted-foreground">Chưa có nội dung trong nhóm này để dịch.</p>}
      {!!groups.length && !shown.length && (
        <p className="type-body text-muted-foreground">Không còn phần chưa dịch trong nhóm này.</p>
      )}
      {shown.map((group) => {
        const source = group.rows.find((row) => row.locale === sourceLocale)
        const target = group.rows.find((row) => row.locale === targetLocale)
        const hasSource = sectionTextFields[section].some((field) => translationSource(group.rows, field))
        const complete = hasSource && !group.missing.length
        return (
          <section
            key={group.key}
            data-translation-key={group.key}
            className="space-y-4 rounded-xl border p-4 @min-[650px]:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-center gap-3">
                {section !== "PROFILE" && <HeroAsset id={group.image} className="size-10 shrink-0" />}
                <div className="min-w-0">
                  <h3 className="break-words font-medium">{source?.name || group.label}</h3>
                </div>
              </div>
              <Badge variant="outline" className={complete ? "text-emerald-600" : "text-muted-foreground"}>
                {complete ? <Check className="size-3" /> : <CircleDashed className="size-3" />}
                {complete
                  ? "Đủ nội dung"
                  : !hasSource
                    ? "Chưa có nội dung nguồn"
                    : `Còn ${group.missing.length} mục chưa dịch`}
              </Badge>
            </div>
            {/* The page reads in the language being written; a field shows another language in a floating box. */}
            <ReferenceLanguage translations={group.rows} editing={targetLocale}>
              {group.fields.map((field) => (
                <div
                  key={field}
                  data-translation-field={field}
                  onFocusCapture={() => setActiveRow(`${group.key}:${field}`)}
                  className="scroll-mt-24"
                >
                  <WithReference<TextRow> read={(other) => other?.[field]}>
                    <Field
                      label={`${labels[field]} · ${translationLanguageLabel(targetLocale)}`}
                      value={target?.[field] ?? ""}
                      required={field === "name" && !!target}
                      multiline={field !== "name" && field !== "title"}
                      richTextLocale={targetLocale}
                      onChange={(text) =>
                        onChange(updateTranslation(section, value, group.key, targetLocale, field, text))
                      }
                    />
                  </WithReference>
                </div>
              ))}
            </ReferenceLanguage>
          </section>
        )
      })}
    </div>
  )
}
