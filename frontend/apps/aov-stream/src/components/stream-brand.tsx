import owlMark from "../assets/stream-owl.svg"
import { useStreamLocale } from "./stream-locale"

/** The owl of the logo; the top bar sets the product name beside it through the app switcher. */
export function StreamBrand() {
  const { text } = useStreamLocale()
  return (
    <span className="stream-brand">
      <img src={owlMark} alt={text("Cú quan sát — AOV Stream", "Watchful owl — AOV Stream")} width="36" height="36" />
    </span>
  )
}
