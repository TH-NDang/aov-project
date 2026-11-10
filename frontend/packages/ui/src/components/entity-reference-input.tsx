import * as React from "react"
import { createPortal } from "react-dom"
import { ArrowLeftRight } from "lucide-react"
import {
  defaultEntityColor,
  createEntityIndex,
  entityKindLabels,
  referenceTranslation,
  type EntityReference,
} from "../lib/entity-rich-text"
import type { EditorSnapshot, TextSelection } from "../lib/entity-rich-text-editor"
import {
  getReferenceInputSelection,
  referenceInputCaretRect,
  referenceInputParts,
  referenceInputNodes,
  referenceInputPlainText,
  readReferenceInputSnapshot,
  serializeReferenceInput,
  setReferenceInputSelection,
  type ReferenceInputPart,
  type ReferenceInputNode,
} from "../lib/reference-input-dom"
import {
  decorateReferences,
  passiveReferenceHighlights,
  registerPassiveHighlights,
  removeDecorations,
} from "../lib/reference-input-recognition"
import { inputAtomRange } from "../lib/reference-input-dom"
import { isParagraphStyle, paragraphStyles } from "../lib/rich-text-blocks"
import { ExampleTable } from "./rich-text-blocks"
import { EntityReferenceArtwork, skillReferenceContext, type EntityIconResolver } from "./entity-rich-text"

export type EntityReferenceInputHandle = {
  readonly element: HTMLDivElement | null
  focus(): void
  getSelection(): TextSelection
  setSelectionRange(start: number, end: number): void
  caretRect(position: number): DOMRect
}

export interface EntityReferenceInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "onCompositionStart" | "onCompositionEnd" | "onSelect"
> {
  value: string
  entities?: EntityReference[]
  locale: string
  fallbackLocale?: string
  resolveIcon?: EntityIconResolver
  disabled?: boolean
  autoRecognize?: boolean
  required?: boolean
  maxLength?: number
  onChange(snapshot: EditorSnapshot): boolean | void
  onSelectionChange?(selection: TextSelection): void
  onCompositionStart?(): void
  onCompositionEnd?(snapshot: EditorSnapshot): boolean | void
  onHistoryUndo?(redo: boolean): void
  onEditTable?(rows: string[][], selection: TextSelection): void
}

type ReferencePart = Exclude<ReferenceInputPart, { type: "text" }>
type Host = { element: HTMLSpanElement; part: ReferencePart }
const empty: EntityReference[] = []
const clipboardType = "application/x-aov-rich-text"

const sameSelection = (left: TextSelection, right: TextSelection) =>
  left.start === right.start && left.end === right.end

function selectionTouchesReference(root: HTMLElement) {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return false
  const range = selection.getRangeAt(0)
  return [range.startContainer, range.endContainer].some((node) => {
    const element = node.nodeType === 1 ? (node as Element) : node.parentElement
    const atom = element?.closest("[data-reference-token]")
    return !!atom && root.contains(atom)
  })
}

