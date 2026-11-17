import { cn } from "../lib/utils"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"
import "./public-app-brand.css"

/** Drawn rather than typed: round strokes match the owl beside it, and the spark is the one in its logo. */
function StreamWordmarkArt() {
  return (
    <svg
      className="public-app-wordmark-art"
      viewBox="0 0 176 28"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g stroke="var(--wordmark-ink)" strokeWidth="4.4">
        <path d="M3 24 11 4l8 20M6.5 17h9" />
        <ellipse cx="31" cy="14" rx="8.5" ry="10" />
        <path d="m45 4 8 20 8-20" />
      </g>
      <g stroke="var(--wordmark-accent)" strokeWidth="3.4">
        <path d="M83 8.2C81.6 5.4 79 4 76.4 4c-3.4 0-5.8 2.2-5.8 5.2 0 2.8 2 4 6 5 4.200 1 6.600 2.400 6.600 5.200 0 3-2.800 4.600-6.200 4.600-3.200 0-6-1.400-7.200-4.200" />
        <path d="M90 5.500V20c0 2.800 1.400 4 3.600 4H95M86.400 10.600h8.400" />
        <path d="M100 10.500V24m0-8c.8-3.400 3-5.400 6.400-5.400" />
        <path d="M110.400 17.200H123c0-4.200-2.400-6.800-6.200-6.800-4 0-6.400 3-6.400 6.800 0 4 2.600 6.800 6.600 6.800 2.600 0 4.600-1 5.800-3" />
        <path d="M139 10.600V24m0-6.800c0-4-2.600-6.800-6.200-6.800-3.800 0-6.400 3-6.400 6.800 0 3.800 2.600 6.800 6.400 6.800 3.600 0 6.200-2.800 6.200-6.800" />
        <path d="M145 24V10.600m0 5.200c0-3.200 2-5.200 4.800-5.200s4.400 1.800 4.400 4.800V24m0-8.200c0-3.200 2-5.200 4.800-5.200s4.400 1.800 4.400 4.800V24" />
      </g>
      <path
        d="m170 1 1.400 3.600L175 6l-3.600 1.400L170 11l-1.400-3.600L165 6l3.600-1.400Z"
        fill="var(--aov-stream-tan)"
      />
    </svg>
  )
}

export function PublicAppWordmark({ product, className }: { product: "Wiki" | "Stream"; className?: string }) {
  return (
    <span className={cn("public-app-wordmark", className)} data-product={product.toLowerCase()}>
      {product === "Stream" ? (
        <>
          <span className="sr-only">AOV Stream</span>
          <StreamWordmarkArt />
        </>
      ) : (
        <>
          <span className="public-app-wordmark-prefix">AOV</span>
          <span className="public-app-wordmark-product">{product}</span>
        </>
      )}
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
      <img className="public-app-option-image" src={image} alt="" width="44" height="44" />
      <span className="public-app-option-copy">
        <span className="public-app-option-heading">
          <PublicAppWordmark product={product} />
          {current && <span className="public-app-current">{currentLabel ?? t("Đang xem", "Current")}</span>}
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
