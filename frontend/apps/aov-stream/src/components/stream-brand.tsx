import owlMark from "../assets/stream-owl.svg"
import { PublicAppWordmark } from "@aov/ui/components/public-app-brand"

export function StreamBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="stream-brand">
      <img src={owlMark} alt="Cú quan sát — AOV Stream" width="36" height="36" />
      {!compact && <PublicAppWordmark product="Stream" className="stream-wordmark" />}
    </span>
  )
}
