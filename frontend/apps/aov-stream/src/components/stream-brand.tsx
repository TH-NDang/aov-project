import owlMark from "../assets/stream-owl.svg"

/** The owl of the logo; the top bar sets the product name beside it through the app switcher. */
export function StreamBrand() {
  return (
    <span className="stream-brand">
      <img src={owlMark} alt="Cú quan sát — AOV Stream" width="36" height="36" />
    </span>
  )
}
