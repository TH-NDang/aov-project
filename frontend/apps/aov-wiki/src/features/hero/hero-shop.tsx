import { queryOptions, useQuery } from "@tanstack/react-query"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { useWikiContext, wikiText } from "../../context/wiki-context"

type HeroAvailability = "ON_SALE" | "NOT_OPEN" | "COMING_SOON" | "UNKNOWN"
type SkinMethod = "VOUCHER" | "EVENT" | "NOT_OPEN" | "OTHER" | "UNKNOWN"

interface HeroShop {
  price: {
    availability: HeroAvailability
    goldPrice: number | null
    voucherPrice: number | null
  } | null
  skins: { skinKey: string; method: SkinMethod; voucherPrice: number | null; eventName: string | null }[]
}

/**
 * Today's price and skin acquisition. A past patch on the hero page changes only the abilities (ADR-016), and prices
 * were only recorded recently, so an older day would mostly show nothing.
 */
function heroShopQuery(heroId: string, region: string) {
  return queryOptions({
    queryKey: ["wiki", "hero-shop", heroId, region] as const,
    queryFn: async ({ signal }): Promise<HeroShop> => {
      const query = new URLSearchParams({ region })
      const response = await fetch(`/api/wiki/v1/heroes/${heroId}/shop?${query}`, {
        signal,
        credentials: "omit",
      })
      if (!response.ok) throw new Error("Shop facts are unavailable.")
      return response.json()
    },
    staleTime: 300000,
    retry: false,
  })
}

/**
 * What the hero costs in the market being read, next to its roles. It stays out of the way when nothing is known.
 * A form sold on its own has its own price; otherwise it shows the price of the hero that holds it (ADR-024).
 */
export function HeroPriceTag({ heroId, fallbackHeroId }: { heroId: string; fallbackHeroId?: string }) {
  const { locale, region } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { data } = useQuery(heroShopQuery(heroId, region))
  const fallback = useQuery({
    ...heroShopQuery(fallbackHeroId ?? heroId, region),
    enabled: !!fallbackHeroId && !!data && !data.price,
  })
  const price = data?.price ?? (fallbackHeroId ? fallback.data?.price : undefined)
  if (!price) return null
  const Coin = gameplayIcons.coin
  const amounts = [
    price.goldPrice != null && `${price.goldPrice.toLocaleString(locale)} ${text("vàng", "gold")}`,
    price.voucherPrice != null && `${price.voucherPrice.toLocaleString(locale)} ${text("quân huy", "vouchers")}`,
  ].filter(Boolean)
  const label =
    price.availability === "NOT_OPEN"
      ? text("Chưa mở bán", "Not on sale")
      : price.availability === "COMING_SOON"
        ? text("Sắp ra mắt", "Coming soon")
        : amounts.join(" · ")
  if (!label) return null
  return (
    <span>
      <Coin size={17} />
      {label}
    </span>
  )
}

/** How a skin is obtained in the market being read, in the words a player would use. */
export function SkinAcquisitionText({
  heroId,
  skinKey,
  className,
}: {
  heroId: string
  skinKey: string
  className?: string
}) {
  const { locale, region } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { data } = useQuery(heroShopQuery(heroId, region))
  const row = data?.skins.find((entry) => entry.skinKey === skinKey)
  if (!row || row.method === "UNKNOWN") return null
  const label =
    row.method === "VOUCHER"
      ? row.voucherPrice == null
        ? text("Mua bằng quân huy", "Bought with vouchers")
        : `${row.voucherPrice.toLocaleString(locale)} ${text("quân huy", "vouchers")}`
      : row.method === "EVENT"
        ? row.eventName
          ? `${text("Sự kiện", "Event")}: ${row.eventName}`
          : text("Nhận từ sự kiện", "From an event")
        : row.method === "NOT_OPEN"
          ? text("Hiện chưa mở", "Not available now")
          : text("Cách nhận khác", "Obtained another way")
  const Coin = gameplayIcons.coin
  return (
    <p className={className}>
      <Coin size={15} />
      {label}
    </p>
  )
}