export const EntityReferenceInput = React.forwardRef<EntityReferenceInputHandle, EntityReferenceInputProps>(
  function EntityReferenceInput(
    {
      value,
      entities = empty,
      locale,
      fallbackLocale = "vi-VN",
      resolveIcon,
      disabled = false,
      autoRecognize = true,
      required = false,
      maxLength = 100000,
      onChange,
      onSelectionChange,
      onCompositionStart,
      onCompositionEnd,
      onHistoryUndo,
      onEditTable,
      onKeyDown,
      className = "",
      ...props
    },
    forwarded,
  ) {
    const element = React.useRef<HTMLDivElement>(null)
    const highlightKey = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")
    const recognitionIndex = React.useMemo(
      () => createEntityIndex(entities, locale, fallbackLocale),
      [entities, locale, fallbackLocale],
    )
    const clearHighlights = React.useRef(() => {})
    const [recognitionRevision, refreshRecognition] = React.useReducer((revision: number) => revision + 1, 0)
    // Icons of recognised names, drawn the way the published text shows them; they are never part of the source.
    const [decorations, setDecorations] = React.useState<{ element: HTMLSpanElement; entity: EntityReference }[]>([])
    React.useEffect(() => {
      const root = element.current
      if (!root || !autoRecognize || disabled) {
        clearHighlights.current()
        clearHighlights.current = () => {}
        if (root) removeDecorations(root)
        setDecorations((current) => (current.length ? [] : current))
        return
      }
      const timer = setTimeout(() => {
        if (composing.current) return
        const focused = inside()
        const selection = focused ? getReferenceInputSelection(root) : undefined
        clearHighlights.current()
        removeDecorations(root)
        const matches = passiveReferenceHighlights(root, recognitionIndex)
        const icons = decorateReferences(root, matches)
        clearHighlights.current = registerPassiveHighlights(root, matches, highlightKey)
        // Positions count source text only, so the caret returns to the same place around the new icons.
        if (selection) setReferenceInputSelection(root, selection.start, selection.end)
        setDecorations(icons)
      }, 350)
      return () => clearTimeout(timer)
    }, [value, recognitionIndex, autoRecognize, disabled, highlightKey, recognitionRevision])
    React.useEffect(() => () => clearHighlights.current(), [])
    const composing = React.useRef(false)
    const remembered = React.useRef<TextSelection>({ start: 0, end: 0 })
    const reported = React.useRef<TextSelection>({ start: 0, end: 0 })
    const callbacks = React.useRef({ onChange, onSelectionChange, onCompositionStart, onCompositionEnd, onHistoryUndo })
    const operations = React.useRef<{ replace(text: string): void; remove(backward: boolean): boolean } | null>(null)
    callbacks.current = { onChange, onSelectionChange, onCompositionStart, onCompositionEnd, onHistoryUndo }
    const current = React.useRef(value)
    current.current = value
    const painted = React.useRef<string | null>(null)
    const [hosts, setHosts] = React.useState<Host[]>([])
    const hostRegistry = React.useRef<Host[]>([])
    const [ancestorDisabled, setAncestorDisabled] = React.useState(false)
    const disabledRef = React.useRef(disabled)
    disabledRef.current = disabled
    const blocked = React.useCallback(() => disabledRef.current || !!element.current?.closest("fieldset[disabled]"), [])
    const inside = React.useCallback(() => {
      const root = element.current
      const selection = root?.ownerDocument.getSelection()
      return !!root && !!selection?.rangeCount && root.contains(selection.getRangeAt(0).commonAncestorContainer)
    }, [])
    const notifySelection = React.useCallback((next: TextSelection) => {
      remembered.current = next
      if (sameSelection(reported.current, next)) return
      reported.current = { start: next.start, end: next.end }
      callbacks.current.onSelectionChange?.(next)
    }, [])
    const remember = React.useCallback(() => {
      if (!element.current || !inside()) return
      const next = getReferenceInputSelection(element.current)
      notifySelection(next)
    }, [inside, notifySelection])
    const paint = React.useCallback((text: string, selection?: TextSelection) => {
      const root = element.current
      if (!root || composing.current) return
      const next: Host[] = []
      const document = root.ownerDocument
      const isTail = (node: Element) => node.tagName === "BR" && node.hasAttribute("data-input-tail")
      const ensureTail = (container: HTMLElement): boolean => {
        let changed = false
        for (const child of container.children)
          if (child.hasAttribute("data-format-open")) changed = ensureTail(child as HTMLElement) || changed
        const children = [...container.childNodes].filter((node) =>
          node.nodeType === 3 ? !!node.nodeValue : node.nodeType !== 1 || !isTail(node as Element),
        )
        const last = children.at(-1)
        const required =
          (container === root && !text) ||
          (container !== root && !children.length) ||
          (last?.nodeType === 3 && last.nodeValue?.endsWith("\n"))
        const existing = [...container.children].filter(isTail)
        const keep = required && existing.length === 1 && container.lastChild === existing[0]
        if (keep) return changed
        for (const tail of existing) tail.remove()
        changed = existing.length > 0 || changed
        if (required) {
          const tail = document.createElement("br")
          tail.setAttribute("data-input-tail", "")
          tail.setAttribute("aria-hidden", "true")
          container.append(tail)
          changed = true
        }
        return changed
      }
      const nodes = referenceInputNodes(text)
      const expected: ReferencePart[] = []
      const formats: Extract<ReferenceInputNode, { type: "format" }>[] = []
      const collect = (parts: ReferenceInputNode[]) => {
        for (const part of parts) {
          if (part.type === "reference" || part.type === "exampleTable") expected.push(part)
          if (part.type === "format") {
            formats.push(part)
            collect(part.children)
          }
        }
      }
      collect(nodes)
      const atoms = [...root.querySelectorAll<HTMLElement>("[data-reference-token]")]
      const actualFormats = [...root.querySelectorAll<HTMLElement>("[data-format-open]")]
      const registered = new Map(hostRegistry.current.map((host) => [host.element, host]))
      const normalized = (container: HTMLElement): boolean =>
        [...container.childNodes].every((node) => {
          if (node.nodeType === 3) return true
          if (node.nodeType !== 1) return false
          const child = node as HTMLElement
          if (isTail(child) || registered.has(child) || child.hasAttribute("data-decoration")) return true
          return child.hasAttribute("data-format-open") && normalized(child)
        })
      const snapshot = normalized(root) ? readReferenceInputSnapshot(root) : undefined
      if (
        snapshot?.value === text &&
        atoms.length === expected.length &&
        atoms.every((atom, index) => atom.getAttribute("data-reference-token") === expected[index]!.token) &&
        actualFormats.length === formats.length &&
        actualFormats.every(
          (format, index) =>
            format.getAttribute("data-format-open") === formats[index]!.open &&
            format.getAttribute("data-format-close") === formats[index]!.close,
        )
      ) {
        const retained = atoms.map((atom) => registered.get(atom as HTMLSpanElement)!)
        if (
          retained.length !== hostRegistry.current.length ||
          retained.some((host, index) => host !== hostRegistry.current[index])
        ) {
          hostRegistry.current = retained
          setHosts(retained)
        }
        painted.current = text
        if (root.getAttribute("data-empty") !== String(!text)) root.setAttribute("data-empty", String(!text))
        const tailChanged = ensureTail(root)
        if (selection && (tailChanged || !sameSelection(selection, snapshot) || selectionTouchesReference(root)))
          setReferenceInputSelection(root, selection.start, selection.end)
        return
      }
      const reusable = new Map<string, Host[]>()
      for (const host of hostRegistry.current) {
        const group = reusable.get(host.part.token) ?? []
        group.push(host)
        reusable.set(host.part.token, group)
      }
      const build = (parts: ReferenceInputNode[]): Node[] =>
        parts.flatMap((part): Node[] => {
          if (part.type === "text") return [document.createTextNode(part.text)]
          if (part.type === "format") {
            const format = document.createElement(part.tag === "b" ? "strong" : part.tag === "i" ? "em" : "span")
            format.setAttribute("data-format-open", part.open)
            format.setAttribute("data-format-close", part.close)
            if (part.tag === "b") format.className = "font-bold"
            if (part.tag === "i") format.className = "italic"
            if (part.tag === "muted") format.className = "text-muted-foreground"
            if (part.tag === "noauto") {
              format.className = "rounded-sm bg-muted/70 outline outline-1 outline-dashed outline-border"
              format.title = "Đoạn này bỏ qua tự nhận diện. Bôi đen và bấm Bỏ qua để bật lại."
            }
            if (isParagraphStyle(part.tag)) {
              format.className = paragraphStyles[part.tag].classes
              if (part.tag !== "note") {
                format.setAttribute("data-heading", paragraphStyles[part.tag].label)
                format.className +=
                  " before:block before:text-xs before:font-semibold before:content-[attr(data-heading)]"
              }
            }
            if (part.color) format.style.color = part.color
            format.append(...build(part.children))
            if (!format.childNodes.length) format.append(document.createTextNode(""))
            return [format]
          }
          const retained = reusable.get(part.token)?.shift()
          const host = retained?.element ?? document.createElement("span")
          if (!retained) {
            host.contentEditable = "false"
            host.setAttribute("contenteditable", "false")
            host.setAttribute("data-reference-token", part.token)
            if (part.type === "reference") {
              host.setAttribute("data-reference-kind", part.kind)
              host.setAttribute("data-reference-id", part.id)
            }
            host.setAttribute("draggable", "false")
            host.className =
              part.type === "exampleTable"
                ? "my-1 block max-w-full"
                : "mx-0.5 inline-flex max-w-full select-all items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 align-baseline text-sm"
          }
          next.push(retained ?? { element: host, part })
          return [document.createTextNode(""), host, document.createTextNode("")]
        })
      const fragments = build(nodes)
      if (!fragments.length) fragments.push(document.createTextNode(""))
      root.replaceChildren(...fragments)
      ensureTail(root)
      root.setAttribute("data-empty", String(!text))
      painted.current = text
      hostRegistry.current = next
      setHosts(next)
      if (selection) setReferenceInputSelection(root, selection.start, selection.end)
    }, [])
    React.useLayoutEffect(() => {
      if (composing.current || !element.current || painted.current === value) return
      paint(value, inside() ? getReferenceInputSelection(element.current) : undefined)
    }, [value, paint])
    React.useEffect(() => {
      const root = element.current
      if (!root) return
      const document = root.ownerDocument
      document.addEventListener("selectionchange", remember)
      const ancestors: Element[] = []
      let parent = root.parentElement
      while (parent) {
        if (parent.tagName === "FIELDSET") ancestors.push(parent)
        parent = parent.parentElement
      }
      const updateDisabled = () => setAncestorDisabled(!!root.closest("fieldset[disabled]"))
      updateDisabled()
      const observer = new root.ownerDocument.defaultView!.MutationObserver(updateDisabled)
      for (const ancestor of ancestors) observer.observe(ancestor, { attributes: true, attributeFilter: ["disabled"] })
      return () => {
        document.removeEventListener("selectionchange", remember)
        observer.disconnect()
      }
    }, [inside, remember])
    React.useImperativeHandle(
      forwarded,
      () => ({
        get element() {
          return element.current
        },
        focus: () => element.current?.focus(),
        getSelection: () =>
          element.current && inside() ? getReferenceInputSelection(element.current) : remembered.current,
        setSelectionRange: (start, end) => {
          remembered.current = { start, end }
          if (element.current) setReferenceInputSelection(element.current, start, end)
        },
        caretRect: (position) => referenceInputCaretRect(element.current!, position),
      }),
      [inside],
    )
    const commit = (snapshot: EditorSnapshot) => {
      if (blocked()) {
        paint(current.current, remembered.current)
        return
      }
      const accepted =
        !(snapshot.value.length > maxLength && snapshot.value.length > current.current.length) &&
        callbacks.current.onChange(snapshot) !== false
      if (accepted) {
        remembered.current = { start: snapshot.start, end: snapshot.end }
        paint(snapshot.value, remembered.current)
        notifySelection(remembered.current)
      } else paint(current.current, remembered.current)
    }
    const replace = (text: string) => {
      const root = element.current!
      if (!inside()) setReferenceInputSelection(root, remembered.current.start, remembered.current.end)
      else if (selectionTouchesReference(root)) {
        const selected = getReferenceInputSelection(root)
        setReferenceInputSelection(root, selected.start, selected.end)
      }
      const selection = root.ownerDocument.getSelection()
      if (!selection?.rangeCount) return
      const range = selection.getRangeAt(0)
      // Editing the DOM range keeps partially selected formatting wrappers balanced.
      range.deleteContents()
      if (range.startContainer.nodeType === 3) {
        const anchor = range.startContainer as Text
        const offset = range.startOffset
        anchor.insertData(offset, text)
        range.setStart(anchor, offset + text.length)
      } else {
        const inserted = root.ownerDocument.createTextNode(text)
        range.insertNode(inserted)
        range.setStart(inserted, text.length)
      }
      range.collapse(true)
      commit(readReferenceInputSnapshot(root))
    }
    const remove = (backward: boolean) => {
      const root = element.current!
      const range = readReferenceInputSnapshot(root)
      if (range.start !== range.end) {
        replace("")
        return true
      }
      let position = 0
      for (const part of referenceInputParts(range.value)) {
        const length = part.type === "text" ? part.text.length : part.token.length
        if (part.type !== "text" && range.start === position + (backward ? length : 0)) {
          setReferenceInputSelection(root, position, position + length)
          replace("")
          return true
        }
        position += length
      }
      const selection = root.ownerDocument.getSelection()
      if (!selection?.rangeCount) return false
      const caret = selection.getRangeAt(0)
      const container = caret.startContainer
      const neighbour =
        container.nodeType === 3
          ? backward
            ? caret.startOffset === 0
              ? container.previousSibling
              : null
            : caret.startOffset === (container as Text).length
              ? container.nextSibling
              : null
          : container.childNodes[backward ? caret.startOffset - 1 : caret.startOffset]
      if (
        !(neighbour instanceof root.ownerDocument.defaultView!.HTMLElement) ||
        !neighbour.hasAttribute("data-decoration")
      )
        return false
      if (backward ? range.start === 0 : range.start >= range.value.length) return true
      setReferenceInputSelection(
        root,
        backward ? range.start - 1 : range.start,
        backward ? range.start : range.start + 1,
      )
      replace("")
      return true
    }
    operations.current = { replace, remove }
    React.useEffect(() => {
      const root = element.current
      if (!root) return
      const beforeInput = (event: InputEvent) => {
        if (blocked()) {
          event.preventDefault()
          return
        }
        if (composing.current || event.isComposing) return
        if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
          event.preventDefault()
          callbacks.current.onHistoryUndo?.(event.inputType === "historyRedo")
        } else if (
          event.cancelable &&
          ["insertText", "insertReplacementText"].includes(event.inputType) &&
          event.data !== null
        ) {
          // Native insertion can inherit the previous sibling's style after the user turns formatting off.
          event.preventDefault()
          operations.current?.replace(event.data)
        } else if (["insertParagraph", "insertLineBreak"].includes(event.inputType)) {
          event.preventDefault()
          operations.current?.replace("\n")
        } else if (["deleteContentBackward", "deleteContentForward"].includes(event.inputType)) {
          if (operations.current?.remove(event.inputType === "deleteContentBackward")) event.preventDefault()
        }
      }
      root.addEventListener("beforeinput", beforeInput)
      return () => root.removeEventListener("beforeinput", beforeInput)
    }, [blocked])
    const copy = (event: React.ClipboardEvent<HTMLDivElement>, cut: boolean) => {
      if (composing.current) return
      const selection = getReferenceInputSelection(event.currentTarget)
      if (selection.start === selection.end) return
      event.preventDefault()
      const root = event.currentTarget
      setReferenceInputSelection(root, selection.start, selection.end)
      const range = root.ownerDocument.getSelection()!.getRangeAt(0)
      let fragment: Node = range.cloneContents()
      let parent =
        range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentNode
      while (parent && parent !== root) {
        if (parent.nodeType === 1 && (parent as Element).hasAttribute("data-format-open")) {
          const wrapper = parent.cloneNode(false)
          wrapper.appendChild(fragment)
          fragment = wrapper
        }
        parent = parent.parentNode
      }
      const holder = root.ownerDocument.createElement("div")
      holder.append(fragment)
      const source = serializeReferenceInput(holder)
      const plain = referenceInputPlainText(source)
      event.clipboardData.setData("text/plain", plain)
      event.clipboardData.setData(clipboardType, source)
      if (cut && !blocked()) replace("")
    }
    const catalog = React.useMemo(
      () => new Map(entities.map((entry) => [`${entry.kind}:${entry.id}`, entry])),
      [entities],
    )
    const icons = decorations.map(({ element: host, entity }, index) =>
      createPortal(
        <EntityReferenceArtwork entity={entity} resolveIcon={resolveIcon} className="size-4" />,
        host,
        `decoration-${index}`,
      ),
    )
    const chips = React.useMemo(
      () =>
        hosts.map(({ element: host, part }, index) => {
          if (part.type === "exampleTable")
            return createPortal(
              <>
                {onEditTable && (
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs font-medium hover:bg-muted"
                    disabled={disabled || ancestorDisabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (!element.current || blocked()) return
                      const range = inputAtomRange(element.current, host)
                      if (range) onEditTable(part.rows, range)
                    }}
                  >
                    Sửa bảng ví dụ
                  </button>
                )}
                <ExampleTable rows={part.rows} />
              </>,
              host,
              `table:${index}`,
            )
          const known = catalog.get(`${part.kind}:${part.id}`)
          const entity: EntityReference = known ?? {
            id: part.id,
            kind: part.kind,
            translations: [{ locale, name: part.label, aliases: [], description: "" }],
          }
          const skill = known ? skillReferenceContext(known, locale, fallbackLocale) : undefined
          const name = known ? (referenceTranslation(known, locale, fallbackLocale)?.name ?? part.label) : part.label
          return createPortal(
            <span
              className="inline-flex min-w-0 max-w-full items-center gap-1.5"
              style={{
                color: host.closest('[data-format-open^="<color="]')
                  ? undefined
                  : (entity.display?.color ?? defaultEntityColor(entity)),
              }}
              aria-label={`${entityKindLabels[part.kind]}: ${skill ? `${skill.ownerName} · ` : ""}${name}${skill?.detail ? ` · ${skill.detail}` : ""}`}
            >
              {part.kind !== "term" && (
                <EntityReferenceArtwork
                  entity={entity}
                  resolveIcon={resolveIcon}
                  className={skill ? "mr-0.5 size-5" : "size-4"}
                />
              )}
              <span className="min-w-0 truncate">
                {skill && (
                  <>
                    <span className="opacity-70">{skill.ownerName}</span>
                    <span className="mx-1 opacity-50">›</span>
                  </>
                )}
                {part.label}
              </span>
              {/* A variant shows the name of its form when it has one, otherwise its number. */}
              {known?.kind === "skill" && (known.formKey || (known.variantNo ?? 0) > 1) && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded bg-background/60 px-1 text-[10px] text-muted-foreground"
                  title={known.formKey || `Biến thể ${known.variantNo}`}
                  aria-hidden="true"
                >
                  <ArrowLeftRight className="size-3" />
                  {known.formKey || known.variantNo}
                </span>
              )}
            </span>,
            host,
            `${index}:${part.kind}:${part.id}`,
          )
        }),
      [hosts, catalog, locale, fallbackLocale, resolveIcon, onEditTable, disabled, ancestorDisabled, blocked],
    )
    return (
      <>
        <div
          {...props}
          ref={element}
          role="textbox"
          aria-multiline="true"
          aria-disabled={disabled || ancestorDisabled}
          aria-required={required || undefined}
          contentEditable={!disabled && !ancestorDisabled}
          // Game text is full of names and terms a browser dictionary marks as misspelt; the marks only add noise.
          spellCheck={props.spellCheck ?? false}
          suppressContentEditableWarning
          data-slot="entity-reference-input"
          className={`min-h-28 w-full whitespace-pre-wrap break-words rounded-md border bg-background px-3 py-2 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-50 ${className}`}
          onSelect={remember}
          onKeyUp={remember}
          onMouseUp={remember}
          onClick={remember}
          onInput={(event) => {
            if (blocked()) {
              paint(current.current, remembered.current)
              return
            }
            const snapshot = readReferenceInputSnapshot(event.currentTarget)
            if (composing.current) {
              if (!(snapshot.value.length > maxLength && snapshot.value.length > current.current.length))
                callbacks.current.onChange(snapshot)
            } else commit(snapshot)
          }}
          onCompositionStart={() => {
            if (blocked()) return
            composing.current = true
            callbacks.current.onCompositionStart?.()
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            refreshRecognition()
            const snapshot = readReferenceInputSnapshot(event.currentTarget)
            if (snapshot.value.length > maxLength && snapshot.value.length > current.current.length) {
              callbacks.current.onCompositionEnd?.({ value: current.current, ...remembered.current })
              paint(current.current, remembered.current)
              return
            }
            if (callbacks.current.onCompositionEnd) {
              const accepted = callbacks.current.onCompositionEnd(snapshot) !== false
              if (accepted) {
                remembered.current = { start: snapshot.start, end: snapshot.end }
                paint(snapshot.value, remembered.current)
              } else paint(current.current, remembered.current)
            } else commit(snapshot)
          }}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).closest?.("button")) return
            if (blocked()) {
              event.preventDefault()
              return
            }
            onKeyDown?.(event)
            if (event.defaultPrevented || composing.current || event.nativeEvent.isComposing) return
            if (event.key === "Enter") {
              event.preventDefault()
              replace("\n")
            } else if (["Backspace", "Delete"].includes(event.key) && remove(event.key === "Backspace"))
              event.preventDefault()
          }}
          onCopy={(event) => copy(event, false)}
          onCut={(event) => copy(event, true)}
          onPaste={(event) => {
            event.preventDefault()
            if (!composing.current && !blocked())
              replace(event.clipboardData.getData(clipboardType) || event.clipboardData.getData("text/plain"))
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            if (!composing.current && !blocked())
              replace(event.dataTransfer.getData(clipboardType) || event.dataTransfer.getData("text/plain"))
          }}
        />
        {chips}
        {icons}
      </>
    )
  },
)
