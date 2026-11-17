import { useMemo } from "react"
import { LocalTime } from "@aov/ui/components/local-time"
import { useSearchParams } from "react-router"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { TRAIT_KIND_NAMES } from "./auto-chess-model"
import type { PublicGuide } from "./mode-api"
import { ModeDialog } from "./mode-ui"
import { GuideLinks, useGuideIndex, type GuideIndex } from "./guide-ui"
import { UnitDetail, UnitsTab } from "./guide-units"
import { TraitsTab } from "./guide-traits"
import { ItemsTab } from "./guide-items"
import { BlessingsTab } from "./guide-blessings"
import { QuestsTab } from "./guide-quests"
import { LineupsTab } from "./guide-lineups"
import { BuilderTab } from "./guide-builder"
import { InsightsTab } from "./guide-insights"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { GuideTab } from "./auto-chess-model"
import "./auto-chess-guide.css"

const plain = (value?: string | null) => (value ?? "").replace(/<[^>]+>/g, "")

/**
 * The guide's own traits, units and items as references, so a name in a description gets a card like a term does.
 * Each points at its place in the guide.
 */
function guideReferences(
  index: GuideIndex,
  modeCode: string,
  href: (path: string) => string,
  locale: string,
): EntityReference[] {
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const base = `/modes/${encodeURIComponent(modeCode)}`
  const translation = (name: string, description: string) => [{ locale: "vi-VN", name, aliases: [], description }]
  return [
    ...index.content.traits.map((trait) => ({
      id: `guide-trait-${trait.code}`,
      kind: "term" as const,
      translations: translation(
        trait.name,
        [
          `${text(...TRAIT_KIND_NAMES[trait.kind])} · ${index.membersOf(trait.code).length} ` +
            text("quân cờ", index.membersOf(trait.code).length === 1 ? "unit" : "units"),
          ...trait.tiers.map((tier) => `(${tier.count}) ${plain(tier.effect)}`),
        ].join("\n"),
      ),
      icon: index.image(trait.iconAssetId) ?? null,
      autoMatch: true,
      destinations: { wiki: href(`${base}/traits?trait=${encodeURIComponent(trait.code)}`) },
    })),
    ...index.content.units.map((unit) => ({
      id: `guide-unit-${unit.code}`,
      kind: "term" as const,
      translations: translation(
        unit.name,
        [
          text(`Quân cờ ${unit.cost} vàng · `, `${unit.cost}-gold unit · `) +
            unit.traitCodes.map((code) => index.traits.get(code)?.name).join(", "),
          unit.skill?.name ? `${unit.skill.name}: ${plain(unit.skill.description)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      icon: index.image(unit.portraitAssetId) ?? null,
      autoMatch: false,
      destinations: { wiki: href(`${base}/units?unit=${encodeURIComponent(unit.code)}`) },
    })),
    ...index.content.items.map((item) => ({
      id: `guide-item-${item.code}`,
      kind: "term" as const,
      translations: translation(
        item.name,
        `${text("Trang bị Cờ Liên quân", "Auto-chess item")} · ${plain(item.effect)}`,
      ),
      icon: index.image(item.iconAssetId) ?? null,
      autoMatch: true,
      destinations: { wiki: href(`${base}/items`) },
    })),
  ]
}

export function AutoChessGuide({ code, tab, guide }: { code: string; tab: GuideTab; guide: PublicGuide }) {
  const index = useGuideIndex(guide)
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const links = useMemo(
    () => ({
      entities: guideReferences(index, code, href, locale),
      traitHref: (traitCode: string) =>
        href(`/modes/${encodeURIComponent(code)}/traits?trait=${encodeURIComponent(traitCode)}`),
    }),
    [index, code, href, locale],
  )
  const [params, setParams] = useSearchParams()
  const openUnit = params.get("unit")
  const selected = openUnit ? index.units.get(openUnit) : undefined
  const showUnit = (unitCode: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (unitCode) next.set("unit", unitCode)
        else next.delete("unit")
        return next
      },
      { preventScrollReset: true },
    )

  return (
    <GuideLinks.Provider value={links}>
      {tab === "units" && <UnitsTab index={index} onOpen={showUnit} />}
      {tab === "traits" && <TraitsTab index={index} onOpen={showUnit} />}
      {tab === "items" && <ItemsTab index={index} />}
      {tab === "blessings" && <BlessingsTab index={index} />}
      {tab === "quests" && <QuestsTab index={index} />}
      {tab === "lineups" && <LineupsTab code={code} guide={guide} index={index} onOpen={showUnit} />}
      {tab === "builder" && <BuilderTab code={code} index={index} onOpen={showUnit} />}
      {tab === "insights" && <InsightsTab code={code} index={index} onOpen={showUnit} />}
      {/* Where the data comes from closes every tab, out of the way of what the reader came for. */}
      <p className="wiki-guide-edition">
        {guide.content.edition ?? text("Bách khoa Cờ Liên quân", "Auto-chess encyclopedia")}
        {guide.content.observedOn && (
          <>
            {` · ${text("ghi nhận", "recorded")} `}
            <LocalTime value={guide.content.observedOn} locale={locale} />
          </>
        )}
        {text(" · Dữ liệu và hình ảnh: Garena / Liên Quân Mobile", " · Data and images: Garena / Arena of Valor")}
      </p>
      <ModeDialog
        open={!!selected}
        onClose={() => showUnit(null)}
        label={selected?.name ?? text("Quân cờ", "Unit")}
        title={text("Quân cờ", "Unit")}
      >
        {selected && <UnitDetail unit={selected} index={index} code={code} onOpen={showUnit} />}
      </ModeDialog>
    </GuideLinks.Provider>
  )
}
