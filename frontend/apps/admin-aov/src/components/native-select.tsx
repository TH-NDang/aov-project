import type { ComponentProps } from "react"
import { cn } from "@aov/ui/lib/utils"

/**
 * The browser's own list, drawn like the shared Input of @aov/ui: 36px high, the input border and radius, 16px text on
 * phones and the same focus ring. The shared Select is a listbox with its own events; this one keeps `onChange` and
 * `<option>` children, so a form, a test or a screen reader sees a plain select. It takes its content's width; pass
 * `w-full` to fill a field.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  )
}
