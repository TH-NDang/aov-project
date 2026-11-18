import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { entityKindLabels, type EntityReference, type EntityTranslation } from "../../lib/entity-rich-text"
import type { EntityReferenceInputHandle } from "../entity-reference-input"
import { EntityReferenceArtwork, skillReferenceContext, type EntityIconResolver } from "../entity-rich-text"
import { Button } from "../button"

// Entities and the lists that hold them never pass through the props of the list itself: React's development build
// compares changed props deeply, which would read every translation of the entities on each keystroke.

/** Where the caret stands, measured again whenever the text, the field or the page moves. */
export function useCaretAnchor(
  area: React.RefObject<EntityReferenceInputHandle | null>,
  open: boolean,
  caretEnd: number,
  text: string,
  /** The references the text may hold; a recognised name changes the width of the text, so the caret moves. */
  entities: EntityReference[],
) {
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)
  React.useLayoutEffect(() => {
    if (!open || !area.current?.element) return
    const input = area.current.element
    const view = input.ownerDocument.defaultView!
    const measure = () => {
      const rect = area.current?.caretRect(caretEnd)
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
  }, [area, open, text, caretEnd, entities])
  return React.useMemo(
    () => ({ current: { getBoundingClientRect: () => anchorRect ?? area.current!.element!.getBoundingClientRect() } }),
    [anchorRect, area],
  )
}

/** One reference to insert: its picture, the hero a skill belongs to, its name, kind and language. */
export function ReferenceOptionRow({
  id,
  index,
  count,
  chosen,
  entity,
  translation,
  locale,
  fallbackLocale,
  resolveIcon,
  onChoose,
}: {
  id: string
  index: number
  count: number
  chosen: boolean
  entity: EntityReference
  translation: EntityTranslation
  locale: string
  fallbackLocale: string
  resolveIcon?: EntityIconResolver
  onChoose: (index: number) => void
}) {
  const skill = skillReferenceContext(entity, locale, fallbackLocale)
  return (
    <button
      id={`${id}-option-${index}`}
      type="button"
      role="option"
      aria-posinset={index + 1}
      aria-setsize={count}
      aria-selected={chosen}
      aria-label={
        skill ? `${skill.ownerName} · ${translation.name}${skill.detail ? ` · ${skill.detail}` : ""}` : undefined
      }
      className={`flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${chosen ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChoose(index)}
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
          {entityKindLabels[entity.kind]} · {translation.locale}
          {translation.locale !== locale ? " (dự phòng)" : ""}
        </span>
      </span>
      <span className="ml-auto text-xs text-muted-foreground" aria-hidden="true">
        ↵
      </span>
    </button>
  )
}

/**
 * The list of references to insert, under the caret: after an @ it filters by what follows it; opened from the
 * toolbar it has its own search field and a row of kinds to narrow it. The rows come as children.
 */
export function ReferenceSuggestions({
  ref,
  id,
  label,
  open,
  searching,
  visible,
  anchor,
  editor,
  kinds,
  query,
  onQueryChange,
  count,
  active,
  loading,
  error,
  onRetry,
  onOpenChange,
  onListKeys,
  onLoadMore,
  onClose,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  id: string
  label: string
  /** The suggestions are wanted (after an @ or from the toolbar), even when the list is not drawn yet. */
  open: boolean
  /** Opened from the toolbar, with a search field of its own. */
  searching: boolean
  visible: boolean
  anchor: ReturnType<typeof useCaretAnchor>
  editor: React.RefObject<HTMLDivElement | null>
  /** The kinds a search can narrow to, with their names. */
  kinds: [string, string][]
  query: string
  onQueryChange: (query: string) => void
  /** How many references match, drawn or not yet. */
  count: number
  active: number
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpenChange: (open: boolean) => void
  onListKeys: (event: React.KeyboardEvent) => void
  onLoadMore: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  const list = React.useRef<HTMLDivElement>(null)
  const search = React.useRef<HTMLInputElement>(null)
  // The chosen row stays in view while the arrow keys move through the list.
  React.useLayoutEffect(() => {
    if (!open) return
    const container = list.current
    const selected = container?.children[Math.min(active, count - 1)] as HTMLElement | undefined
    if (!container || !selected) return
    const bounds = container.getBoundingClientRect()
    const row = selected.getBoundingClientRect()
    if (row.bottom > bounds.bottom) container.scrollTop += row.bottom - bounds.bottom
    else if (row.top < bounds.top) container.scrollTop -= bounds.top - row.top
  }, [open, active, count])
  const nearEnd = (element: HTMLElement) => element.scrollHeight - element.scrollTop - element.clientHeight < 80

  return (
    <PopoverPrimitive.Root open={visible} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Anchor virtualRef={anchor} />
      {visible && (
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={ref}
            data-slot="entity-reference-suggestions"
            aria-label={`Chèn tham chiếu ${label}`}
            align="start"
            sideOffset={6}
            collisionPadding={8}
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              if (searching) search.current?.focus()
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (editor.current?.contains(event.target as Node)) event.preventDefault()
            }}
            className="z-50 flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
            style={{ maxHeight: "min(24rem, var(--radix-popover-content-available-height))" }}
          >
            {searching && (
              <div role="group" aria-label="Nhóm tham chiếu" className="flex shrink-0 gap-1 overflow-x-auto">
                {kinds.map(([kind, name]) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onQueryChange(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            )}
            {searching && (
              <input
                ref={search}
                aria-label={`Tìm tham chiếu ${label}`}
                className="w-full shrink-0 rounded border bg-background p-2 text-sm"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onListKeys}
              />
            )}
            <p className="shrink-0 px-1 text-xs text-muted-foreground" role="status">
              {count
                ? `${count} kết quả · ↑↓ chọn · Enter chèn`
                : loading
                  ? "Đang tìm tham chiếu…"
                  : "Không có tham chiếu phù hợp"}
            </p>
            <div
              role="listbox"
              ref={list}
              id={`${id}-options`}
              aria-label={`Gợi ý tham chiếu ${label}`}
              className="min-h-0 max-h-64 overflow-y-auto overscroll-contain"
              aria-busy={loading}
              onScroll={(event) => {
                if (nearEnd(event.currentTarget)) onLoadMore()
              }}
              onWheel={(event) => {
                if (event.deltaY > 0 && nearEnd(event.currentTarget)) onLoadMore()
              }}
            >
              {children}
            </div>
            {count > 0 && loading && (
              <p role="status" className="px-1 text-xs text-muted-foreground">
                Đang tải thêm tham chiếu…
              </p>
            )}
            {error && (
              <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                <span>Chưa tải được tham chiếu.</span>
                <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
                  Thử lại
                </Button>
              </div>
            )}
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
              Đóng gợi ý
            </Button>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  )
}
