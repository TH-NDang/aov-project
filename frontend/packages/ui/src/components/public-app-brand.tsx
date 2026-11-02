import { cn } from "../lib/utils"
import "./public-app-brand.css"

export function PublicAppWordmark({ product, className }: { product: "Wiki" | "Stream"; className?: string }) {
  return (
    <span className={cn("public-app-wordmark", className)} data-product={product.toLowerCase()}>
      <span className="public-app-wordmark-prefix">AOV</span>
      <span className="public-app-wordmark-product">{product}</span>
    </span>
  )
}

export function PublicAppOptionBody({
  product,
  image,
  description,
  current = false,
  currentLabel = "Đang xem",
}: {
  product: "Wiki" | "Stream"
  image: string
  description: string
  current?: boolean
  currentLabel?: string
}) {
  return (
    <>
      <img className="public-app-option-image" src={image} alt="" width="44" height="44" />
      <span className="public-app-option-copy">
        <span className="public-app-option-heading">
          <PublicAppWordmark product={product} />
          {current && <span className="public-app-current">{currentLabel}</span>}
        </span>
        <span className="public-app-description">{description}</span>
      </span>
      {!current && (
        <svg
          className="public-app-option-arrow"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12h14m-5-5 5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  )
}
