import { useRef, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { SkinFilterOption } from "./skin-api"
import { SkinIcon } from "./skin-icon"

export type FilterKind = "hero" | "badge"
export type FilterOption = SkinFilterOption & { image?: string }

const ALL = "__all"
const filterIcon = (kind: FilterKind) => (kind === "hero" ? "user" : "badge")

/** The picture of a choice: the hero's face or the tier's label, with a plain icon while there is none. */
export function FilterArt({ kind, image }: { kind: FilterKind; image?: string }) {
  const [failed, setFailed] = useState<string>()
  return (
    <span className={`wiki-skin-filter-art wiki-skin-filter-art-${kind}`} aria-hidden="true">
      {image && image !== failed ? (
        <WikiImage src={image} alt="" onError={() => setFailed(image)} />
      ) : (
        <SkinIcon name={filterIcon(kind)} size={16} />
      )}
    </span>
  )
}

/**
 * A list opened from the filter sheet shrinks the sheet behind it, and the sheet grows back only when the list is
 * dismissed, not when a choice closes it. This puts the sheet back to its size.
 */
function restoreSheet(from: HTMLElement | null) {
  const sheet = from?.closest<HTMLElement>("[data-vaul-drawer]")
  if (sheet) sheet.style.transform = "translate3d(0, 0, 0)"
}

/** One filter: what it is set to, the list to choose from and, once set, a way to clear it without opening the list. */
export function FilterSelect({
  label,
  allLabel,
  named = false,
  kind,
  value,
  options,
  onChange,
}: {
  label: string
  allLabel: string
  /** Under a label of its own the control says "all" while unset; alone in a row it carries its own name. */
  named?: boolean
  kind: FilterKind
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const root = useRef<HTMLDivElement>(null)
  const chosen = options.find((option) => option.code === value)
  const counts = new Map<string, number>()
  const occurrences = new Map<string, number>()
  options.forEach((option) => counts.set(option.name, (counts.get(option.name) || 0) + 1))
  // Labels that share a name are numbered, as only their pictures tell them apart.
  const choices = options.map((option) => {
    const occurrence = (occurrences.get(option.name) || 0) + 1
    occurrences.set(option.name, occurrence)
    return { ...option, variant: counts.get(option.name)! > 1 ? occurrence : null }
  })
  const name = label.toLocaleLowerCase(locale)
  return (
    <div ref={root} className="wiki-skin-filter" data-active={!!value || undefined}>
      <Select
        value={value || ALL}
        onValueChange={(next) => onChange(next === ALL ? "" : next)}
        onOpenChange={(open) => {
          if (!open) restoreSheet(root.current)
        }}
      >
        <SelectTrigger
          className="wiki-skin-select"
          aria-label={`${text("Lọc theo", "Filter by")} ${name}${value ? `: ${chosen?.name ?? value}` : ""}`}
          size="sm"
        >
          {!chosen && <SkinIcon name={filterIcon(kind)} size={16} />}
          <SelectValue placeholder={label}>{value ? undefined : named ? allLabel : label}</SelectValue>
        </SelectTrigger>
        <SelectContent drawerTitle={label} className="wiki-skin-select-menu" position="popper" align="start">
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {!!value && !chosen && <SelectItem value={value}>{value}</SelectItem>}
          {choices.map((option) => (
            <SelectItem value={option.code} key={option.code} textValue={option.name}>
              <span className="wiki-skin-filter-choice">
                <FilterArt kind={kind} image={option.image} />
                <span className="wiki-skin-filter-name">
                  {option.name}
                  {option.variant && (
                    <span className="wiki-skin-select-variant">
                      {text("Mẫu", "Variant")} {option.variant}
                    </span>
                  )}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!!value && (
        <button
          type="button"
          className="wiki-skin-filter-clear"
          aria-label={`${text("Bỏ lọc theo", "Clear the filter by")} ${name}`}
          title={`${text("Bỏ lọc theo", "Clear the filter by")} ${name}`}
          onClick={() => {
            // The button goes away with the choice, so the focus moves to the list it belonged to.
            root.current?.querySelector<HTMLElement>('[data-slot="select-trigger"]')?.focus()
            onChange("")
          }}
        >
          <SkinIcon name="close" size={14} />
        </button>
      )}
    </div>
  )
}

export function SkinSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const field = useRef<HTMLInputElement>(null)
  return (
    <div className="wiki-skin-search">
      <label>
        <SkinIcon name="search" size={18} />
        <span className="sr-only">{text("Tìm trang phục hoặc tướng", "Search skins or heroes")}</span>
        <input
          ref={field}
          type="search"
          enterKeyHint="search"
          placeholder={text("Tìm trang phục, tướng…", "Search skins, heroes…")}
          maxLength={120}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // The list filters as the reader types, so on a touch screen the search key only puts the keyboard away.
            if (event.key === "Enter" && window.matchMedia?.("(pointer: coarse)").matches) event.currentTarget.blur()
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          className="wiki-skin-search-clear"
          aria-label={text("Xóa từ khóa", "Clear the search")}
          onClick={() => {
            field.current?.focus()
            onChange("")
          }}
        >
          <SkinIcon name="close" size={14} />
        </button>
      )}
    </div>
  )
}
