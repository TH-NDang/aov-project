import { memo, useState, type MouseEvent } from "react"
import { Link } from "react-router"
import { WikiIcon } from "../../../components/wiki-icon"
import { WikiImage } from "../../../components/wiki-image"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { patchChangeLabel, patchChangeTone } from "../../../lib/change-kinds"
import { changeShortWord } from "../../../lib/change-short-word"
import type { HeroListItem } from "../../../lib/hero-api"
import "./hero-switch-tile.css"

/**
 * A hero in the quick switch: a square picture and the name under it, so a screen holds many and the eye goes from face
 * to face. A hero the update being read changed carries its short tag (Buff, Nerf…) in a corner; the hero being read wears a gold
 * ring.
 */
export const HeroSwitchTile = memo(function HeroSwitchTile({
  hero,
  from,
  current,
  kind,
  onPick,
}: {
  hero: HeroListItem
  /** The list the reader came from, kept for the way back from the hero's page. */
  from: string
  current: boolean
  /** What the update being read did to the hero, marked in the picture's corner. */
  kind?: string
  /** Told when the tile is picked, such as to close the list it sits in. */
  onPick?: () => void
}) {
  const { href, locale } = useWikiContext()
  const [failed, setFailed] = useState<string[]>([])
  const portrait = hero.portrait?.currentVersion?.url
  const url = [portrait, hero.head?.currentVersion?.url].find((value) => value && !failed.includes(value))
  const media = url === portrait ? hero.portrait : hero.head
  const tone = kind ? patchChangeTone(kind) : undefined
  const name = kind ? `${hero.name}, ${patchChangeLabel(kind, locale).toLowerCase()}` : hero.name

  function pick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    // Picking the hero already open only closes the list.
    if (current) event.preventDefault()
    onPick?.()
  }

  return (
    <Link
      className="wiki-hero-tile"
      to={href(`/hero/${hero.code}`)}
      state={{ from }}
      aria-current={current ? "page" : undefined}
      aria-label={current ? wikiText(locale, `Đang xem: ${name}`, `Currently viewing: ${name}`) : name}
      onClick={pick}
    >
      <span className="wiki-hero-tile-picture" data-kind={url === portrait ? "portrait" : "head"}>
        {url ? (
          <WikiImage
            frameWidth={96}
            src={url}
            focus={media?.currentVersion?.focalPoint}
            alt=""
            width="96"
            height="96"
            loading="lazy"
            decoding="async"
            onError={() => setFailed((list) => [...list, url])}
          />
        ) : (
          <span className="wiki-hero-tile-initial">{hero.name.charAt(0)}</span>
        )}
        {/* The same tag the hero library's change board puts on its cards. */}
        {tone && (
          <span className="wiki-hero-tile-mark" data-tone={tone} aria-hidden="true">
            {changeShortWord(kind!, tone)}
          </span>
        )}
        {current && (
          <span className="wiki-hero-tile-current">
            <WikiIcon name="check" size={12} />
          </span>
        )}
      </span>
      <span className="wiki-hero-tile-name" aria-hidden="true">
        {hero.name}
      </span>
    </Link>
  )
})

/** The shape of a tile while the list loads. */
export function HeroSwitchTileSkeleton() {
  return (
    <span className="wiki-hero-tile" aria-hidden="true">
      <span className="wiki-hero-tile-picture wiki-skeleton" />
      <span className="wiki-hero-tile-name wiki-hero-tile-name-skeleton wiki-skeleton" />
    </span>
  )
}

/** Opens a run of heroes whose names start with the same letter, as the library's index cards do, at a tile's size. */
export function HeroSwitchLetterTile({ letter, count }: { letter: string; count: number }) {
  const { locale } = useWikiContext()
  return (
    <span className="wiki-hero-tile" aria-hidden="true">
      <span className="wiki-hero-tile-picture wiki-hero-tile-letter">
        <span>{letter}</span>
      </span>
      <span className="wiki-hero-tile-name">
        {wikiText(locale, `${count} tướng`, `${count} ${count === 1 ? "hero" : "heroes"}`)}
      </span>
    </span>
  )
}
