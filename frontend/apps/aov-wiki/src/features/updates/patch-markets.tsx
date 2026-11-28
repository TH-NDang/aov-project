import { countryReferenceFlag } from "@aov/ui/lib/country-references"
import { marketName } from "@aov/ui/lib/locale-text"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { sourceName, sourcesByMarket, type PatchSourceLink } from "../../lib/patch-sources"
import type { PatchMarketRelease } from "../../lib/updates-api"
import "./patch-markets.css"

const LANGUAGE_NAMES: Record<string, readonly [string, string]> = {
  vi: ["Tiếng Việt", "Vietnamese"],
  en: ["Tiếng Anh", "English"],
  th: ["Tiếng Thái", "Thai"],
  zh: ["Tiếng Trung phồn thể", "Traditional Chinese"],
  id: ["Tiếng Indonesia", "Indonesian"],
}

/** A market's release on its own clock: the day, and the hour when it is known. */
function localParts(release: PatchMarketRelease, locale: string) {
  if (release.effectiveOn) {
    const [year, month, day] = release.effectiveOn.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 12))
    return {
      day: new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
      time: null,
      sortKey: Date.UTC(year, month - 1, day),
    }
  }
  if (!release.effectiveAt) return null
  const at = new Date(release.effectiveAt)
  const zone = { timeZone: release.timeZone }
  return {
    day: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", ...zone }).format(at),
    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...zone }).format(at),
    sortKey: at.getTime(),
  }
}

/** Whole calendar days between two releases, each read on its own market's calendar. */
function dayOf(release: PatchMarketRelease) {
  if (release.effectiveOn) return Date.parse(`${release.effectiveOn}T00:00:00Z`)
  if (!release.effectiveAt) return null
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: release.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(release.effectiveAt))
  return Date.parse(`${parts}T00:00:00Z`)
}

/**
 * When each market got the patch and where it published its notes, one row per market (ADR-037). Markets that updated
 * on the same day read alike at a glance; the one that came earlier carries how many days it led by.
 */
export function PatchMarketBoard({
  markets,
  sources,
}: {
  markets: readonly PatchMarketRelease[]
  sources: readonly PatchSourceLink[]
}) {
  const { locale, region } = useWikiContext()
  const text = useWikiText()
  const english = locale.startsWith("en")
  const groups = sourcesByMarket([...sources], region)
  const codes = [
    ...new Set([
      ...groups.map((group) => group.region).filter((code): code is string => !!code),
      ...markets.map((m) => m.region),
    ]),
  ]
  const order = ["VN", "TH", "TW", "ID"]
  const own = region && codes.includes(region) ? region : null
  codes.sort(
    (a, b) =>
      Number(b === own) - Number(a === own) ||
      (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)),
  )
  const anchor = markets.find((release) => release.region === (own ?? "VN")) ?? markets[0]
  const anchorDay = anchor ? dayOf(anchor) : null
  const other = groups.find((group) => group.region === null)?.links ?? []
  const title = text("Phát hành và nguồn", "Release and sources")
  if (!codes.length && !other.length) return null

  const linkList = (links: readonly PatchSourceLink[]) => (
    <ul className="wiki-patch-market-links">
      {links.map((link) => {
        const language = link.locale ? LANGUAGE_NAMES[link.locale.split("-")[0]] : undefined
        return (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              hrefLang={link.locale ?? undefined}
              title={language ? language[english ? 1 : 0] : undefined}
            >
              {sourceName(link)}
              <WikiIcon name="open" size={14} />
            </a>
          </li>
        )
      })}
    </ul>
  )

  return (
    <section className="wiki-patch-markets" aria-label={title}>
      <h2 className="wiki-patch-markets-title">{title}</h2>
      <ul className="wiki-patch-market-rows">
        {codes.map((code) => {
          const release = markets.find((entry) => entry.region === code)
          const parts = release ? localParts(release, locale) : null
          const day = release ? dayOf(release) : null
          const lead = day !== null && anchorDay !== null && release !== anchor ? (day - anchorDay) / 86_400_000 : 0
          const links = groups.find((group) => group.region === code)?.links ?? []
          const flag = countryReferenceFlag(code)
          return (
            <li key={code} className="wiki-patch-market" data-own={code === own ? "" : undefined}>
              <span className="wiki-patch-market-name">
                {flag ? <img src={flag} alt="" /> : <WikiIcon name="globe" size={14} />}
                <span>{marketName(code, locale)}</span>
              </span>
              <span className="wiki-patch-market-when">
                {parts ? (
                  <>
                    <time dateTime={release?.effectiveAt ?? release?.effectiveOn ?? undefined}>{parts.day}</time>
                    {parts.time && <b>{parts.time}</b>}
                    {lead !== 0 && (
                      <small>
                        {lead < 0
                          ? text(`sớm ${-lead} ngày`, `${-lead} days earlier`)
                          : text(`muộn ${lead} ngày`, `${lead} days later`)}
                      </small>
                    )}
                  </>
                ) : (
                  <span className="wiki-patch-market-unknown">{text("Chưa rõ ngày", "Date unknown")}</span>
                )}
              </span>
              {links.length > 0 && linkList(links)}
            </li>
          )
        })}
        {other.length > 0 && (
          <li className="wiki-patch-market">
            <span className="wiki-patch-market-name">
              <WikiIcon name="open" size={14} />
              <span>{text("Nguồn khác", "Other sources")}</span>
            </span>
            <span className="wiki-patch-market-when" />
            {linkList(other)}
          </li>
        )}
      </ul>
    </section>
  )
}
