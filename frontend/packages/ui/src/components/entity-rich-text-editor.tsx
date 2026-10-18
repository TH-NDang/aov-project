import * as React from "react"
import { type EntityReference } from "../lib/entity-rich-text"
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
const kinds = { hero: "Tướng", item: "Trang bị", term: "Thuật ngữ" }
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
}: EntityRichTextEditorProps) {
  const limit = Math.max(0, Math.min(100000, maxLength))
  const id = React.useId()
  const area = React.useRef<HTMLTextAreaElement>(null)
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
  const choices = React.useMemo(
    () => referenceChoices(entities, locale, fallbackLocale, picker ? query : (mention?.query ?? "")),
    [entities, locale, fallbackLocale, picker, query, mention?.query],
  )
  const options = choices.slice(0, 8)
  const open = (!!mention || picker) && !isComposing
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
      className="min-w-0 space-y-2"
      data-slot="entity-rich-text-editor"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPicker(false)
          setDismissed(true)
        }
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">
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
        Gõ @ sau khoảng trắng để chọn tham chiếu. Chọn văn bản rồi dùng thanh định dạng; Ctrl/⌘ B, I, Z. Nguồn được lưu
        nguyên với thẻ an toàn.
      </p>
      {open && (
        <div className="space-y-2 rounded-md border bg-popover p-2 text-popover-foreground">
          {picker && (
            <input
              autoFocus
              aria-label={`Tìm tham chiếu ${label}`}
              className="w-full rounded border bg-background p-2 text-sm"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={listKeys}
            />
          )}
          <p className="text-xs text-muted-foreground" role="status">
            {choices.length} kết quả · hiển thị tối đa 8 · ↑↓ chọn, Enter chèn, Esc đóng
          </p>
          <div
            role="listbox"
            id={`${id}-options`}
            aria-label={`Gợi ý tham chiếu ${label}`}
            className="max-h-64 overflow-y-auto"
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
            onClick={() => {
              setPicker(false)
              setDismissed(true)
              area.current?.focus()
            }}
          >
            Đóng gợi ý
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-xs text-destructive">
          {notice}
        </p>
      )}
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
    </div>
  )
}
