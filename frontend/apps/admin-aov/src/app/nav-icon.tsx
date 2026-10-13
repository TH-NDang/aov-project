import { AovNavIcon, type AovNavIconName } from "@/app/aov-nav-icon"

export function NavIcon({ item, className }: { item: { icon: AovNavIconName }; className?: string }) {
  return <AovNavIcon name={item.icon} className={className} />
}
