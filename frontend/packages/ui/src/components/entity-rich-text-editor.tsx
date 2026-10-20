import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { textareaCaretRect } from "../lib/textarea-caret"
import { entityKindLabels, type EntityReference } from "../lib/entity-rich-text"
import {
  insertReference,
  mentionAt,
  referenceChoices,
  wrapSelection,
  type EditorSnapshot,
  type TextSelection,
} from "../lib/entity-rich-text-editor"
import { EntityRichText, EntityReferenceIcon, type EntityIconResolver } from "./entity-rich-text"
import { Button } from "./button"

const empty: EntityReference[] = []
const kinds = entityKindLabels
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
}: EntityRichTextEditorProps) {
  const limit = Math.max(0, Math.min(100000, maxLength))
  const id = React.useId()
  const area = React.useRef<HTMLTextAreaElement>(null)
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
  const [color, setColor] = React.useState("#2563eb")
  const [notice, setNotice] = React.useState("")
  const [isComposing, setComposing] = React.useState(false)
  const [, refresh] = React.useReducer((n: number) => n + 1, 0)
  React.useLayoutEffect(() => {
    if (value !== current.current) {
      current.current = value
      history.current = [{ value, start: 0, end: 0 }]
      position.current = 0
      selection.current = { start: 0, end: 0 }
      setCaret(selection.current)
      setDismissed(true)
    }
  }, [value])
  const remember = () => {
    const input = area.current
    if (!input) return
    selection.current = { start: input.selectionStart, end: input.selectionEnd }
    setCaret(selection.current)
    const snapshot = history.current[position.current]
    if (snapshot?.value === current.current) Object.assign(snapshot, selection.current)
  }
  const restore = (snapshot: EditorSnapshot) => {
    current.current = snapshot.value
    onChange(snapshot.value)
    selection.current = { start: snapshot.start, end: snapshot.end }
    setCaret(selection.current)
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
      return
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
    setCaret(selection.current)
    setNotice("")
    if (focus)
      queueMicrotask(() => {
        area.current?.focus()
        area.current?.setSelectionRange(snapshot.start, snapshot.end)
      })
    refresh()
  }
  const undo = (redo = false) => {
    const next = position.current + (redo ? 1 : -1)
    if (next >= 0 && next < history.current.length) {
      position.current = next
      restore(history.current[next]!)
    }
  }
  React.useEffect(() => {
    const input = area.current
    const beforeInput = (event: InputEvent) => {
      if (composing.current || !["historyUndo", "historyRedo"].includes(event.inputType)) return
      event.preventDefault()
      undo(event.inputType === "historyRedo")
    }
    input?.addEventListener("select", remember)
    input?.addEventListener("beforeinput", beforeInput)
    return () => {
      input?.removeEventListener("select", remember)
      input?.removeEventListener("beforeinput", beforeInput)
    }
  })
  const mention = !isComposing && !dismissed && !picker ? mentionAt(value, caret) : null
  const options = React.useMemo(
    () => referenceChoices(entities, locale, fallbackLocale, picker ? query : (mention?.query ?? "")),
    [entities, locale, fallbackLocale, picker, query, mention?.query],
  )
  const open = (!!mention || picker) && !isComposing
  const virtualAnchor = React.useMemo(
    () => ({ current: { getBoundingClientRect: () => anchorRect ?? area.current!.getBoundingClientRect() } }),
    [anchorRect],
  )
  React.useLayoutEffect(() => {
    if (!open || !area.current) return
    const input = area.current
    const view = input.ownerDocument.defaultView!
    const measure = () => setAnchorRect(textareaCaretRect(input, caret.end))
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
  }, [open, value, caret.end])
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
    if (mention) range = { start: mention.start, end: mention.end }
    const next = insertReference(current.current, range, choice.entity, choice.translation.name, !mention)
    if (next) {
      commit(next)
      setPicker(false)
      setDismissed(true)
    } else setNotice("Chọn văn bản thuần, bên ngoài thẻ tham chiếu để chèn.")
  }
  const format = (kind: "b" | "i" | "color") => {
    const next = wrapSelection(current.current, selection.current, kind, color)
    if (next) {
      commit(next)
      setDismissed(true)
      setPicker(false)
    } else setNotice("Vùng chọn đang cắt qua thẻ hoặc nằm trong tham chiếu. Hãy chọn lại văn bản.")
  }
  const listKeys = (event: React.KeyboardEvent) => {
    if (!open || composing.current || event.nativeEvent.isComposing) return false
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
      <label htmlFor={id} className={hideLabel ? "sr-only" : "block text-sm font-medium"}>
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
              variant="ghost"
              size="sm"
              aria-label={name}
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
      <textarea
        id={id}
        ref={area}
        className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
        value={value}
        required={required}
        disabled={disabled}
        maxLength={limit}
        aria-describedby={`${id}-help`}
        aria-autocomplete="list"
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={
          open && options.length ? `${id}-option-${Math.min(active, options.length - 1)}` : undefined
        }
        onSelect={remember}
        onClick={remember}
        onKeyUp={remember}
        onCompositionStart={() => {
          composing.current = true
          setComposing(true)
        }}
        onCompositionEnd={(e) => {
          composing.current = false
          setComposing(false)
          const input = e.currentTarget
          commit({ value: input.value, start: input.selectionStart, end: input.selectionEnd }, false)
          setDismissed(false)
          setActive(0)
        }}
        onChange={(e) => {
          const input = e.currentTarget
          const snapshot = { value: input.value, start: input.selectionStart, end: input.selectionEnd }
          if (composing.current) {
            current.current = input.value
            onChange(input.value)
            selection.current = snapshot
            setCaret(snapshot)
          } else commit(snapshot, false)
          setDismissed(false)
          setActive(0)
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
        onPaste={(e) => {
          if (composing.current) return
          e.preventDefault()
          const input = e.currentTarget
          const text = e.clipboardData.getData("text/plain")
          commit({
            value: value.slice(0, input.selectionStart) + text + value.slice(input.selectionEnd),
            start: input.selectionStart + text.length,
            end: input.selectionStart + text.length,
          })
          setDismissed(true)
        }}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Gõ @ và tên hoặc nhóm, ví dụ @Trang bị, @Phù hiệu, @Ngọc. Bôi chọn để định dạng; Ctrl/⌘ B, I, Z.
      </p>
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setPicker(false)
            setDismissed(true)
          }
        }}
      >
        <PopoverPrimitive.Anchor virtualRef={virtualAnchor} />
        {open && (
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
                    .filter(([kind]) => entities.some((entity) => entity.kind === kind))
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
                {options.length ? `${options.length} kết quả · ↑↓ chọn · Enter chèn` : "Không có tham chiếu phù hợp"}
              </p>
              <div
                role="listbox"
                ref={list}
                id={`${id}-options`}
                aria-label={`Gợi ý tham chiếu ${label}`}
                className="min-h-0 max-h-64 overflow-y-auto overscroll-contain"
              >
                {options.map(({ entity, translation }, n) => {
                  return (
                    <button
                      key={`${entity.kind}:${entity.id}`}
                      id={`${id}-option-${n}`}
                      type="button"
                      role="option"
                      aria-selected={n === Math.min(active, options.length - 1)}
                      className={`flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${n === Math.min(active, options.length - 1) ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(n)}
                    >
                      <EntityReferenceIcon entity={entity} resolveIcon={resolveIcon} className="size-8 rounded-md" />
                      <span className="min-w-0">
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
        <details className="rounded-md border p-2 text-sm">
          <summary className="cursor-pointer">Xem trước nội dung</summary>
          <div className="mt-2 whitespace-pre-wrap break-words leading-7">
            <EntityRichText
              text={value}
              entities={entities}
              locale={locale}
              fallbackLocale={fallbackLocale}
              autoRecognize={autoRecognize}
              context="admin"
              resolveIcon={resolveIcon}
            />
          </div>
        </details>
      )}
    </div>
  )
}
