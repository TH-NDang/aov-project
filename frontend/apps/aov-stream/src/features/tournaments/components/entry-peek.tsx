import { useRef, useState, type ReactElement } from "react"
import { useQuery } from "@tanstack/react-query"
import type { Reference } from "@aov/community-contracts"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { referenceTranslation } from "@aov/ui/lib/entity-rich-text"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { WIKI_URL } from "../../../components/stream-shell"
import { wikiCatalogQuery } from "../../../lib/reference-api"
import type { CatalogKind } from "../../../lib/tournament-model"
import { describeEntry, wikiEntryUrl, wikiKind } from "../../../lib/wiki-links"
import "./entry-peek.css"

const KIND_NAMES: Record<CatalogKind, readonly [string, string]> = {
  heroes: ["Tướng", "Hero"],
  items: ["Trang bị", "Item"],
  enchantments: ["Phù hiệu", "Enchantment"],
  spells: ["Phụ trợ", "Spell"],
  arcana: ["Ngọc", "Arcana"],
}

const WIKI_MARK = new URL("images/mole-logo-v4.png", `${WIKI_URL.replace(/\/$/, "")}/`).href

/** What the card says of an entry: its picture, kind and name, what the Wiki writes of it, and the way to its page. */
function EntryCard({ kind, reference }: { kind: CatalogKind; reference: Reference }) {
  const { text, languageTag } = useStreamLocale()
  const wiki = useQuery(wikiCatalogQuery(languageTag))
  const entity = wiki.data?.find((entry) => entry.kind === wikiKind(kind) && entry.id === reference.id)
  const translation = entity && referenceTranslation(entity, languageTag)
  const name = translation?.name || reference.name
  const { stats, line } = describeEntry(translation?.description)
  return (
    <div className="tn-entry" data-kind={kind}>
      <div className="tn-entry-head">
        <span className="tn-entry-art">
          <StreamImage src={reference.iconUrl} name={name} />
        </span>
        <span className="tn-entry-words">
          <small>{text(...KIND_NAMES[kind])}</small>
          <b>{name}</b>
        </span>
      </div>
      {stats.length > 0 && (
        <ul className="tn-entry-stats">
          {stats.map((stat) => (
            <li key={stat}>{stat}</li>
          ))}
        </ul>
      )}
      {line ? (
        <p className="tn-entry-line">{line}</p>
      ) : (
        wiki.isPending && <i className="tn-entry-wait" aria-hidden="true" />
      )}
      <a
        className="tn-entry-wiki"
        href={wikiEntryUrl(WIKI_URL, kind, reference, languageTag)}
        target="_blank"
        rel="noopener"
      >
        <img src={WIKI_MARK} alt="" width={20} height={20} />
        {text("Xem trên Wiki", "Open on the Wiki")}
        <StreamIcon name="external" size={14} />
      </a>
    </div>
  )
}

/**
 * A hero, an item, an enchantment or a spell that shows its card when pointed at, with the way to its page on the
 * Wiki. Pressing the picture never leaves the page: a finger, which cannot point, opens the card with a tap, unless the
 * picture lies on a button or a link of its own, which keeps the tap.
 */
export function EntryPeek({
  kind,
  reference,
  children,
}: {
  kind: CatalogKind
  reference: Reference
  children: ReactElement
}) {
  const [open, setOpen] = useState(false)
  const finger = useRef(false)
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={320} closeDelay={140}>
      <HoverCardTrigger
        asChild
        onPointerDown={(event) => {
          finger.current = event.pointerType !== "mouse"
        }}
        onClick={(event) => {
          if (!finger.current || open || event.currentTarget.parentElement?.closest("a, button")) return
          setOpen(true)
        }}
      >
        {children}
      </HoverCardTrigger>
      {/* The card is drawn elsewhere on the page but belongs to what holds the picture: a press on it is no press on
          the row or the seat around the picture. */}
      <HoverCardContent
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className="hub-popover tn-entry-popup"
        onClick={(event) => event.stopPropagation()}
      >
        <EntryCard kind={kind} reference={reference} />
      </HoverCardContent>
    </HoverCard>
  )
}
