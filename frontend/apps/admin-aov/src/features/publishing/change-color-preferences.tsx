import { useCallback, useId, useSyncExternalStore } from "react"
import { ArrowDown, ArrowUp, Palette, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"

export const changeColorsStorageKey = "aov.admin.change-colors.v1"
export const changeColorPalette = {
  emerald: {
    label: "Xanh lá",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  rose: { label: "Đỏ", className: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  blue: { label: "Xanh dương", className: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  amber: { label: "Vàng", className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  violet: { label: "Tím", className: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400" },
} as const

export type ChangeColorName = keyof typeof changeColorPalette
export type ChangeColors = Readonly<{ buff: ChangeColorName; nerf: ChangeColorName }>
type Direction = "BUFF" | "NERF"
export const defaultChangeColors: ChangeColors = Object.freeze({ buff: "emerald", nerf: "rose" })

function isColor(value: unknown): value is ChangeColorName {
  return typeof value === "string" && Object.hasOwn(changeColorPalette, value)
}

function decodeColors(value: string | null): ChangeColors {
  try {
    const saved: unknown = value ? JSON.parse(value) : null
    if (!saved || typeof saved !== "object") return defaultChangeColors
    const fields = saved as Record<string, unknown>
    return fields.version === 1 && isColor(fields.buff) && isColor(fields.nerf)
      ? { buff: fields.buff, nerf: fields.nerf }
      : defaultChangeColors
  } catch {
    return defaultChangeColors
  }
}

function sameColors(left: ChangeColors, right: ChangeColors) {
  return left.buff === right.buff && left.nerf === right.nerf
}

function readColors(target: Window, fallback = defaultChangeColors): ChangeColors {
  try {
    return decodeColors(target.localStorage.getItem(changeColorsStorageKey))
  } catch {
    return fallback
  }
}

function createStore(target: Window) {
  let colors = readColors(target)
  let hasUnsavedChange = false
  const listeners = new Set<() => void>()
  const publish = (next: ChangeColors) => {
    if (sameColors(colors, next)) return
    colors = next
    listeners.forEach((listener) => listener())
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== changeColorsStorageKey && event.key !== null) return
    if (event.storageArea) {
      try {
        if (event.storageArea !== target.localStorage) return
      } catch {
        return
      }
    }
    hasUnsavedChange = false
    publish(decodeColors(event.newValue))
  }
  return {
    getSnapshot: () => colors,
    subscribe: (listener: () => void) => {
      if (!listeners.size) {
        if (!hasUnsavedChange) publish(readColors(target, colors))
        target.addEventListener("storage", onStorage)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (!listeners.size) target.removeEventListener("storage", onStorage)
      }
    },
    save: (next: ChangeColors) => {
      try {
        target.localStorage.setItem(changeColorsStorageKey, JSON.stringify({ version: 1, ...next }))
        hasUnsavedChange = false
      } catch {
        // Keep the current browser session usable when storage is unavailable.
        hasUnsavedChange = true
      }
      publish(next)
    },
  }
}

type ColorStore = ReturnType<typeof createStore>
const browserStores = new WeakMap<Window, ColorStore>()
const serverSnapshot = () => defaultChangeColors
const serverSubscribe = () => () => {}

function browserStore() {
  if (typeof window === "undefined") return undefined
  let store = browserStores.get(window)
  if (!store) {
    store = createStore(window)
    browserStores.set(window, store)
  }
  return store
}

export function useChangeColors() {
  const store = browserStore()
  const colors = useSyncExternalStore(
    store?.subscribe ?? serverSubscribe,
    store?.getSnapshot ?? serverSnapshot,
    serverSnapshot,
  )
  const setColor = useCallback(
    (kind: Direction, color: ChangeColorName) => {
      if (!isColor(color) || !store) return
      store.save({ ...store.getSnapshot(), [kind === "BUFF" ? "buff" : "nerf"]: color })
    },
    [store],
  )
  const resetColors = useCallback(() => store?.save(defaultChangeColors), [store])
  return { colors, setColor, resetColors }
}

export function changeTone(kind: string, colors: ChangeColors): string {
  if (kind === "BUFF") return changeColorPalette[colors.buff].className
  if (kind === "NERF") return changeColorPalette[colors.nerf].className
  if (kind === "ADJUSTMENT" || kind === "ADJUST") return changeColorPalette.amber.className
  if (kind === "REWORK") return changeColorPalette.violet.className
  if (kind === "FIX" || kind === "BUG_FIX") return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400"
  return "border-border bg-muted/40 text-muted-foreground"
}

export function ChangeColorSettings({ className = "" }: { className?: string }) {
  const { colors, setColor, resetColors } = useChangeColors()
  const fieldId = useId()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className} aria-label="Thiết lập màu thay đổi">
          <Palette className="size-3.5" aria-hidden />
          Màu thay đổi
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Màu thay đổi</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Chọn màu theo cách bạn quen đọc. Mũi tên và nhãn luôn giữ nguyên ý nghĩa. Lưu riêng trên trình duyệt này.
          </p>
        </div>
        {(["BUFF", "NERF"] as const).map((kind) => {
          const isBuff = kind === "BUFF"
          const color = colors[isBuff ? "buff" : "nerf"]
          const Icon = isBuff ? ArrowUp : ArrowDown
          const label = isBuff ? "Tăng sức mạnh" : "Giảm sức mạnh"
          return (
            <div key={kind} className="flex items-center justify-between gap-3">
              <label htmlFor={`${fieldId}-${kind}`} className="inline-flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex size-7 items-center justify-center rounded-md border ${changeTone(kind, colors)}`}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {label}
              </label>
              <select
                id={`${fieldId}-${kind}`}
                aria-label={`Màu ${label.toLocaleLowerCase("vi-VN")}`}
                value={color}
                onChange={(event) => setColor(kind, event.target.value as ChangeColorName)}
                className="h-9 min-w-28 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.entries(changeColorPalette).map(([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={resetColors}
          disabled={sameColors(colors, defaultChangeColors)}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Khôi phục màu mặc định
        </Button>
      </PopoverContent>
    </Popover>
  )
}
