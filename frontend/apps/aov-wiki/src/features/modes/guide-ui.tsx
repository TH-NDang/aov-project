import { createContext, useContext, useMemo, useRef, type CSSProperties, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText, wikiText } from "../../context/wiki-context"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import {
  TRAIT_KIND_NAMES,
  type Blessing,
  type GuideContent,
  type ModeImage,
  type Trait,
  type Unit,
} from "./auto-chess-model"
import type { PublicGuide } from "./mode-api"
import "./guide.css"

/**
 * The game's price colors. They frame the game's own unit icons, so they are part of the artwork and stay here with the
 * other game colors rather than in the stylesheet.
 */
const COST_COLOR: Record<number, string> = {
  1: "#9aa4b2",
  2: "#4fbf7a",
  3: "#4f9be0",
  4: "#b46cff",
  5: "#f2b440",
  6: "var(--aov-wiki-danger)",
}

export const costStyle = (cost: number) => ({ "--cost-color": COST_COLOR[cost] ?? "#9aa4b2" }) as CSSProperties

/** Look-ups shared by every tab of the guide. */
export interface GuideIndex {
  content: GuideContent
  images: Record<string, ModeImage>
  units: Map<string, Unit>
  traits: Map<string, Trait>
  items: Map<string, GuideContent["items"][number]>
  membersOf: (traitCode: string) => Unit[]
  image: (assetId?: string | null) => string | undefined
}

export function useGuideIndex(guide: PublicGuide): GuideIndex {
  return useMemo(() => {
    const { content, images } = guide
    const members = new Map<string, Unit[]>()
    for (const unit of content.units) {
      for (const trait of unit.traitCodes) members.set(trait, [...(members.get(trait) ?? []), unit])
    }
    for (const list of members.values()) list.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "vi"))
    return {
      content,
      images,
      units: new Map(content.units.map((unit) => [unit.code, unit])),
      traits: new Map(content.traits.map((trait) => [trait.code, trait])),
      items: new Map(content.items.map((item) => [item.code, item])),
      membersOf: (code) => members.get(code) ?? [],
      image: (assetId) => (assetId ? images[assetId]?.url : undefined),
    }
  }, [guide])
}

/** What guide text can point at, and where a trait tag leads. Empty outside a guide. */
export const GuideLinks = createContext<{ entities: EntityReference[]; traitHref: (code: string) => string } | null>(
  null,
)

/**
 * Guide text as the editor wrote it: colors, faded parts and references, with terms recognized the same way as in the
 * Admin preview, so what the editor sees is what the reader gets.
 */
export function GuideText({ text }: { text?: string | null }) {
  const scope = useWikiContext()
  const links = useContext(GuideLinks)
  const references = useQuery(wikiReferencesQuery(scope))
  const entities = useMemo(
    () => [...(links?.entities ?? []), ...(references.data?.entities ?? [])],
    [links, references.data],
  )
  if (!text) return null
  return (
    <EntityRichText
      text={text}
      entities={entities}
      locale={scope.locale}
      fallbackLocale={references.data?.fallbackLocale}
      autoRecognize={references.data?.autoRecognize ?? false}
      context="wiki"
    />
  )
}

/** The game's unit icon in a frame of its cost color, the way the game shows a unit's price. */
export function UnitPortrait({
  unit,
  index,
  size,
}: {
  unit: Unit
  index: GuideIndex
  size?: "xs" | "sm" | "md" | "lg"
}) {
  const src = index.image(unit.portraitAssetId)
  return (
    <span className="guide-portrait" data-size={size} style={costStyle(unit.cost)}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <b aria-hidden="true">{unit.name.slice(0, 2)}</b>
      )}
    </span>
  )
}

/** A trait's round icon. The game draws it on a dark square, so it is cropped to its circle. */
export function TraitIcon({ trait, index, size = 20 }: { trait?: Trait; index: GuideIndex; size?: number }) {
  const src = trait ? index.image(trait.iconAssetId) : undefined
  return src ? (
    <img className="guide-trait-icon" src={src} alt="" width={size} height={size} loading="lazy" />
  ) : (
    <span className="guide-trait-icon" style={{ width: size, height: size }} aria-hidden="true" />
  )
}

/** A unit's traits, factions first, then classes. */
function splitTraits(unit: Unit, index: GuideIndex) {
  const traits = unit.traitCodes.map((code) => index.traits.get(code)).filter((trait): trait is Trait => !!trait)
  return {
    factions: traits.filter((trait) => trait.kind === "FACTION"),
    classes: traits.filter((trait) => trait.kind === "CLASS"),
  }
}

