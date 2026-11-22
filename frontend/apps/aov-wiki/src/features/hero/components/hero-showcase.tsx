import { sizedImageSources } from "../../../lib/sized-image"
import { useMemo, type CSSProperties, type ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { CatalogShowcase } from "../../../components/catalog-showcase"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroListItem } from "../../../lib/hero-api"
import { dailySpread } from "../model/hero-daily-spread"
import "./hero-showcase.css"

/** How many portraits stand on the wall; the track repeats them once so it can drift without a seam. */
const STRIPS = 16

/** Where each strip starts below the banner's top and how wide it is, in a pattern that repeats along the wall. */
const DROPS = [0, 38, 10, 56, 22, 4, 46, 16]
const WIDTHS = [78, 86, 72, 82, 76, 88, 74, 80]

/**
 * The head of the hero library: the title and the number of heroes over a wall of tall portrait strips, set at
 * different heights like character cards pinned side by side, fading into mist at their feet. The wall runs behind the
 * text too, under a shade that keeps the text clear, and drifts slowly sideways. Which heroes stand on it changes from
 * day to day. The data version stands as a frosted pill in the banner's corner. While the list loads the head has its
 * text only.
 */
export function HeroShowcase({ heroes, version }: { heroes?: readonly HeroListItem[]; version?: ReactNode }) {
  const { locale } = useWikiContext()
  const wide = usePageLayout() === "wide"
  const portraits = useMemo(() => wallPortraits(heroes ?? []), [heroes])
  const count = heroes?.length
  return (
    <CatalogShowcase
      title={wikiText(locale, "Thư viện Tướng", "Hero library")}
      count={count ? wikiText(locale, `${count} tướng`, `${count} heroes`) : undefined}
      wide={wide}
      fill
      corner={version}
      scene={portraits.length > 0 && <PortraitWall portraits={portraits} />}
    />
  )
}

/** A strip is about 90px wide but crops a tall portrait to its height, so the picture is fetched about 190px wide. */
function stripSources(url: string) {
  const { src, srcSet } = sizedImageSources(url, 192)
  return { src, srcSet }
}

function PortraitWall({ portraits }: { portraits: string[] }) {
  return (
    <div className="wiki-hero-wall">
      <div className="wiki-hero-wall-track">
        {[...portraits, ...portraits].map((url, index) => (
          <span
            key={`${index}-${url}`}
            className="wiki-hero-wall-strip"
            style={
              {
                "--drop": `${DROPS[index % DROPS.length]}px`,
                "--strip": `${WIDTHS[index % WIDTHS.length]}px`,
              } as CSSProperties
            }
          >
            <img {...stripSources(url)} alt="" loading={index < portraits.length ? "eager" : "lazy"} decoding="async" />
          </span>
        ))}
      </div>
    </div>
  )
}

/** Days since the epoch in the reader's zone, so the wall changes at their midnight. */
function dayNumber() {
  const now = new Date()
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
}

function wallPortraits(heroes: readonly HeroListItem[]) {
  const urls = heroes.flatMap((hero) => {
    const url = hero.portrait?.currentVersion?.url
    return url ? [url] : []
  })
  return dailySpread(urls.length, dayNumber(), STRIPS).map((index) => urls[index]!)
}
