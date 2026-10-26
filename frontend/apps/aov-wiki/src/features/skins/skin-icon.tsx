import { WikiIcon } from "../../components/wiki-icon"

export type SkinIconName = "search" | "close" | "open" | "collection" | "hero" | "badge" | "reset"

export function SkinIcon({ name, className, size = 20 }: { name: SkinIconName; className?: string; size?: number }) {
  return <WikiIcon name={name} className={className} size={size} />
}
