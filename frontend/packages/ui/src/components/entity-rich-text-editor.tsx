import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { EntityReferenceInput, type EntityReferenceInputHandle } from "./entity-reference-input"
import { referenceFormatState, toggleReferenceFormat } from "../lib/reference-input-formatting"
import {
  entityKindLabels,
  referenceTranslation,
  validSkillReference,
  type EntityReference,
} from "../lib/entity-rich-text"
import {
  insertReference,
  createReferenceSearchIndex,
  referenceSuggestionAt,
  referenceReplacementRange,
  searchReferenceChoices,
  referenceSearchGroup,
  type EditorSnapshot,
  type TextSelection,
  type EntityReferenceSearch,
  type ReferenceSearchPage,
} from "../lib/entity-rich-text-editor"
import {
  EntityRichText,
  EntityReferenceArtwork,
  skillReferenceContext,
  type EntityIconResolver,
} from "./entity-rich-text"
import { Button } from "./button"

const empty: EntityReference[] = []
const kinds = entityKindLabels
const MemoizedRichText = React.memo(EntityRichText)
const suggestionBatchSize = 32
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
  searchReferences?: EntityReferenceSearch
}

function useReferenceSearch(
  searchReferences: EntityReferenceSearch | undefined,
  query: string,
  locale: string,
  open: boolean,
) {
  const key = `${locale}\0${query}`
  const request = React.useRef<AbortController | null>(null)
  const generation = React.useRef(0)
  const pending = React.useRef(false)
  const [result, setResult] = React.useState<ReferenceSearchPage & { key: string; loading: boolean; error: boolean }>({
    key: "",
    items: [],
    page: -1,
    size: 20,
    totalElements: 0,
    loading: false,
    error: false,
  })
  const group = referenceSearchGroup(query).kind
  const allowed = open && !!searchReferences && (!group || ["skill", "team", "player"].includes(group))
  const load = React.useCallback(
    async (page: number, run: number) => {
      if (!searchReferences || pending.current || run !== generation.current) return
      const controller = new AbortController()
      request.current = controller
      pending.current = true
      setResult((previous) => ({ ...previous, loading: true, error: false }))
      try {
        const response = await searchReferences({ query, locale, page, signal: controller.signal })
        if (controller.signal.aborted || run !== generation.current) return
        if (
          !Array.isArray(response.items) ||
          response.page !== page ||
          !Number.isInteger(response.size) ||
          response.size < 1 ||
          !Number.isInteger(response.totalElements) ||
          response.totalElements < 0
        )
          throw new Error("Invalid reference search page")
        setResult((previous) => ({
          ...response,
          items: page === 0 ? response.items.slice(0, 100) : [...previous.items, ...response.items.slice(0, 100)],
          key,
          loading: false,
          error: false,
        }))
      } catch {
        if (!controller.signal.aborted && run === generation.current)
          setResult((previous) => ({ ...previous, loading: false, error: true }))
      } finally {
        if (run === generation.current) pending.current = false
      }
    },
    [searchReferences, query, locale, key],
  )
  React.useEffect(() => {
    const run = ++generation.current
    request.current?.abort()
    pending.current = false
    setResult({ key, items: [], page: -1, size: 20, totalElements: 0, loading: allowed, error: false })
    const timer = allowed ? setTimeout(() => void load(0, run), 300) : undefined
    return () => {
      clearTimeout(timer)
      request.current?.abort()
      generation.current++
      pending.current = false
    }
  }, [allowed, key, load])
  const current = result.key === key && allowed ? result : undefined
  const hasMore = !!current && current.page >= 0 && (current.page + 1) * current.size < current.totalElements
  return {
    items: current?.items ?? empty,
    loading: current?.loading ?? false,
    error: current?.error ?? false,
    hasMore,
    loadMore: () => {
      if (hasMore && !current.loading && !current.error) void load(current.page + 1, generation.current)
    },
    retry: () => {
      if (allowed) void load(Math.max(0, result.page + 1), generation.current)
    },
  }
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
  searchReferences,
}: EntityRichTextEditorProps) {
  const limit = Math.max(0, Math.min(100000, maxLength))
  const id = React.useId()
  const area = React.useRef<EntityReferenceInputHandle>(null)
  const popup = React.useRef<HTMLDivElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const search = React.useRef<HTMLInputElement>(null)
  const editor = React.useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)
  const current = React.useRef(value)
  const selection = React.useRef<TextSelection>({ start: 0, end: 0 })
  const history = React.useRef<EditorSnapshot[]>([{ value, start: 0, end: 0 }])
  const position = React.useRef(0)
  const composing = React.useRef(false)
  const [caret, setCaret] = React.useState<TextSelection>({ start: 0, end: 0 })
  const [dismissed, setDismissed] = React.useState(false)
  const [picker, setPicker] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const [visibleSuggestions, setVisibleSuggestions] = React.useState(suggestionBatchSize)
  const [color, setColor] = React.useState("#2563eb")
  const [notice, setNotice] = React.useState("")
  const [isComposing, setComposing] = React.useState(false)
  const [selectedReferences, setSelectedReferences] = React.useState<EntityReference[]>([])
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const deferredPreview = React.useDeferredValue(renderPreview && previewOpen ? value : "")
  const updateCaret = React.useCallback((next: TextSelection) => {
    setCaret((previous) => (previous.start === next.start && previous.end === next.end ? previous : next))
  }, [])
  const formatting = React.useMemo(() => referenceFormatState(value, caret), [value, caret.start, caret.end])
  React.useEffect(() => {
    if (/^#[\da-f]{6}$/i.test(formatting.color ?? "")) setColor(formatting.color!)
    else if (/^#[\da-f]{3}$/i.test(formatting.color ?? "")) {
      setColor(
        `#${formatting
          .color!.slice(1)
          .split("")
          .map((part) => part + part)
          .join("")}`,
      )
    }
  }, [formatting.color])
  const [, refresh] = React.useReducer((n: number) => n + 1, 0)
  React.useLayoutEffect(() => {
    if (value !== current.current) {
      current.current = value
      history.current = [{ value, start: 0, end: 0 }]
      position.current = 0
      selection.current = { start: 0, end: 0 }
      updateCaret(selection.current)
      setDismissed(true)
    }
  }, [value])
  const restore = (snapshot: EditorSnapshot) => {
    current.current = snapshot.value
    onChange(snapshot.value)
    selection.current = { start: snapshot.start, end: snapshot.end }
    updateCaret(selection.current)
    setDismissed(true)
    setPicker(false)
    queueMicrotask(() => {
      area.current?.focus()
      area.current?.setSelectionRange(snapshot.start, snapshot.end)
    })
    refresh()
  }
  const commit = (snapshot: EditorSnapshot, focus = true) => {
    if (snapshot.value.length > limit && snapshot.value.length > current.current.length) {
      setNotice(`Nội dung vượt giới hạn ${limit.toLocaleString("vi-VN")} ký tự.`)
      return false
    }
    if (snapshot.value !== history.current[position.current]?.value) {
      history.current = history.current.slice(0, position.current + 1)
      history.current.push(snapshot)
      if (history.current.length > 100) history.current.shift()
      position.current = history.current.length - 1
    }
    current.current = snapshot.value
    onChange(snapshot.value)
    selection.current = { start: snapshot.start, end: snapshot.end }
    updateCaret(selection.current)
    setNotice("")
    if (focus)
      queueMicrotask(() => {
        area.current?.focus()
        area.current?.setSelectionRange(snapshot.start, snapshot.end)
      })
    refresh()
    return true
  }
  const undo = (redo = false) => {
    const next = position.current + (redo ? 1 : -1)
    if (next >= 0 && next < history.current.length) {
      position.current = next
      restore(history.current[next]!)
    }
  }
  const resolvedEntities = React.useMemo(
    () => [
      ...new Map(
        [...selectedReferences, ...entities].map((entity) => [`${entity.kind}:${entity.id}`, entity]),
      ).values(),
    ],
    [selectedReferences, entities],
  )
  const searchIndex = React.useMemo(
    () => createReferenceSearchIndex(resolvedEntities, locale, fallbackLocale),
    [resolvedEntities, locale, fallbackLocale],
  )
  const mention = !isComposing && !dismissed && !picker ? referenceSuggestionAt(value, caret, searchIndex) : null
  const searchQuery = picker ? query : (mention?.query ?? "")
  const open = (!!mention || picker) && !isComposing && !disabled
  React.useEffect(() => setVisibleSuggestions(suggestionBatchSize), [open, searchQuery])
  const remote = useReferenceSearch(searchReferences, searchQuery, locale, open)
  const options = React.useMemo(() => {
    if (!open) return []
    const local = searchReferenceChoices(searchIndex, searchQuery)
    const group = referenceSearchGroup(searchQuery).kind
    const choices = new Map(
      local.map(({ entity, translation }) => [`${entity.kind}:${entity.id}`, { entity, translation }]),
    )
    for (const entity of remote.items) {
      if (
        !entity ||
        !Object.hasOwn(kinds, entity.kind) ||
        !Array.isArray(entity.translations) ||
        (group && entity.kind !== group) ||
        (entity.kind === "skill" && !validSkillReference(entity))
      )
        continue
      const translation = referenceTranslation(entity, locale, fallbackLocale)
      if (translation?.name.trim()) choices.set(`${entity.kind}:${entity.id}`, { entity, translation })
    }
    return [...choices.values()]
  }, [open, searchIndex, locale, fallbackLocale, searchQuery, remote.items])
  const popupOpen = open && (picker || mention?.explicit || options.length > 0)
  const renderedSuggestions = Math.min(options.length, Math.max(visibleSuggestions, active + 1))
  const loadMoreSuggestions = () => {
    if (renderedSuggestions < options.length) setVisibleSuggestions(renderedSuggestions + suggestionBatchSize)
    else remote.loadMore()
  }
  const virtualAnchor = React.useMemo(
    () => ({ current: { getBoundingClientRect: () => anchorRect ?? area.current!.element!.getBoundingClientRect() } }),
    [anchorRect],
  )
  React.useLayoutEffect(() => {
    if (!open || !area.current?.element) return
    const input = area.current.element
    const view = input.ownerDocument.defaultView!
    const measure = () => {
      const rect = area.current?.caretRect(caret.end)
      if (rect) setAnchorRect(rect)
    }
    measure()
    let frame = 0
    const update = () => {
      view.cancelAnimationFrame(frame)
      frame = view.requestAnimationFrame(measure)
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    observer?.observe(input)
    view.addEventListener("resize", update)
    view.addEventListener("scroll", update, true)
    view.visualViewport?.addEventListener("resize", update)
    view.visualViewport?.addEventListener("scroll", update)
    return () => {
      view.cancelAnimationFrame(frame)
      observer?.disconnect()
      view.removeEventListener("resize", update)
      view.removeEventListener("scroll", update, true)
      view.visualViewport?.removeEventListener("resize", update)
      view.visualViewport?.removeEventListener("scroll", update)
    }
  }, [open, value, caret.end, resolvedEntities])
  React.useLayoutEffect(() => {
    if (!open) return
    const container = list.current
    const selected = container?.children[Math.min(active, options.length - 1)] as HTMLElement | undefined
    if (!container || !selected) return
    const bounds = container.getBoundingClientRect()
    const row = selected.getBoundingClientRect()
    if (row.bottom > bounds.bottom) container.scrollTop += row.bottom - bounds.bottom
    else if (row.top < bounds.top) container.scrollTop -= bounds.top - row.top
  }, [open, active, options.length])
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
      setPicker(false)
      setDismissed(true)
    } else setNotice("Chọn văn bản thuần, bên ngoài thẻ tham chiếu để chèn.")
  }
  const format = (kind: "b" | "i" | "color") => {
    const next = toggleReferenceFormat(current.current, selection.current, kind, color)
    if (next) {
      commit(next)
      setDismissed(true)
      setPicker(false)
    } else setNotice("Vùng chọn đang cắt qua thẻ hoặc nằm trong tham chiếu. Hãy chọn lại văn bản.")
  }
  const listKeys = (event: React.KeyboardEvent) => {
    if (!popupOpen || composing.current || event.nativeEvent.isComposing) return false
    if (event.key === "Escape") {
      event.preventDefault()
      setPicker(false)
      setDismissed(true)
      area.current?.focus()
      return true
    }
    if (!options.length) return false
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (event.key === "ArrowDown" && active >= options.length - 1 && remote.hasMore) {
        remote.loadMore()
        return true
      }
      setActive((n) => (n + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length)
      return true
    }
    if (event.key === "Enter") {
      event.preventDefault()
      choose(Math.min(active, options.length - 1))
      return true
    }
    return false
  }
  return (
    <div
      ref={editor}
      className="min-w-0 space-y-2"
      data-slot="entity-rich-text-editor"
      onBlur={(event) => {
        const target = event.relatedTarget as Node | null
        if (!event.currentTarget.contains(target) && !popup.current?.contains(target)) {
          setPicker(false)
          setDismissed(true)
        }
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
      <div
        role="toolbar"
        aria-label={`Định dạng ${label}`}
        className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1"
      >
        <div role="group" aria-label="Định dạng chữ" className="flex shrink-0 items-center gap-1 border-r pr-2">
          {(
            [
              ["b", "Đậm", "B"],
              ["i", "Nghiêng", "I"],
            ] as const
          ).map(([kind, name, text]) => (
            <Button
              key={kind}
              type="button"
              variant={(kind === "b" ? formatting.bold : formatting.italic) ? "secondary" : "ghost"}
              size="sm"
              aria-label={name}
              aria-pressed={kind === "b" ? formatting.bold : formatting.italic}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(kind)}
              className={kind === "b" ? "font-bold" : "italic"}
            >
              {text}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="Màu chữ" className="flex shrink-0 items-center gap-1 border-r px-1 pr-2">
          <label className="flex items-center gap-1 text-xs">
            Màu
            <input
              type="color"
              aria-label={`Màu chữ ${label}`}
              value={color}
              disabled={disabled}
              onChange={(e) => setColor(e.target.value)}
              className="size-8 cursor-pointer rounded"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => format("color")}
          >
            Áp dụng màu
          </Button>
        </div>
        <div role="group" aria-label="Chèn tham chiếu" className="flex shrink-0 items-center border-r px-1 pr-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPicker(!picker)
              setQuery("")
              setActive(0)
              setDismissed(true)
            }}
          >
            @ Tham chiếu
          </Button>
        </div>
        <div role="group" aria-label="Lịch sử chỉnh sửa" className="flex shrink-0 items-center gap-1 px-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Hoàn tác"
            disabled={disabled || position.current === 0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => undo()}
          >
            ↶
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Làm lại"
            disabled={disabled || position.current >= history.current.length - 1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => undo(true)}
          >
            ↷
          </Button>
        </div>
      </div>
      <EntityReferenceInput
        id={id}
        ref={area}
        className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm leading-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:opacity-50"
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
        aria-controls={popupOpen ? `${id}-options` : undefined}
        aria-activedescendant={
          popupOpen && options.length ? `${id}-option-${Math.min(active, options.length - 1)}` : undefined
        }
        onSelectionChange={(next) => {
          selection.current = next
          updateCaret(next)
          const snapshot = history.current[position.current]
          if (snapshot?.value === current.current) Object.assign(snapshot, next)
        }}
        onHistoryUndo={undo}
        onCompositionStart={() => {
          composing.current = true
          setComposing(true)
        }}
        onCompositionEnd={(snapshot) => {
          composing.current = false
          setComposing(false)
          const accepted = commit(snapshot, false)
          setDismissed(false)
          setActive(0)
          return accepted
        }}
        onChange={(snapshot) => {
          let accepted = true
          if (composing.current) {
            if (snapshot.value.length > limit && snapshot.value.length > current.current.length) return false
            current.current = snapshot.value
            onChange(snapshot.value)
            selection.current = snapshot
            updateCaret(snapshot)
          } else accepted = commit(snapshot, false)
          setDismissed(false)
          setActive(0)
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
        Tên và thuật ngữ đầy đủ được nhận diện tự động. Gõ @ để tìm và chèn thẻ tham chiếu.
      </p>
      <PopoverPrimitive.Root
        open={popupOpen}
        onOpenChange={(next) => {
          if (!next) {
            setPicker(false)
            setDismissed(true)
          }
        }}
      >
        <PopoverPrimitive.Anchor virtualRef={virtualAnchor} />
        {popupOpen && (
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              ref={popup}
              data-slot="entity-reference-suggestions"
              aria-label={`Chèn tham chiếu ${label}`}
              align="start"
              sideOffset={6}
              collisionPadding={8}
              onOpenAutoFocus={(event) => {
                event.preventDefault()
                if (picker) search.current?.focus()
              }}
              onCloseAutoFocus={(event) => event.preventDefault()}
              onInteractOutside={(event) => {
                if (editor.current?.contains(event.target as Node)) event.preventDefault()
              }}
              className="z-50 flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
              style={{ maxHeight: "min(24rem, var(--radix-popover-content-available-height))" }}
            >
              {picker && (
                <div role="group" aria-label="Nhóm tham chiếu" className="flex shrink-0 gap-1 overflow-x-auto">
                  {Object.entries(kinds)
                    .filter(
                      ([kind]) =>
                        (["skill", "team", "player"].includes(kind) && !!searchReferences) ||
                        entities.some((entity) => entity.kind === kind),
                    )
                    .map(([kind, name]) => (
                      <Button
                        key={kind}
                        type="button"
                        size="sm"
                        variant="ghost"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQuery(name)
                          setActive(0)
                        }}
                      >
                        {name}
                      </Button>
                    ))}
                </div>
              )}
              {picker && (
                <input
                  ref={search}
                  aria-label={`Tìm tham chiếu ${label}`}
                  className="w-full shrink-0 rounded border bg-background p-2 text-sm"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={listKeys}
                />
              )}
              <p className="shrink-0 px-1 text-xs text-muted-foreground" role="status">
                {options.length
                  ? `${options.length} kết quả · ↑↓ chọn · Enter chèn`
                  : remote.loading
                    ? "Đang tìm tham chiếu…"
                    : "Không có tham chiếu phù hợp"}
              </p>
              <div
                role="listbox"
                ref={list}
                id={`${id}-options`}
                aria-label={`Gợi ý tham chiếu ${label}`}
                className="min-h-0 max-h-64 overflow-y-auto overscroll-contain"
                aria-busy={remote.loading}
                onScroll={(event) => {
                  const element = event.currentTarget
                  if (element.scrollHeight - element.scrollTop - element.clientHeight < 80) loadMoreSuggestions()
                }}
                onWheel={(event) => {
                  const element = event.currentTarget
                  if (event.deltaY > 0 && element.scrollHeight - element.scrollTop - element.clientHeight < 80)
                    loadMoreSuggestions()
                }}
              >
                {options.slice(0, renderedSuggestions).map(({ entity, translation }, n) => {
                  const skill = skillReferenceContext(entity, locale, fallbackLocale)
                  return (
                    <button
                      key={`${entity.kind}:${entity.id}`}
                      id={`${id}-option-${n}`}
                      type="button"
                      role="option"
                      aria-posinset={n + 1}
                      aria-setsize={options.length}
                      aria-selected={n === Math.min(active, options.length - 1)}
                      aria-label={
                        skill
                          ? `${skill.ownerName} · ${translation.name}${skill.detail ? ` · ${skill.detail}` : ""}`
                          : undefined
                      }
                      className={`flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${n === Math.min(active, options.length - 1) ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(n)}
                    >
                      <EntityReferenceArtwork
                        entity={entity}
                        resolveIcon={resolveIcon}
                        className={skill ? "mr-1 size-9" : "size-8 rounded-md"}
                        defer
                      />
                      <span className="min-w-0">
                        {skill && (
                          <span className="block text-xs text-muted-foreground">
                            {skill.ownerName}
                            {skill.detail ? ` · ${skill.detail}` : ""}
                          </span>
                        )}
                        <span className="block break-words font-medium">{translation.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {kinds[entity.kind]} · {translation.locale}
                          {translation.locale !== locale ? " (dự phòng)" : ""}
                        </span>
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground" aria-hidden="true">
                        ↵
                      </span>
                    </button>
                  )
                })}
              </div>
              {options.length > 0 && remote.loading && (
                <p role="status" className="px-1 text-xs text-muted-foreground">
                  Đang tải thêm tham chiếu…
                </p>
              )}
              {remote.error && (
                <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                  <span>Chưa tải được tham chiếu.</span>
                  <Button type="button" size="sm" variant="ghost" onClick={remote.retry}>
                    Thử lại
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setPicker(false)
                  setDismissed(true)
                  area.current?.focus()
                }}
              >
                Đóng gợi ý
              </Button>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </PopoverPrimitive.Root>
      {notice && (
        <p role="status" className="text-xs text-destructive">
          {notice}
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
