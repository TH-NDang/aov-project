import * as React from "react"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"
import { cn } from "@aov/ui/lib/utils"
import {
  entityKindLabel,
  type EntityIndex,
  type EntityReference,
  type EntityTranslation,
} from "../lib/entity-rich-text"
import { insertReference, referenceReplacementRange, type EntityReferenceSearch } from "../lib/entity-rich-text-editor"
import { EntityReferenceInput, type EntityReferenceInputHandle } from "./entity-reference-input"
import type { EntityIconResolver } from "./entity-rich-text"
import { ReferenceOptionRow, ReferenceSuggestions, useCaretAnchor } from "./rich-text-editor/reference-suggestions"
import { useEditorHistory } from "./rich-text-editor/use-editor-history"
import { useReferenceSuggestions } from "./rich-text-editor/use-reference-suggestions"

const noEntities: EntityReference[] = []
const noKinds: [string, string][] = []

export interface MentionInputProps {
  /** What the field is for; it is read out, not shown. */
  label: string
  value: string
  onChange: (value: string) => void
  /** Enter sends, Shift+Enter starts a line, as in a chat. Without it Enter starts a line. */
  onSubmit?: () => void
  locale: string
  fallbackLocale?: string
  /** What an "@" can name. */
  entities?: EntityReference[]
  /** Marks the names the text will link once it is shown. */
  index?: EntityIndex
  /** Looks further than `entities`. */
  searchReferences?: EntityReferenceSearch
  resolveIcon?: EntityIconResolver
  placeholder?: string
  disabled?: boolean
  required?: boolean
  maxLength?: number
  className?: string
  inputClassName?: string
}

/**
 * A field for what people write (a post, a comment, a message): an "@" opens the list of what they can name, and the
 * choice stands in the text as one piece. Its value is plain text with `<ref=kind:id>name</ref>` for each choice, which
 * `parseRichText` reads with `markup: "references"`. Unlike the editor of game text it has no formatting.
 */
