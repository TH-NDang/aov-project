import owlMark from "../assets/stream-owl.svg"

export function StreamBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="stream-brand">
      <img src={owlMark} alt="Cú quan sát — AOV Stream" width="36" height="36" />
      {!compact && (
        <span className="stream-wordmark">
          AOV<span>Stream</span>
        </span>
      )}
    </span>
  )
}
