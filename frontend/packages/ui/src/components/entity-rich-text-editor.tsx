import * as React from "react"
import { EntityReferenceInput, type EntityReferenceInputHandle } from "./entity-reference-input"
import {
  referenceFormatState,
  selectsPartOfLine,
  styleReferenceParagraph,
  toggleReferenceFormat,
} from "../lib/reference-input-formatting"
import { isParagraphStyle, writeExampleTable } from "../lib/rich-text-blocks"
import { ExampleTableDialog } from "./rich-text-blocks"
import { entityKindLabels, type EntityReference } from "../lib/entity-rich-text"
import {
  insertReference,
  referenceReplacementRange,
  type TextSelection,
  type EntityReferenceSearch,
} from "../lib/entity-rich-text-editor"
import { EntityRichText, type EntityIconResolver } from "./entity-rich-text"
import { RichTextToolbar, type TextFormat } from "./rich-text-editor/rich-text-toolbar"
import { SelectionFormatBar, useSelectionBar } from "./rich-text-editor/selection-format-bar"
import { ReferenceOptionRow, ReferenceSuggestions, useCaretAnchor } from "./rich-text-editor/reference-suggestions"
import { useEditorHistory } from "./rich-text-editor/use-editor-history"
import { useReferenceSuggestions } from "./rich-text-editor/use-reference-suggestions"
import { remoteReferenceKinds } from "./rich-text-editor/use-reference-search"
import { cn } from "@aov/ui/lib/utils"

const empty: EntityReference[] = []
const MemoizedRichText = React.memo(EntityRichText)
export interface EntityRichTextEditorProps {
  label: string
  value: string
  onChange: (value: string) => void
  locale: string
  fallbackLocale?: string
  entities?: EntityReference[]
  disabled?: boolean
  required?: boolean
  autoRecognize?: boolean
  maxLength?: number
  resolveIcon?: EntityIconResolver
  renderPreview?: boolean
  hideLabel?: boolean
  compact?: boolean
  /** Paragraph types (note, info, example) for whole paragraphs. */
  allowBlocks?: boolean
  /** Inserting and editing example tables; follows `allowBlocks` unless set. */
  allowTables?: boolean
  className?: string
  inputClassName?: string
  searchReferences?: EntityReferenceSearch
}

