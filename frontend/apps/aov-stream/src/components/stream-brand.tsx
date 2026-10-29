import owlMark from "../assets/stream-owl.svg"

export function StreamBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="stream-brand">
      <img src={owlMark} alt="Cú quan sát — AOV Stream" width="42" height="42" />
      {!compact && (
        <span className="stream-wordmark">
          AOV<span>Stream</span>
          <small>THE GAME, OBSERVED.</small>
        </span>
      )}
    </span>
  )
}
