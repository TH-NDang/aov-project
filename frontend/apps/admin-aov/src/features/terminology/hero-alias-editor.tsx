import { useState } from "react"
import { Languages, LoaderCircle, PencilLine, Save } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { EntityReferenceIcon, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { errorMessage } from "@/lib/api/errors"
import { languageOptions } from "../users/profile-preference-picker"
import { normalizeHeroAliases } from "./hero-aliases"

export type HeroAliasUpdate = { locale: string; aliases: string[] }

function HeroAliasForm({
  canonical,
  custom,
  locale,
  resolveIcon,
  onSave,
}: {
  canonical: EntityReference
  custom?: EntityReference
  locale: string
  resolveIcon?: EntityIconResolver
  onSave: (updates: HeroAliasUpdate[]) => Promise<void>
}) {
  const [language, setLanguage] = useState(
    () =>
      canonical.translations.find((text) => text.locale.toLowerCase() === locale.toLowerCase())?.locale ??
      canonical.translations[0]?.locale ??
      locale,
  )
  const [initial] = useState(() =>
    Object.fromEntries(
      canonical.translations.map((text) => [
        text.locale,
        normalizeHeroAliases(
          custom?.translations.find((copy) => copy.locale.toLowerCase() === text.locale.toLowerCase())?.aliases ?? [],
        ),
      ]),
    ),
  )
  const [values, setValues] = useState(() =>
    Object.fromEntries(Object.entries(initial).map(([locale, aliases]) => [locale, aliases.join("\n")])),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const text = canonical.translations.find((text) => text.locale === language)
  const updates = Object.entries(values)
    .map(([locale, value]) => ({ locale, aliases: normalizeHeroAliases(value.split(/\r?\n/)) }))
    .filter((entry) => JSON.stringify(entry.aliases) !== JSON.stringify(initial[entry.locale]))
  async function save() {
    if (busy || !updates.length) return
    if (updates.some((entry) => entry.aliases.length > 20 || entry.aliases.some((alias) => alias.length > 200))) {
      setError("Tối đa 20 tên cho mỗi ngôn ngữ, mỗi tên không quá 200 ký tự.")
      return
    }
    setError("")
    setBusy(true)
    try {
      await onSave(updates)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityReferenceIcon entity={canonical} resolveIcon={resolveIcon} className="size-10 rounded-lg" />
        <div className="min-w-0">
          <strong className="block truncate text-sm">{text?.name || canonical.id}</strong>
          <span className="text-xs text-muted-foreground">Tên gọi khác theo ngôn ngữ</span>
        </div>
      </div>
      <label className="grid gap-1.5 text-xs">
        <span className="flex items-center gap-1.5">
          <Languages className="size-3.5" />
          Ngôn ngữ
        </span>
        <select
          aria-label="Ngôn ngữ tên gọi khác"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          disabled={busy}
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {canonical.translations.map((text) => (
            <option key={text.locale} value={text.locale}>
              {languageOptions.find((option) => option.value === text.locale)?.label || text.locale}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs">
        Tên gọi khác, mỗi dòng một tên
        <Textarea
          aria-label="Tên gọi khác của tướng"
          rows={3}
          maxLength={4200}
          placeholder="Ví dụ: flo"
          value={values[language] ?? ""}
          disabled={busy}
          onChange={(event) => setValues((current) => ({ ...current, [language]: event.target.value }))}
          className="min-h-20 resize-y text-sm"
        />
      </label>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="button" size="sm" disabled={busy || !updates.length} onClick={() => void save()}>
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}Lưu tên gọi khác
      </Button>
    </div>
  )
}

export function HeroAliasEditor({
  canonical,
  custom,
  locale,
  disabled,
  resolveIcon,
  onSave,
}: {
  canonical: EntityReference
  custom?: EntityReference
  locale: string
  disabled: boolean
  resolveIcon?: EntityIconResolver
  onSave: (updates: HeroAliasUpdate[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const name =
    canonical.translations.find((text) => text.locale.toLowerCase() === locale.toLowerCase())?.name ||
    canonical.translations[0]?.name ||
    canonical.id
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-1 h-7 gap-1 px-1.5 text-[11px] text-muted-foreground"
          disabled={disabled}
          title={`Sửa tên gọi khác của ${name}`}
          aria-label={`Sửa tên gọi khác của ${name}`}
        >
          <PencilLine className="size-3" />
          Tên gọi khác
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(350px,calc(100vw-24px))] rounded-xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <HeroAliasForm
          key={`${canonical.id}:${locale}`}
          {...{ canonical, custom, locale, resolveIcon }}
          onSave={async (updates) => {
            await onSave(updates)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
