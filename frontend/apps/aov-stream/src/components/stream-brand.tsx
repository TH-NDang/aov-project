import owlMark from "../assets/stream-owl.svg"
import { PublicAppWordmark } from "@aov/ui/components/public-app-brand"
import { useStreamLocale } from "./stream-locale"

export function StreamBrand({ compact = false }: { compact?: boolean }) {
  const { text } = useStreamLocale()
  return (
    <span className="stream-brand">
      <img src={owlMark} alt={text("Cú quan sát — AOV Stream", "Watchful owl — AOV Stream")} width="36" height="36" />
      {!compact && <PublicAppWordmark product="Stream" className="stream-wordmark" />}
    </span>
  )
}
