import { WikiIcon } from "./wiki-icon"

export type SkinIconName =
  "search" | "close" | "arrow" | "user" | "badge" | "sort" | "chevron" | "chevronLeft" | "chevronRight"

export function SkinIcon({ name, className, size = 20 }: { name: SkinIconName; className?: string; size?: number }) {
  return <WikiIcon name={name} className={className} size={size} />
}
