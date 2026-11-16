import { useState, type MouseEvent } from "react"
import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { WikiImageCredit } from "../../components/wiki-image-credit"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { HeroListItem } from "./hero-api"
import { HERO_POSITIONS, HERO_ROLES, localizedHeroOptions } from "./hero-classifications"
import { HeroGlyph } from "./hero-glyph"
import "./hero-card.css"

/**
 * A hero as a card: the portrait, the name, the roles and the lanes. Roles are written out where the card has room and
 * drawn as marks where it does not; lanes are always marks, named by the filters above the list.
 */
export function HeroCard({
  hero,
  from,
  current = false,
  credit = false,
  onPick,
}: {
  hero: HeroListItem
  /** The list the reader comes from, so the hero's page can lead back to it with its filters. */
  from: string
  /** Marks the hero whose page is open; picking it again only closes the list. */
  current?: boolean
  /** Offers the source of the picture beside the card. */
  credit?: boolean
  onPick?: () => void
}) {
  const { href, locale } = useWikiContext()
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const portraitUrl = hero.portrait?.currentVersion?.url
  const imageUrl = [portraitUrl, hero.head?.currentVersion?.url].find((url) => url && !failedUrls.includes(url))
  const media = imageUrl === portraitUrl ? hero.portrait : hero.head
  const positions = localizedHeroOptions(HERO_POSITIONS, locale).filter((option) =>
    hero.positions?.includes(option.value),
  )
  const roles = localizedHeroOptions(HERO_ROLES, locale).filter((option) => hero.roles.includes(option.value))
  const positionLabel = `${wikiText(locale, "Vị trí", "Lane")}: ${positions.map((option) => option.label).join(", ")}`
  const roleLabel = `${wikiText(locale, "Vai trò", "Role")}: ${roles.map((option) => option.label).join(", ")}`
  const undated = hero.unscopedBaseline ? wikiText(locale, "Chưa rõ mốc", "Undated baseline") : ""
  const label = [
    current ? wikiText(locale, `Đang xem: ${hero.name}`, `Currently viewing: ${hero.name}`) : hero.name,
    roles.length ? roleLabel : "",
    positions.length ? positionLabel : "",
    undated,
  ]
    .filter(Boolean)
    .join(". ")

  function pick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onPick || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    if (current) event.preventDefault()
    onPick()
  }

  return (
    <div className="wiki-hero-card-cell">
      <Link
        className="wiki-hero-card"
        to={href(`/hero/${hero.code}`)}
        state={{ from }}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        onClick={pick}
      >
        <span className="wiki-hero-card-portrait" data-image-kind={imageUrl === portraitUrl ? "portrait" : "head"}>
          {imageUrl ? (
            <WikiImage
              src={imageUrl}
              focus={media?.currentVersion?.focalPoint}
              alt=""
              width="140"
              height="175"
              loading="lazy"
              decoding="async"
              onError={() => setFailedUrls((failed) => [...failed, imageUrl])}
            />
          ) : (
            <span className="wiki-hero-card-placeholder">{hero.name.charAt(0)}</span>
          )}
          {current && (
            <span className="wiki-hero-card-current">
              <WikiIcon name="check" size={14} />
            </span>
          )}
        </span>
        <span className="wiki-hero-card-body" aria-hidden="true">
          <span className="wiki-hero-card-name">{hero.name}</span>
          {!!roles.length && (
            <span className="wiki-hero-card-roles" title={roleLabel}>
              {roles.map((role) => (
                <span key={role.value}>
                  <HeroGlyph name={role.glyph} />
                  <span>{role.label}</span>
                </span>
              ))}
            </span>
          )}
          {!!positions.length && (
            <span className="wiki-hero-card-lanes" title={positionLabel}>
              {positions.map((position) => (
                <HeroGlyph key={position.value} name={position.glyph} />
              ))}
            </span>
          )}
          {undated && <span className="wiki-hero-card-note">{undated}</span>}
        </span>
      </Link>
      {credit && imageUrl && media?.currentVersion && (
        <WikiImageCredit
          className="wiki-hero-card-credit"
          sources={media.currentVersion.sources}
          contactHref={`/contact?assetId=${media.assetId}&versionId=${media.currentVersion.versionId}`}
        />
      )}
    </div>
  )
}
