import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Kbd } from "@aov/ui/components/kbd"
import { cn } from "@aov/ui/lib/utils"
import { useHotkeys } from "@/app/hotkeys"

type InputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "children">

/**
 * Compact search box shared by catalog pages: clear button, Esc to clear and "/" to focus when `shortcut` is set.
 * Only one field per page should enable the shortcut.
 *
 * `placement="header"` is for `PageHeader`'s search slot: a fixed width centered by a wide header, and in a narrow
 * header (phones, or a window squeezed by the sidebar) an icon that lays the field over the header row. `children`
 * render next to the input, e.g. a result list positioned below it.
 */
export function SearchField({
  value,
  onChange,
  label,
  shortcut = false,
  placement = "inline",
  className,
  inputRef,
  onKeyDown,
  children,
  ...props
}: InputProps & {
  value: string
  onChange: (value: string) => void
  label: string
  shortcut?: boolean
  placement?: "inline" | "header"
  inputRef?: React.Ref<HTMLInputElement>
  children?: ReactNode
}) {
  const own = useRef<HTMLInputElement | null>(null)
  const { enabled } = useHotkeys()
  const header = placement === "header"
  const [expanded, setExpanded] = useState(false)
  const active = value.trim()
  useEffect(() => {
    if (expanded) own.current?.focus()
  }, [expanded])
  useEffect(() => {
    if (!shortcut || !enabled) return
    const focus = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
      )
        return
      const input = own.current
      if (!input || input.closest("[hidden],[inert]")) return
      event.preventDefault()
      // A collapsed header field has no layout box until it expands.
      if (header && !input.offsetParent) {
        setExpanded(true)
        return
      }
      input.focus()
      input.select()
    }
    window.addEventListener("keydown", focus)
    return () => window.removeEventListener("keydown", focus)
  }, [shortcut, enabled, header])
  const field = (
    <div className="relative w-full min-w-0">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        {...props}
        ref={(node) => {
          own.current = node
          if (typeof inputRef === "function") inputRef(node)
          else if (inputRef) inputRef.current = node
        }}
        type="search"
        aria-label={label}
        value={value}
        maxLength={props.maxLength ?? 100}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || event.key !== "Escape") return
          if (value) {
            event.preventDefault()
            onChange("")
          } else event.currentTarget.blur()
        }}
        className="peer h-9 w-full rounded-full border bg-background pr-10 pl-10 text-sm transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-50 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Xóa tìm kiếm"
          title="Xóa (Esc)"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange("")
            own.current?.focus()
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut &&
        enabled && (
          <Kbd
            className={cn(
              "absolute top-1/2 right-3 hidden -translate-y-1/2 peer-focus-visible:hidden",
              header ? "@3xl/page-header:inline-flex" : "sm:inline-flex",
            )}
          >
            /
          </Kbd>
        )
      )}
    </div>
  )
  if (!header)
    return (
      <div className={cn("relative min-w-0", className)}>
        {field}
        {children}
      </div>
    )
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative size-9 shrink-0 rounded-full @3xl/page-header:hidden"
        aria-label={active ? `Mở tìm kiếm: ${active}` : "Mở tìm kiếm"}
        title={label}
        onClick={() => setExpanded(true)}
      >
        <Search className="size-4" />
        {active && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
      </Button>
      <div
        className={cn(
          "min-w-0 @3xl/page-header:relative @3xl/page-header:w-72 @4xl/page-header:w-80 @5xl/page-header:w-96",
          expanded
            ? "@max-3xl/page-header:absolute @max-3xl/page-header:inset-0 @max-3xl/page-header:z-30 @max-3xl/page-header:flex @max-3xl/page-header:items-center @max-3xl/page-header:bg-background"
            : "@max-3xl/page-header:hidden",
          className,
        )}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false)
        }}
      >
        {field}
        {children}
      </div>
    </>
  )
}
