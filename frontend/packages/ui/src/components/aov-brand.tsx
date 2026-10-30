import type { ComponentProps } from "react"
import { cn } from "cn"
import { aovMarkUrl } from "../lib/brand"

export function AovMark({ className, ...props }: Omit<ComponentProps<"img">, "src" | "alt">) {
  return <img src={aovMarkUrl} alt="" width={32} height={32} className={cn("size-8 shrink-0", className)} {...props} />
}

export function AovWordmark({ product = "Wiki", className }: { product?: "Wiki" | "Admin"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[0.14em] font-sans leading-none tracking-[-0.04em] whitespace-nowrap not-italic",
        className,
      )}
    >
      <span className="font-black">AOV</span> <span className="font-semibold">{product}</span>
    </span>
  )
}