export function MentionInput({
  label,
  value,
  onChange,
  onSubmit,
  locale,
  fallbackLocale = "vi-VN",
  entities = noEntities,
  index,
  searchReferences,
  resolveIcon,
  placeholder,
  disabled,
  required,
  maxLength = 20000,
  className,
  inputClassName,
}: MentionInputProps) {
  const text = useLocaleText()
  const id = React.useId()
  const area = React.useRef<EntityReferenceInputHandle>(null)
  const popup = React.useRef<HTMLDivElement>(null)
  const field = React.useRef<HTMLDivElement>(null)
  const composing = React.useRef(false)
  const [isComposing, setComposing] = React.useState(false)
  const history = useEditorHistory({
    value,
    onChange,
    limit: maxLength,
    area,
    onExternalChange: () => suggestions.dismiss(),
  })
  const { current, caret, commit } = history
  const suggestions = useReferenceSuggestions({
    value,
    caret,
    composing: isComposing,
    disabled,
    entities,
    locale,
    fallbackLocale,
    searchReferences,
    ranked: true,
  })
  const { mention, options, active, remote } = suggestions
  // Words after an "@" that name nothing are words; the list does not stay over them.
  const visible = suggestions.visible && (options.length > 0 || remote.loading || remote.error)
  const anchor = useCaretAnchor(area, visible, caret.end, value, entities)
  const choose = (position: number) => {
    const choice = options[position]
    if (!choice || !mention) return
    const range = referenceReplacementRange(current.current, mention, choice.entity, locale, fallbackLocale)
    const next = insertReference(current.current, range, choice.entity, choice.translation.name, false)
    if (!next) return
    // A space after the name lets the writer go on; one already there is kept.
    const spaced = /^\s/.test(next.value.slice(next.end)) ? next.value : insertAt(next.value, next.end, " ")
    commit({ value: spaced, start: next.end + 1, end: next.end + 1 })
    suggestions.close()
  }
  const listKeys = (event: React.KeyboardEvent) =>
    visible &&
    suggestions.handleKey(event, { composing: composing.current, choose, refocus: () => area.current?.focus() })
  const teams = React.useMemo(
    () =>
      new Map(
        entities.flatMap((entity) =>
          entity.kind === "team" ? [[entity.id, entity.translations[0]?.name] as const] : [],
        ),
      ),
    [entities],
  )
  /** What tells apart records of one name: the kind, then the short name or the team someone was with last. */
  const detail = (entity: EntityReference, translation: EntityTranslation) =>
    [entityKindLabel(entity.kind, locale), translation.shortNames?.[0] ?? teams.get(entity.teamIds?.[0] ?? "")]
      .filter(Boolean)
      .join(" · ")

  return (
    <div
      ref={field}
      className={cn("relative min-w-0", className)}
      data-slot="mention-input"
      onBlur={(event) => {
        const target = event.relatedTarget as Node | null
        if (!event.currentTarget.contains(target) && !popup.current?.contains(target)) suggestions.close()
      }}
    >
      {placeholder && !value && (
        <span aria-hidden="true" className="pointer-events-none absolute top-2 left-3 text-sm leading-7 opacity-60">
          {placeholder}
        </span>
      )}
      <EntityReferenceInput
        id={id}
        ref={area}
        className={cn("focus-visible:!ring-0", inputClassName)}
        value={value}
        entities={entities}
        index={index}
        autoRecognize={!!index}
        formatting={false}
        locale={locale}
        fallbackLocale={fallbackLocale}
        resolveIcon={resolveIcon}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        spellCheck
        aria-label={label}
        aria-placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={visible ? `${id}-options` : undefined}
        aria-activedescendant={
          visible && options.length ? `${id}-option-${Math.min(active, options.length - 1)}` : undefined
        }
        onSelectionChange={history.select}
        onHistoryUndo={(redo) => {
          if (history.undo(redo)) suggestions.close()
        }}
        onCompositionStart={() => {
          composing.current = true
          setComposing(true)
        }}
        onCompositionEnd={(snapshot) => {
          composing.current = false
          setComposing(false)
          const accepted = commit(snapshot, false)
          suggestions.reopen()
          return accepted
        }}
        onChange={(snapshot) => {
          const accepted = composing.current ? history.track(snapshot) : commit(snapshot, false)
          if (accepted !== false) suggestions.reopen()
          return accepted
        }}
        onKeyDown={(event) => {
          if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
          if (listKeys(event)) return
          if (event.key === "Enter" && !event.shiftKey && onSubmit) {
            event.preventDefault()
            onSubmit()
          } else if ((event.ctrlKey || event.metaKey) && !event.altKey && /^[zy]$/i.test(event.key)) {
            event.preventDefault()
            if (history.undo(event.key.toLowerCase() === "y" || event.shiftKey)) suggestions.close()
          }
        }}
      />
      <ReferenceSuggestions
        ref={popup}
        id={id}
        label={label}
        open={visible}
        searching={false}
        visible={visible}
        anchor={anchor}
        editor={field}
        kinds={noKinds}
        query={suggestions.query}
        onQueryChange={suggestions.search}
        count={options.length}
        active={active}
        loading={remote.loading}
        error={remote.error}
        onRetry={remote.retry}
        onOpenChange={(next) => {
          if (!next) suggestions.close()
        }}
        onListKeys={listKeys}
        onLoadMore={suggestions.loadMore}
        onClose={() => {
          suggestions.close()
          area.current?.focus()
        }}
      >
        {options.slice(0, suggestions.rendered).map(({ entity, translation }, position) => (
          <ReferenceOptionRow
            key={`${entity.kind}:${entity.id}`}
            id={id}
            index={position}
            count={options.length}
            chosen={position === Math.min(active, options.length - 1)}
            entity={entity}
            translation={translation}
            locale={locale}
            fallbackLocale={fallbackLocale}
            resolveIcon={resolveIcon}
            detail={detail(entity, translation)}
            onChoose={choose}
          />
        ))}
      </ReferenceSuggestions>
      {history.notice && (
        <p role="status" className="text-xs text-destructive">
          {text("Văn bản đã quá dài.", "The text is too long.")}
        </p>
      )}
    </div>
  )
}

const insertAt = (text: string, at: number, inserted: string) => text.slice(0, at) + inserted + text.slice(at)
