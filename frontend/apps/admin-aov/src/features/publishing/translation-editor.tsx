import { Field } from "./fields"
import { AdminRichTextPreview } from "../terminology/rich-text-field"
import { Check, CircleDashed } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { HeroAsset } from "./hero-content"
import type { Content, Profile, Skills, Skins } from "./types"

export type TranslatableSection = "PROFILE" | "SKILLS" | "SKINS"
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

export function TranslationEditor({
  section,
  value,
  sourceLocale,
  targetLocale,
  onChange,
}: {
  section: TranslatableSection
  value: NonNullable<Content[TranslatableSection]>
  sourceLocale: string
  targetLocale: string
  onChange: (value: NonNullable<Content[TranslatableSection]>) => void
}) {
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
  return (
    <div className="space-y-6" aria-label="Đối chiếu bản dịch">
      {!groups.length && <p className="text-sm text-muted-foreground">Chưa có nội dung trong nhóm này để dịch.</p>}
      {groups.map((group) => {
        const source = group.rows.find((row) => row.locale === sourceLocale)
        const target = group.rows.find((row) => row.locale === targetLocale)
        const complete = !!target?.name.trim() && (section !== "SKILLS" || !!target.description?.trim())
        return (
          <section key={group.key} className="space-y-4 rounded-xl border p-4 @min-[650px]:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-center gap-3">
                {section !== "PROFILE" && <HeroAsset id={group.image} className="size-10 shrink-0" />}
                <div className="min-w-0">
                  <h3 className="break-words font-medium">{source?.name || group.label}</h3>
                  {section !== "PROFILE" && (
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{group.key}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={complete ? "text-emerald-600" : "text-muted-foreground"}>
                {complete ? <Check className="size-3" /> : <CircleDashed className="size-3" />}
                {complete ? "Đủ nội dung chính" : target ? "Đang dịch" : "Chưa dịch"}
              </Badge>
            </div>
            {group.fields.map((field) => (
              <div key={field} className="grid gap-3 @min-[650px]:grid-cols-2">
                <div className="min-w-0 rounded-lg bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {labels[field]} · nguồn {sourceLocale}
                  </p>
                  <div className="whitespace-pre-wrap break-words text-sm leading-6">
                    {source?.[field] && (field === "name" || field === "title") ? (
                      source[field]
                    ) : source?.[field] ? (
                      <AdminRichTextPreview text={source[field]!} locale={sourceLocale} />
                    ) : (
                      "Chưa có nội dung nguồn."
                    )}
                  </div>
                </div>
                <Field
                  label={`${labels[field]} · ${targetLocale}`}
                  value={target?.[field] ?? ""}
                  required={field === "name" && !!target}
                  multiline={field !== "name" && field !== "title"}
                  richTextLocale={targetLocale}
                  onChange={(text) => onChange(updateTranslation(section, value, group.key, targetLocale, field, text))}
                />
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