/** A #rgb colour written out as #rrggbb, so the colour field can show it; other values are left out. */
function fullHex(color: string | undefined) {
  if (/^#[\da-f]{6}$/i.test(color ?? "")) return color!
  if (/^#[\da-f]{3}$/i.test(color ?? ""))
    return `#${color!
      .slice(1)
      .split("")
      .map((part) => part + part)
      .join("")}`
  return null
}

export function EntityRichTextEditor({
  label,
  value,
  onChange,
  locale,
  fallbackLocale = "vi-VN",
  entities = empty,
  disabled,
  required,
  autoRecognize = true,
  maxLength = 100000,
  resolveIcon,
  renderPreview = true,
  hideLabel = false,
  compact = false,
  allowBlocks = true,
  allowTables = allowBlocks,
  className,
  inputClassName,
  searchReferences,
}: EntityRichTextEditorProps) {
  const limit = Math.max(0, Math.min(100000, maxLength))
  const id = React.useId()
  const area = React.useRef<EntityReferenceInputHandle>(null)
  const popup = React.useRef<HTMLDivElement>(null)
  const editor = React.useRef<HTMLDivElement>(null)
  const composing = React.useRef(false)
  const [color, setColor] = React.useState("#2563eb")
  const [table, setTable] = React.useState<{ rows?: string[][]; range: TextSelection; original: string } | null>(null)
  const [isComposing, setComposing] = React.useState(false)
  const [selectedReferences, setSelectedReferences] = React.useState<EntityReference[]>([])
  // A value changed from outside closes the list; it runs after render, once the suggestions below exist.
  const history = useEditorHistory({ value, onChange, limit, area, onExternalChange: () => suggestions.dismiss() })
  const { current, selection, caret, commit } = history
  const editTable = React.useCallback(
    (rows: string[][], range: TextSelection) => setTable({ rows, range, original: current.current }),
    [current],
  )
  const formatting = React.useMemo(() => referenceFormatState(value, caret), [value, caret])
  React.useEffect(() => {
    const next = fullHex(formatting.color)
    if (next) setColor(next)
  }, [formatting.color])

  const resolvedEntities = React.useMemo(
    () => [
      ...new Map(
        [...selectedReferences, ...entities].map((entity) => [`${entity.kind}:${entity.id}`, entity]),
      ).values(),
    ],
    [selectedReferences, entities],
  )
  const suggestions = useReferenceSuggestions({
    value,
    caret,
    composing: isComposing,
    disabled,
    entities: resolvedEntities,
    locale,
    fallbackLocale,
    searchReferences,
  })
  const { mention, options, active } = suggestions
  const caretAnchor = useCaretAnchor(area, suggestions.open, caret.end, value, resolvedEntities)
  const undo = (redo = false) => {
    if (history.undo(redo)) suggestions.close()
  }
  const bar = useSelectionBar(area, caret, !!disabled || isComposing || suggestions.picker || !!table)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const deferredPreview = React.useDeferredValue(renderPreview && previewOpen ? value : "")

  const choose = (index: number) => {
    const choice = options[index]
    if (!choice) return
    let range = selection.current
    if (mention) range = referenceReplacementRange(current.current, mention, choice.entity, locale, fallbackLocale)
    const next = insertReference(current.current, range, choice.entity, choice.translation.name, !mention)
    if (next) {
      setSelectedReferences((previous) =>
        [
          ...previous.filter((entity) => entity.kind !== choice.entity.kind || entity.id !== choice.entity.id),
          choice.entity,
        ].slice(-500),
      )
      commit(next)
      suggestions.close()
    } else history.setNotice("Chọn văn bản thuần, bên ngoài thẻ tham chiếu để chèn.")
  }
  const format = (kind: TextFormat, withColor = color) => {
    const next = toggleReferenceFormat(current.current, selection.current, kind, withColor)
    if (next) {
      commit(next)
      suggestions.close()
    } else history.setNotice("Vùng chọn đang cắt qua thẻ hoặc nằm trong tham chiếu. Hãy chọn lại văn bản.")
  }
  const pickColor = (next: string) => {
    setColor(next)
    format("color", next)
  }
  const styleParagraph = (style: string) => {
    if (style !== "normal" && !isParagraphStyle(style)) return
    if (style === "note" && selectsPartOfLine(current.current, selection.current)) return format("muted")
    const next = styleReferenceParagraph(current.current, selection.current, style)
    if (next) commit(next)
  }
  const listKeys = (event: React.KeyboardEvent) =>
    suggestions.handleKey(event, { composing: composing.current, choose, refocus: () => area.current?.focus() })

  return (
    <div
      ref={editor}
      className={cn("min-w-0 space-y-2", className)}
      data-slot="entity-rich-text-editor"
      onFocus={bar.onFocus}
      onPointerDown={bar.onPointerDown}
      onBlur={(event) => {
        bar.onBlur(event)
        const target = event.relatedTarget as Node | null
        if (!event.currentTarget.contains(target) && !popup.current?.contains(target)) suggestions.close()
      }}
    >
      <label
        id={`${id}-label`}
        htmlFor={id}
        onClick={() => area.current?.focus()}
        className={hideLabel ? "sr-only" : "block text-sm font-medium"}
      >
        {label}
      </label>
      <RichTextToolbar
        label={label}
        text={value}
        formatting={formatting}
        color={color}
        compact={compact}
        allowBlocks={allowBlocks}
        allowTables={allowTables}
        disabled={disabled}
        composing={isComposing}
        hasSelection={caret.start !== caret.end}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onStyle={styleParagraph}
        onInsertTable={() => {
          const end = selection.current.end
          setTable({ range: { start: end, end }, original: current.current })
        }}
        onFormat={format}
        onPickColor={pickColor}
        onToggleReferences={() => suggestions.openPicker(!suggestions.picker)}
        onUndo={undo}
      />
      {table && (
        <ExampleTableDialog
          initial={table.rows}
          onCancel={() => {
            setTable(null)
            area.current?.focus()
          }}
          onSave={(rows) => {
            if (disabled || current.current !== table.original || area.current?.element?.closest("fieldset[disabled]"))
              return false
            const token = writeExampleTable(rows)
            const { start, end } = table.range
            const pos = start + token.length
            if (
              !commit({
                value: current.current.slice(0, start) + token + current.current.slice(end),
                start: pos,
                end: pos,
              })
            )
              return false
            setTable(null)
            return true
          }}
        />
      )}
      <EntityReferenceInput
        onEditTable={allowTables ? editTable : undefined}
        id={id}
        ref={area}
        className={cn(
          "min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm leading-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:opacity-50",
          inputClassName,
        )}
        value={value}
        entities={resolvedEntities}
        autoRecognize={autoRecognize}
        locale={locale}
        fallbackLocale={fallbackLocale}
        resolveIcon={resolveIcon}
        required={required}
        disabled={disabled}
        maxLength={limit}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        aria-autocomplete="list"
        aria-controls={suggestions.visible ? `${id}-options` : undefined}
        aria-activedescendant={
          suggestions.visible && options.length ? `${id}-option-${Math.min(active, options.length - 1)}` : undefined
        }
        onSelectionChange={history.select}
        onHistoryUndo={undo}
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
          let accepted = true
          if (composing.current) {
            if (!history.track(snapshot)) return false
          } else accepted = commit(snapshot, false)
          suggestions.reopen()
          return accepted
        }}
        onKeyDown={(e) => {
          if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return
          if (listKeys(e)) return
          if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase()
            if (key === "z" || key === "y") {
              e.preventDefault()
              undo(key === "y" || e.shiftKey)
            } else if (key === "b" || key === "i") {
              e.preventDefault()
              format(key)
            }
          }
        }}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {compact
          ? "Gõ @ để chèn tham chiếu · Bôi đen rồi bấm Bỏ qua để tắt nhận diện một đoạn."
          : "Tên và thuật ngữ đầy đủ được nhận diện tự động. Gõ @ để chèn tham chiếu; bôi đen rồi bấm Bỏ qua để tắt nhận diện một đoạn."}
      </p>
      <SelectionFormatBar
        ref={bar.ref}
        open={bar.open}
        area={area}
        text={value}
        formatting={formatting}
        color={color}
        colorsOpen={bar.colorsOpen}
        onColorsOpenChange={bar.setColorsOpen}
        onDismiss={bar.dismiss}
        onFormat={format}
        onPickColor={pickColor}
        onInsertReference={() => suggestions.openPicker(true)}
      />
      <ReferenceSuggestions
        ref={popup}
        id={id}
        label={label}
        open={suggestions.open}
        searching={suggestions.picker}
        visible={suggestions.visible}
        anchor={caretAnchor}
        editor={editor}
        kinds={Object.entries(entityKindLabels).filter(
          ([kind]) =>
            (remoteReferenceKinds.includes(kind) && !!searchReferences) ||
            entities.some((entity) => entity.kind === kind),
        )}
        query={suggestions.query}
        onQueryChange={suggestions.search}
        count={options.length}
        active={active}
        loading={suggestions.remote.loading}
        error={suggestions.remote.error}
        onRetry={suggestions.remote.retry}
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
        {options.slice(0, suggestions.rendered).map(({ entity, translation }, n) => (
          <ReferenceOptionRow
            key={`${entity.kind}:${entity.id}`}
            id={id}
            index={n}
            count={options.length}
            chosen={n === Math.min(active, options.length - 1)}
            entity={entity}
            translation={translation}
            locale={locale}
            fallbackLocale={fallbackLocale}
            resolveIcon={resolveIcon}
            onChoose={choose}
          />
        ))}
      </ReferenceSuggestions>
      {history.notice && (
        <p role="status" className="text-xs text-destructive">
          {history.notice}
        </p>
      )}
      {renderPreview && (
        <details
          className="rounded-md border p-2 text-sm"
          onToggle={(event) => setPreviewOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer">Xem trước nội dung</summary>
          {previewOpen && (
            <div className="mt-2 whitespace-pre-wrap break-words leading-7">
              <MemoizedRichText
                text={deferredPreview}
                entities={resolvedEntities}
                locale={locale}
                fallbackLocale={fallbackLocale}
                autoRecognize={autoRecognize}
                context="admin"
                resolveIcon={resolveIcon}
              />
            </div>
          )}
        </details>
      )}
    </div>
  )
}