/** Factions, then classes of a unit: icons with a divider between the two kinds, one line of names, or tags. */
export function UnitTraits({ unit, index, as }: { unit: Unit; index: GuideIndex; as: "icons" | "names" | "tags" }) {
  const { locale } = useWikiContext()
  const { factions, classes } = splitTraits(unit, index)
  // Names read as one line of text; tags wrap freely, so neither needs the divider the icons use.
  if (as === "names")
    return (
      <span className="unit-traits" data-as={as}>
        {[...factions, ...classes].map((trait) => trait.name).join(" · ")}
      </span>
    )
  const part = (traits: Trait[], kind: string) =>
    traits.length > 0 && (
      <span className="unit-trait-part" data-kind={kind}>
        {traits.map((trait) =>
          as === "icons" ? (
            <span
              key={trait.code}
              className="trait-tip"
              role="img"
              aria-label={`${wikiText(locale, ...TRAIT_KIND_NAMES[trait.kind])}: ${trait.name}`}
              data-tip={`${wikiText(locale, ...TRAIT_KIND_NAMES[trait.kind])}: ${trait.name}`}
            >
              <TraitIcon trait={trait} index={index} size={20} />
            </span>
          ) : (
            <TraitTag key={trait.code} code={trait.code} index={index} />
          ),
        )}
      </span>
    )
  return (
    <span className="unit-traits" data-as={as}>
      {part(factions, "Phe")}
      {as === "icons" && factions.length > 0 && classes.length > 0 && (
        <i className="unit-trait-divider" aria-hidden="true" />
      )}
      {part(classes, "Nghề")}
    </span>
  )
}

export function TraitTag({ code, index, count }: { code: string; index: GuideIndex; count?: number }) {
  const { locale } = useWikiContext()
  const links = useContext(GuideLinks)
  const trait = index.traits.get(code)
  if (!trait) return null
  const body = (
    <>
      <TraitIcon trait={trait} index={index} size={18} />
      {count !== undefined && <b>{count}</b>}
      {trait.name}
    </>
  )
  return links ? (
    <Link
      className="guide-trait-tag"
      data-link="true"
      to={links.traitHref(trait.code)}
      title={`${wikiText(locale, ...TRAIT_KIND_NAMES[trait.kind])}: ${trait.name}`}
    >
      {body}
    </Link>
  ) : (
    <span className="guide-trait-tag" title={`${wikiText(locale, ...TRAIT_KIND_NAMES[trait.kind])}: ${trait.name}`}>
      {body}
    </span>
  )
}

/** The game's blessing cards: blue for the normal tier, purple for epic, bronze for legendary. */
export const TIER_STYLE: Record<Blessing["tier"], CSSProperties> = {
  NORMAL: { "--tier-color": "#4fb0ff", "--tier-bg": "linear-gradient(180deg, #1b3988, #2b5cc4)" } as CSSProperties,
  EPIC: { "--tier-color": "#e277ff", "--tier-bg": "linear-gradient(180deg, #491c7a, #7f3ca8)" } as CSSProperties,
  LEGENDARY: { "--tier-color": "#ffab45", "--tier-bg": "linear-gradient(180deg, #5a3110, #96591f)" } as CSSProperties,
}

/**
 * The game ships blessing icons as white drawings on black. Screen blending drops the black, so the drawing sits on
 * the card's own color like in the game.
 */
export function BlessingIcon({ blessing, index }: { blessing: Blessing; index: GuideIndex }) {
  const src = index.image(blessing.iconAssetId)
  return (
    <span className="blessing-icon" style={TIER_STYLE[blessing.tier]} aria-hidden="true">
      {src && <img src={src} alt="" loading="lazy" decoding="async" />}
    </span>
  )
}

/** Numbers in a plain effect stand out like in the game. Text that already carries markup stays as written. */
function emphasizeNumbers(text?: string | null) {
  if (!text || /[<[{]/.test(text)) return text
  return text.replace(/[+\-−]?\d+(?:[.,]\d+)?%?/g, "<b>$&</b>")
}

/** Tiers as the game draws them: the count in a ring that fills one step per tier. */
export function TierList({ trait, count }: { trait: Trait; count?: number }) {
  return (
    <div className="guide-tiers">
      {trait.tiers.map((tier, at) => (
        <p
          key={tier.count}
          className="guide-tier"
          data-reached={count !== undefined && count >= tier.count}
          style={{ "--tier-progress": (at + 1) / trait.tiers.length } as CSSProperties}
        >
          <b>{tier.count}</b>
          <span>
            <GuideText text={emphasizeNumbers(tier.effect)} />
          </span>
        </p>
      ))}
    </div>
  )
}

/** A guide tab's search: the magnifier, the field and, once something is typed, a button that clears it. */
export function GuideSearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  const text = useWikiText()
  const input = useRef<HTMLInputElement>(null)
  return (
    <label className="guide-search">
      <WikiIcon name="search" size={18} />
      <input
        ref={input}
        type="search"
        aria-label={label}
        value={value}
        maxLength={80}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label={text("Xóa từ khóa", "Clear the search")}
          onClick={() => {
            onChange("")
            input.current?.focus()
          }}
        >
          <WikiIcon name="close" size={14} />
        </button>
      )}
    </label>
  )
}

/** Ways to show the same thing, side by side. Each names itself; the names show only where `labels` leaves room. */
export function ChoiceSwitch<Value extends string | number>({
  label,
  value,
  options,
  onChange,
  labels = true,
}: {
  label: string
  value: Value
  options: { value: Value; label: string; icon?: ReactNode }[]
  onChange: (value: Value) => void
  labels?: boolean
}) {
  return (
    <div className="guide-switch" role="group" aria-label={label} data-labels={labels || undefined}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          aria-label={labels ? undefined : option.label}
          title={labels ? undefined : option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {labels && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}
