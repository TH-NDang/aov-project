import { Field } from "./fields"
import { languageOptions } from "../users/profile-preference-picker"
import { ROLES, type Profile, type Role } from "./types"

export type ProfileEditorPart = "information" | "lore"

const emptyTranslation = (locale: string) => ({ locale, name: "", title: null, summary: null, lore: null })

/** Apply only the visible profile fields; other languages and panels keep their working copies. */
export function replaceProfilePart(
  target: Profile | null,
  source: Profile | null,
  part: ProfileEditorPart,
  locale: string,
): Profile | null {
  if (!target && !source) return null
  const base = target ?? { translations: [], roles: [], sources: [] }
  const current = base.translations.find((row) => row.locale === locale)
  const incoming = source?.translations.find((row) => row.locale === locale)
  const text = incoming ?? emptyTranslation(locale)
  const next = {
    ...(current ?? emptyTranslation(locale)),
    ...(part === "lore" ? { lore: text.lore } : { name: text.name, title: text.title, summary: text.summary }),
  }
  const translations = base.translations.filter((row) => row.locale !== locale)
  if (incoming || next.name || next.title || next.summary || next.lore) {
    if (current) translations.splice(base.translations.indexOf(current), 0, next)
    else translations.push(next)
  }
  const result = {
    ...base,
    translations,
    ...(part === "information" ? { roles: source?.roles ?? [], sources: source?.sources ?? [] } : {}),
  }
  return !source && !result.translations.length && !result.roles.length && !result.sources.length ? null : result
}

export function HeroProfileEditor({
  value,
  locale,
  part,
  onChange,
}: {
  value: Profile
  locale: string
  part: ProfileEditorPart
  onChange: (value: Profile) => void
}) {
  const translation = value.translations.find((row) => row.locale === locale)
  const text = translation ?? emptyTranslation(locale)
  const language = languageOptions.find((option) => option.value === locale)?.label ?? locale
  const changeText = (key: "name" | "title" | "summary" | "lore", content: string) => {
    const next = { ...text, [key]: content }
    onChange({
      ...value,
      translations: translation
        ? value.translations.map((row) => (row.locale === locale ? next : row))
        : [...value.translations, next],
    })
  }
  return (
    <div className="space-y-4">
      <p className="type-meta">Đang sửa nội dung {language}. Quản lý ngôn ngữ khác tại mục Bản dịch.</p>
      {part === "lore" ? (
        <Field
          label="Cốt truyện"
          value={text.lore ?? ""}
          multiline
          richTextLocale={locale}
          onChange={(v) => changeText("lore", v)}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên tướng" value={text.name} required onChange={(v) => changeText("name", v)} />
            <Field label="Danh hiệu" value={text.title ?? ""} onChange={(v) => changeText("title", v)} />
          </div>
          <Field
            label="Giới thiệu"
            value={text.summary ?? ""}
            multiline
            richTextLocale={locale}
            onChange={(v) => changeText("summary", v)}
          />
          <fieldset className="space-y-2">
            <legend className="type-label mb-2">Vai trò</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLES).map(([role, label]) => (
                <label
                  key={role}
                  className="type-body flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    checked={value.roles.includes(role as Role)}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        roles: event.target.checked
                          ? [...value.roles, role as Role]
                          : value.roles.filter((entry) => entry !== role),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  )
}
