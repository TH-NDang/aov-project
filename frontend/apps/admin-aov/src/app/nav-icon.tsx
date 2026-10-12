import type { LucideIcon } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"

export function NavIcon({ item, className }: { item: { icon: LucideIcon; image?: string }; className?: string }) {
  if (item.image) {
    return (
      <img
        src={item.image}
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        className={cn("size-6 shrink-0 object-contain", className)}
        draggable={false}
      />
    )
  }

  const Icon = item.icon
  return <Icon aria-hidden="true" className={cn("size-6 shrink-0", className)} />
}
