import { cn } from "@aov/ui/lib/utils"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"
import "./public-app-brand.css"

/**
 * The app's name as its logo, drawn the same way for every product so the two sit at one size: "AOV" in the product's
 * ink, then the product's name in its accent with a soft sheen. `small` is the size of a phone's top bar.
 */
export function PublicAppWordmark({
  product,
  size,
  className,
}: {
  product: "Wiki" | "Stream"
  size?: "small"
  className?: string
}) {
  return (
    <span className={cn("public-app-wordmark", className)} data-product={product.toLowerCase()} data-size={size}>
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
  currentLabel,
}: {
  product: "Wiki" | "Stream"
  image: string
  description: string
  current?: boolean
  currentLabel?: string
}) {
  const t = useLocaleText()
  return (
    <>
      <img className="public-app-option-image" src={image} alt="" width="36" height="36" />
      <span className="public-app-option-copy">
        <span className="public-app-option-name">AOV {product}</span>
        <span className="public-app-description">{description}</span>
      </span>
      {current && <span className="sr-only">{currentLabel ?? t("Đang xem", "Current")}</span>}
      {/* The app in use carries a check; the other an arrow that lights up when pointed at. */}
      <svg className="public-app-option-mark" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={current ? "m5 12.5 4.5 4.5L19 7.5" : "M5 12h14m-5-5 5 5-5 5"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  )
}
