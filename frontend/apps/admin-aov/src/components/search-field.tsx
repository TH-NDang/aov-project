import { useEffect, useRef, type ComponentProps } from "react"
import { Search, X } from "lucide-react"
import { Kbd } from "@aov/ui/components/kbd"
import { cn } from "@aov/ui/lib/utils"
import { useHotkeys } from "@/app/hotkeys"

type InputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type">

/**
 * Compact search box shared by catalog pages: clear button, Esc to clear and "/" to focus when `shortcut` is set.
 * Only one field per page should enable the shortcut.
 */
export function SearchField({
  value,
  onChange,
  label,
  shortcut = false,
  className,
  inputRef,
  onKeyDown,
  ...props
}: InputProps & {
  value: string
  onChange: (value: string) => void
  label: string
  shortcut?: boolean
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const own = useRef<HTMLInputElement | null>(null)
  const { enabled } = useHotkeys()
  useEffect(() => {
    if (!shortcut || !enabled) return
    const focus = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
      )
        return
      if (!own.current || own.current.closest("[hidden],[inert]")) return
      event.preventDefault()
      own.current.focus()
      own.current.select()
    }
    window.addEventListener("keydown", focus)
    return () => window.removeEventListener("keydown", focus)
  }, [shortcut, enabled])
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
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
        className="peer h-9 w-full rounded-lg border bg-background pr-9 pl-8 text-sm transition-colors outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-50 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Xóa tìm kiếm"
          title="Xóa (Esc)"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <Kbd className="absolute top-1/2 right-2 hidden -translate-y-1/2 peer-focus-visible:hidden sm:inline-flex">
            /
          </Kbd>
        )
      )}
    </div>
  )
}
